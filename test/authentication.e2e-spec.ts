/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Controller,
  Get,
  INestApplication,
  Module,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { ApiResponseInterceptor } from '../src/common/interceptors/api-response.interceptor';
import { RequestContextService } from '../src/common/request-context/request-context.service';
import { PrismaService } from '../src/database/prisma/prisma.service';
import {
  IntegrationProvider,
  RecordStatus,
} from '../src/generated/prisma/client';
import { CurrentUser } from '../src/modules/authentication/decorators/current-user.decorator';
import { GOOGLE_IDENTITY_VERIFIER } from '../src/modules/authentication/domain/google-identity-verifier';
import { GoogleVerifiedIdentity } from '../src/modules/authentication/domain/google-verified-identity.interface';
import { hashRefreshToken } from '../src/modules/authentication/infrastructure/refresh-token.crypto';
import { Permissions } from '../src/modules/authorization/decorators/permissions.decorator';
import { Public } from '../src/modules/authorization/decorators/public.decorator';
import { AuthenticatedUser } from '../src/modules/authorization/domain/authenticated-user.interface';

@Controller('e2e-probe')
class E2eProbeController {
  @Public()
  @Get('public')
  publicRoute() {
    return { ok: true };
  }

  @Get('protected')
  protectedRoute(@CurrentUser() user?: AuthenticatedUser) {
    return {
      id: user?.id,
      organisationId: user?.organisationId,
    };
  }

  @Permissions('employee.read')
  @Get('permissioned')
  permissioned(@CurrentUser() user?: AuthenticatedUser) {
    return { id: user?.id };
  }
}

