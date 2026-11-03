import {
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../../audit/application/audit.service';
import { AuditAction } from '../../audit/domain/audit-action.enum';
import { AuthenticatedUser } from '../../authorization/domain/authenticated-user.interface';
import { MailService } from '../../notifications/domain/mail.service';
import { RecordStatus } from '../../../generated/prisma/client';
import { UserAccountRecord } from '../domain/user.types';
import { PrismaUsersRepository } from '../infrastructure/prisma-users.repository';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const create = jest.fn();
  const invite = jest.fn();
  const list = jest.fn();
  const findById = jest.fn();
  const update = jest.fn();
  const linkGoogleIdentity = jest.fn();
  const unlinkGoogleIdentity = jest.fn();
  const record = jest.fn();
  const sendUserInviteEmail = jest.fn();
  const getOrThrow = jest.fn();

  const repository = {
    create,
    invite,
    list,
    findById,
    update,
    linkGoogleIdentity,
    unlinkGoogleIdentity,
  } as unknown as PrismaUsersRepository;

  const auditService = { record } as unknown as AuditService;
  const mailService = { sendUserInviteEmail } as unknown as MailService;
  const configService = { getOrThrow } as unknown as ConfigService;
  let service: UsersService;

  const actor: AuthenticatedUser = {
    id: 'admin-1',
    organisationId: 'org-1',
    email: 'admin@neukleos.com',
    employeeId: null,
    permissions: ['identity.user.manage', 'identity.user.read'],
  };

  const user: UserAccountRecord = {
    id: 'user-1',
    organisationId: 'org-1',
    officialEmail: 'ada@neukleos.com',
    status: RecordStatus.ACTIVE,
    employeeId: null,
    externalIdentities: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    record.mockResolvedValue(undefined);
    sendUserInviteEmail.mockResolvedValue({ status: 'sent', id: 'email-1' });
    getOrThrow.mockImplementation((key: string) => {
      if (key === 'email.appWebUrl') {
        return 'http://localhost:3001';
      }
      throw new Error(`Unexpected config key: ${key}`);
    });
    service = new UsersService(
      repository,
      auditService,
      mailService,
      configService,
    );
  });

  it('creates a user in the actor organisation and audits', async () => {
    create.mockResolvedValue(user);

    await expect(
      service.create(actor, { officialEmail: 'ada@neukleos.com' }),
    ).resolves.toEqual(user);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: 'org-1',
        officialEmail: 'ada@neukleos.com',
      }),
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CREATE,
        resourceType: 'UserAccount',
        resourceId: 'user-1',
      }),
    );
  });

  it('invites a Workspace user with Google identity and audits', async () => {
    const invited = {
      ...user,
      externalIdentities: [
        {
          id: 'ext-1',
          provider: 'GOOGLE_WORKSPACE',
          subject: 'google-sub-1',
          email: 'ada@neukleos.com',
        },
      ],
    };
    invite.mockResolvedValue(invited);

    await expect(
      service.invite(actor, {
        officialEmail: 'ada@neukleos.com',
        googleSubject: 'google-sub-1',
      }),
    ).resolves.toEqual(invited);

    expect(invite).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: 'org-1',
        googleSubject: 'google-sub-1',
      }),
    );
    expect(sendUserInviteEmail).toHaveBeenCalledWith({
      to: 'ada@neukleos.com',
      signInUrl: 'http://localhost:3001/sign-in',
      invitedByEmail: 'admin@neukleos.com',
    });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CREATE,
        resourceType: 'UserAccount',
        newValues: expect.objectContaining({
          invite: true,
          inviteEmail: { status: 'sent', id: 'email-1' },
        }),
      }),
    );
  });

  it('invites with Workspace email only for first-login Google linking', async () => {
    const invited = {
      ...user,
      status: 'INACTIVE',
      externalIdentities: [],
    };
    invite.mockResolvedValue(invited);

    await expect(
      service.invite(actor, {
        officialEmail: 'ada@neukleos.com',
      }),
    ).resolves.toEqual(invited);

    expect(invite).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: 'org-1',
        officialEmail: 'ada@neukleos.com',
        googleSubject: undefined,
      }),
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: expect.stringContaining('email-only'),
        newValues: expect.objectContaining({
          invite: true,
          linkOnFirstGoogleSignIn: true,
        }),
      }),
    );
  });

  it('rejects access without organisation context', async () => {
    await expect(
      service.list({ ...actor, organisationId: '' }, { page: 1, size: 20 }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns not found for users outside the organisation', async () => {
    findById.mockResolvedValue(null);

    await expect(service.findOne(actor, 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('links a Google identity and audits', async () => {
    const linked = {
      ...user,
      externalIdentities: [
        {
          id: 'ext-1',
          provider: 'GOOGLE_WORKSPACE',
          subject: 'google-sub-1',
          email: 'ada@neukleos.com',
        },
      ],
    };
    linkGoogleIdentity.mockResolvedValue(linked);

    await expect(
      service.linkGoogleIdentity(actor, 'user-1', {
        subject: 'google-sub-1',
      }),
    ).resolves.toEqual(linked);

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.ASSIGN,
        resourceType: 'ExternalIdentity',
      }),
    );
  });

  it('unlinks a Google identity and audits', async () => {
    findById.mockResolvedValue({
      ...user,
      externalIdentities: [
        {
          id: 'ext-1',
          provider: 'GOOGLE_WORKSPACE',
          subject: 'google-sub-1',
          email: 'ada@neukleos.com',
        },
      ],
    });
    unlinkGoogleIdentity.mockResolvedValue(user);

    await expect(
      service.unlinkGoogleIdentity(actor, 'user-1'),
    ).resolves.toEqual(user);

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.UNASSIGN,
        resourceType: 'ExternalIdentity',
      }),
    );
  });

  it('updates a user and audits old/new values', async () => {
    findById.mockResolvedValue(user);
    const updated = { ...user, status: RecordStatus.INACTIVE };
    update.mockResolvedValue(updated);

    await expect(
      service.update(actor, 'user-1', { status: RecordStatus.INACTIVE }),
    ).resolves.toEqual(updated);

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.UPDATE,
        resourceType: 'UserAccount',
        oldValues: expect.objectContaining({ status: RecordStatus.ACTIVE }),
        newValues: expect.objectContaining({ status: RecordStatus.INACTIVE }),
      }),
    );
  });
});