@Module({
  controllers: [E2eProbeController],
})
class E2eProbeModule {}

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let verifyIdToken: jest.Mock;

  const orgId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const userId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const googleSubject = 'google-e2e-subject-001';
  const email = 'alice@neukleos.com';
  const refreshSecret = process.env.JWT_REFRESH_SECRET as string;

  beforeAll(async () => {
    verifyIdToken = jest.fn();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule, E2eProbeModule],
    })
      .overrideProvider(GOOGLE_IDENTITY_VERIFIER)
      .useValue({ verifyIdToken })
      .compile();

    app = moduleFixture.createNestApplication();
    const requestContextService = app.get(RequestContextService);
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new GlobalExceptionFilter(requestContextService));
    app.useGlobalInterceptors(
      new ApiResponseInterceptor(requestContextService),
    );
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: false,
        },
      }),
    );

    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    verifyIdToken.mockReset();
    await resetAuthData(prisma);
    await seedActiveLinkedUser(prisma, {
      orgId,
      userId,
      email,
      googleSubject,
    });
  });

  function unwrapData<T>(body: unknown): T {
    if (
      typeof body !== 'object' ||
      body === null ||
      !('data' in body) ||
      body.data === undefined
    ) {
      throw new Error('Expected wrapped API response data');
    }
    return (body as { data: T }).data;
  }

  function mockGoogleIdentity(
    overrides: Partial<GoogleVerifiedIdentity> = {},
  ): void {
    verifyIdToken.mockResolvedValue({
      subject: googleSubject,
      email,
      hostedDomain: 'neukleos.com',
      emailVerified: true,
      ...overrides,
    });
  }

  async function login(): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    mockGoogleIdentity();
    const response = await request(app.getHttpServer())
      .post('/api/v1/authentication/google')
      .send({ idToken: 'mock-google-id-token' })
      .expect(201);

    const session = unwrapData<{
      accessToken: string;
      refreshToken: string;
    }>(response.body);

    expect(session.accessToken).toEqual(expect.any(String));
    expect(session.refreshToken).toEqual(expect.any(String));
    return session;
  }

  it('issues access and refresh tokens for a linked active account', async () => {
    const session = await login();

    expect(session.accessToken.split('.')).toHaveLength(3);
    expect(session.refreshToken.length).toBeGreaterThan(20);

    const stored = await prisma.refreshToken.findUnique({
      where: {
        tokenHash: hashRefreshToken(session.refreshToken, refreshSecret),
      },
    });
    expect(stored).not.toBeNull();
    expect(stored?.userId).toBe(userId);
    expect(stored?.revokedAt).toBeNull();
    expect(stored?.replacedById).toBeNull();
  });

  it('authenticates /authentication/me with the issued access token', async () => {
    const { accessToken } = await login();

    const me = await request(app.getHttpServer())
      .get('/api/v1/authentication/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(unwrapData(me.body)).toEqual({
      id: userId,
      organisationId: orgId,
      email,
      permissions: ['employee.read'],
    });
  });

  it('rotates the refresh token and rejects the previous token', async () => {
    const { refreshToken: original } = await login();

    const refreshed = await request(app.getHttpServer())
      .post('/api/v1/authentication/refresh')
      .send({ refreshToken: original })
      .expect(201);

    const next = unwrapData<{
      accessToken: string;
      refreshToken: string;
    }>(refreshed.body);

    expect(next.refreshToken).not.toBe(original);

    await request(app.getHttpServer())
      .post('/api/v1/authentication/refresh')
      .send({ refreshToken: original })
      .expect(401);

    await request(app.getHttpServer())
      .get('/api/v1/authentication/me')
      .set('Authorization', `Bearer ${next.accessToken}`)
      .expect(200);
  });

  it('revokes the token family when a confirmed rotated ancestor is reused', async () => {
    const { refreshToken: original } = await login();

    const firstRefresh = await request(app.getHttpServer())
      .post('/api/v1/authentication/refresh')
      .send({ refreshToken: original })
      .expect(201);
    const first = unwrapData<{ refreshToken: string }>(firstRefresh.body);

    const secondRefresh = await request(app.getHttpServer())
      .post('/api/v1/authentication/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(201);
    const second = unwrapData<{ refreshToken: string }>(secondRefresh.body);

    // original → first was itself rotated to second: confirmed reuse of ancestor.
    await request(app.getHttpServer())
      .post('/api/v1/authentication/refresh')
      .send({ refreshToken: original })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/authentication/refresh')
      .send({ refreshToken: second.refreshToken })
      .expect(401);

    const familyTokens = await prisma.refreshToken.findMany({
      where: {
        userId,
      },
    });
    expect(familyTokens.length).toBeGreaterThan(0);
    expect(familyTokens.every((token) => token.revokedAt !== null)).toBe(true);
  });

  it('allows only one concurrent refresh to succeed', async () => {
    const { refreshToken } = await login();

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/authentication/refresh')
        .send({ refreshToken }),
      request(app.getHttpServer())
        .post('/api/v1/authentication/refresh')
        .send({ refreshToken }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 401]);

    const winner = first.status === 201 ? first : second;
    const session = unwrapData<{ refreshToken: string }>(winner.body);

    await request(app.getHttpServer())
      .post('/api/v1/authentication/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(201);
  });

  it('logs out idempotently and revokes the refresh-token family', async () => {
    const { accessToken, refreshToken } = await login();

    await request(app.getHttpServer())
      .post('/api/v1/authentication/logout')
      .send({ refreshToken })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/authentication/logout')
      .send({ refreshToken })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/authentication/refresh')
      .send({ refreshToken })
      .expect(401);

    // Access JWT remains valid until expiry (no denylist).
    await request(app.getHttpServer())
      .get('/api/v1/authentication/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });

  it('rejects missing external identity and inactive accounts', async () => {
    verifyIdToken.mockResolvedValue({
      subject: 'unknown-google-subject',
      email: 'nobody@neukleos.com',
      hostedDomain: 'neukleos.com',
      emailVerified: true,
    });

    await request(app.getHttpServer())
      .post('/api/v1/authentication/google')
      .send({ idToken: 'mock-google-id-token' })
      .expect(401);

    await prisma.userAccount.update({
      where: { id: userId },
      data: { status: RecordStatus.INACTIVE },
    });
    mockGoogleIdentity();
    await request(app.getHttpServer())
      .post('/api/v1/authentication/google')
      .send({ idToken: 'mock-google-id-token' })
      .expect(401);

    await prisma.userAccount.update({
      where: { id: userId },
      data: { status: RecordStatus.ACTIVE },
    });
    await prisma.organisation.update({
      where: { id: orgId },
      data: { status: RecordStatus.INACTIVE },
    });
    mockGoogleIdentity();
    await request(app.getHttpServer())
      .post('/api/v1/authentication/google')
      .send({ idToken: 'mock-google-id-token' })
      .expect(401);
  });

  it('rejects invalid tokens and keeps public/protected/permission behaviour', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/authentication/google')
      .send({ idToken: '' })
      .expect(400);

    verifyIdToken.mockRejectedValue(
      new UnauthorizedException('Invalid Google identity token'),
    );
    await request(app.getHttpServer())
      .post('/api/v1/authentication/google')
      .send({ idToken: 'bad-token' })
      .expect(401)
      .expect((res: request.Response) => {
        expect(res.body.message).toBe('Authentication failed');
      });

    await request(app.getHttpServer())
      .post('/api/v1/authentication/refresh')
      .send({ refreshToken: 'not-a-real-token' })
      .expect(401);

    await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/e2e-probe/public')
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/e2e-probe/protected')
      .expect(401);

    await request(app.getHttpServer())
      .get('/api/v1/authentication/me')
      .expect(401);

    const { accessToken } = await login();

    await request(app.getHttpServer())
      .get('/api/v1/e2e-probe/protected')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/e2e-probe/permissioned')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    await prisma.roleAssignment.deleteMany({ where: { userId } });

    await request(app.getHttpServer())
      .get('/api/v1/e2e-probe/permissioned')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);
  });

  it('does not require live Google and never echoes the Google ID token', async () => {
    mockGoogleIdentity();
    const response = await request(app.getHttpServer())
      .post('/api/v1/authentication/google')
      .send({ idToken: 'raw-google-id-token-value' })
      .expect(201);

    expect(JSON.stringify(response.body)).not.toContain(
      'raw-google-id-token-value',
    );
    expect(verifyIdToken).toHaveBeenCalledWith('raw-google-id-token-value');
  });
});

async function resetAuthData(prisma: PrismaService): Promise<void> {
  await prisma.refreshToken.deleteMany();
  await prisma.externalIdentity.deleteMany();
  await prisma.roleAssignment.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.userAccount.deleteMany();
  await prisma.organisation.deleteMany();
  await prisma.auditEvent.deleteMany();
}

async function seedActiveLinkedUser(
  prisma: PrismaService,
  input: {
    orgId: string;
    userId: string;
    email: string;
    googleSubject: string;
  },
): Promise<void> {
  await prisma.organisation.create({
    data: {
      id: input.orgId,
      name: 'Neukleos E2E',
      code: 'NEUKLEOS_E2E',
      status: RecordStatus.ACTIVE,
    },
  });

  const permission = await prisma.permission.create({
    data: {
      code: 'employee.read',
      description: 'Read employees',
    },
  });

  const role = await prisma.role.create({
    data: {
      organisationId: input.orgId,
      name: 'Employee',
      code: 'EMPLOYEE',
      permissions: {
        create: [{ permissionId: permission.id }],
      },
    },
  });

  await prisma.userAccount.create({
    data: {
      id: input.userId,
      organisationId: input.orgId,
      officialEmail: input.email,
      status: RecordStatus.ACTIVE,
      roleAssignments: {
        create: [{ roleId: role.id }],
      },
      externalIdentities: {
        create: {
          provider: IntegrationProvider.GOOGLE_WORKSPACE,
          subject: input.googleSubject,
          email: input.email,
        },
      },
    },
  });
}
