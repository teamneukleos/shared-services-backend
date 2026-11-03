import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../../audit/application/audit.service';
import { AuditAction } from '../../audit/domain/audit-action.enum';
import { AccessTokenPayload } from '../domain/access-token-payload.interface';
import { AuthenticationRepository } from '../domain/authentication.repository';
import { GoogleIdentityVerifier } from '../domain/google-identity-verifier';
import { JwtAccessStrategy } from '../infrastructure/jwt-access.strategy';
import { hashRefreshToken } from '../infrastructure/refresh-token.crypto';
import { AuthenticationService } from './authentication.service';

describe('AuthenticationService', () => {
  const findActivePrincipalById = jest.fn();
  const findActivePrincipalByGoogleSubject = jest.fn();
  const linkInvitedPrincipalByGoogleIdentity = jest.fn();
  const createRefreshToken = jest.fn();
  const rotateRefreshToken = jest.fn();
  const revokeRefreshTokenFamilyByHash = jest.fn();
  const verifyIdToken = jest.fn();
  const signAsync = jest.fn();
  const getOrThrow = jest.fn();
  const record = jest.fn();

  const repository = {
    findActivePrincipalById,
    findActivePrincipalByGoogleSubject,
    linkInvitedPrincipalByGoogleIdentity,
    createRefreshToken,
    rotateRefreshToken,
    revokeRefreshTokenFamilyByHash,
  } as unknown as AuthenticationRepository;

  const googleIdentityVerifier = {
    verifyIdToken,
  } as unknown as GoogleIdentityVerifier;

  const jwtService = {
    signAsync,
  } as unknown as JwtService;

  const configService = {
    getOrThrow,
  } as unknown as ConfigService;

  const auditService = {
    record,
  } as unknown as AuditService;

  const refreshSecret = 'test-refresh-secret-at-least-32-characters-long';

  let service: AuthenticationService;

  beforeEach(() => {
    jest.clearAllMocks();
    getOrThrow.mockImplementation((key: string) => {
      if (key === 'jwt.accessExpiresIn') {
        return '15m';
      }
      if (key === 'jwt.refreshExpiresIn') {
        return '7d';
      }
      if (key === 'jwt.accessSecret') {
        return 'test-access-secret-at-least-32-characters-long';
      }
      if (key === 'jwt.refreshSecret') {
        return refreshSecret;
      }
      throw new Error(`Unexpected config key: ${key}`);
    });
    signAsync.mockResolvedValue('signed-access-token');
    createRefreshToken.mockResolvedValue({ id: 'refresh-1' });
    revokeRefreshTokenFamilyByHash.mockResolvedValue('revoked');
    record.mockResolvedValue(undefined);
    service = new AuthenticationService(
      repository,
      googleIdentityVerifier,
      jwtService,
      configService,
      auditService,
    );
  });

  describe('validateAccessTokenPayload', () => {
    it('returns a principal for a valid payload', async () => {
      const payload: AccessTokenPayload = {
        sub: 'user-1',
        organisationId: 'org-1',
        email: 'user@example.com',
      };
      const principal = {
        id: 'user-1',
        organisationId: 'org-1',
        email: 'user@example.com',
        employeeId: null,
        permissions: ['employee.read'],
      };
      findActivePrincipalById.mockResolvedValue(principal);

      await expect(
        service.validateAccessTokenPayload(payload),
      ).resolves.toEqual(principal);
      expect(findActivePrincipalById).toHaveBeenCalledTimes(1);
      expect(findActivePrincipalById).toHaveBeenCalledWith('user-1', 'org-1');
    });

    it('throws when the user is missing', async () => {
      findActivePrincipalById.mockResolvedValue(null);

      await expect(
        service.validateAccessTokenPayload({
          sub: 'missing',
          organisationId: 'org-1',
          email: 'user@example.com',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws when the repository returns null for an inactive user', async () => {
      findActivePrincipalById.mockResolvedValue(null);

      await expect(
        service.validateAccessTokenPayload({
          sub: 'inactive',
          organisationId: 'org-1',
          email: 'user@example.com',
        }),
      ).rejects.toThrow('Invalid or inactive account');
    });

    it('throws on organisation mismatch', async () => {
      findActivePrincipalById.mockResolvedValue({
        id: 'user-1',
        organisationId: 'org-other',
        email: 'user@example.com',
        employeeId: null,
        permissions: [],
      });

      await expect(
        service.validateAccessTokenPayload({
          sub: 'user-1',
          organisationId: 'org-1',
          email: 'user@example.com',
        }),
      ).rejects.toThrow('Organisation mismatch');
    });

    it('does not mutate the payload', async () => {
      const payload: AccessTokenPayload = {
        sub: 'user-1',
        organisationId: 'org-1',
        email: 'user@example.com',
      };
      const snapshot = structuredClone(payload);
      findActivePrincipalById.mockResolvedValue({
        id: 'user-1',
        organisationId: 'org-1',
        email: 'user@example.com',
        employeeId: null,
        permissions: [],
      });

      await service.validateAccessTokenPayload(payload);
      expect(payload).toEqual(snapshot);
    });

    it('calls the repository exactly once', async () => {
      findActivePrincipalById.mockResolvedValue({
        id: 'user-1',
        organisationId: 'org-1',
        email: 'user@example.com',
        employeeId: null,
        permissions: [],
      });

      await service.validateAccessTokenPayload({
        sub: 'user-1',
        organisationId: 'org-1',
        email: 'user@example.com',
      });

      expect(findActivePrincipalById).toHaveBeenCalledTimes(1);
    });
  });

  describe('loginWithGoogle', () => {
    const domains = [
      {
        domain: 'neukleos.com',
        email: 'alice@neukleos.com',
        subject: 'google-sub-neukleos',
      },
      {
        domain: 'imageandtime.com',
        email: 'bob@imageandtime.com',
        subject: 'google-sub-imageandtime',
      },
      {
        domain: 'kucheza.com',
        email: 'cara@kucheza.com',
        subject: 'google-sub-kucheza',
      },
    ] as const;

    it.each(domains)(
      'issues ERP access and refresh tokens for a linked $domain identity',
      async ({ domain, email, subject }) => {
        const principal = {
          id: `user-${domain}`,
          organisationId: `org-${domain}`,
          email,
          permissions: ['employee.read'],
        };

        verifyIdToken.mockResolvedValue({
          subject,
          email,
          hostedDomain: domain,
          emailVerified: true,
        });
        findActivePrincipalByGoogleSubject.mockResolvedValue(principal);

        const session = await service.loginWithGoogle(`id-token-${domain}`);

        expect(session).toEqual(
          expect.objectContaining({
            accessToken: 'signed-access-token',
            tokenType: 'Bearer',
            expiresIn: '15m',
            refreshExpiresIn: '7d',
            user: principal,
          }),
        );
        expect(typeof session.refreshToken).toBe('string');
        expect(session.refreshToken.length).toBeGreaterThan(20);
        expect(createRefreshToken).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: principal.id,
            organisationId: principal.organisationId,
            tokenHash: hashRefreshToken(session.refreshToken, refreshSecret),
          }),
        );
        expect(verifyIdToken).toHaveBeenCalledWith(`id-token-${domain}`);
        expect(signAsync).toHaveBeenCalledWith({
          sub: principal.id,
          organisationId: principal.organisationId,
          email: principal.email,
        });
        expect(signAsync.mock.calls[0][0]).not.toHaveProperty('permissions');
        expect(record).toHaveBeenCalledWith({
          action: AuditAction.LOGIN,
          resourceType: 'Session',
          resourceId: principal.id,
          actorId: principal.id,
          organisationId: principal.organisationId,
          metadata: {
            provider: 'GOOGLE_WORKSPACE',
            hostedDomain: domain,
          },
        });
      },
    );

    it('rejects an invalid Google token', async () => {
      verifyIdToken.mockRejectedValue(
        new UnauthorizedException('Invalid Google identity token'),
      );

      await expect(service.loginWithGoogle('bad-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(findActivePrincipalByGoogleSubject).not.toHaveBeenCalled();
      expect(signAsync).not.toHaveBeenCalled();
      expect(createRefreshToken).not.toHaveBeenCalled();
    });

    it('rejects an unapproved Google Workspace domain with a generic failure', async () => {
      verifyIdToken.mockRejectedValue(
        new UnauthorizedException('Google Workspace domain is not allowed'),
      );

      await expect(
        service.loginWithGoogle('unapproved-domain-token'),
      ).rejects.toThrow('Authentication failed');
      expect(signAsync).not.toHaveBeenCalled();
    });

    it('rejects when no ExternalIdentity link exists and no invite can be claimed', async () => {
      verifyIdToken.mockResolvedValue({
        subject: 'unlinked-google-sub',
        email: 'alice@neukleos.com',
        hostedDomain: 'neukleos.com',
        emailVerified: true,
      });
      findActivePrincipalByGoogleSubject.mockResolvedValue(null);
      linkInvitedPrincipalByGoogleIdentity.mockResolvedValue(null);

      await expect(service.loginWithGoogle('id-token')).rejects.toThrow(
        'Authentication failed',
      );
      expect(linkInvitedPrincipalByGoogleIdentity).toHaveBeenCalledWith({
        subject: 'unlinked-google-sub',
        email: 'alice@neukleos.com',
        hostedDomain: 'neukleos.com',
      });
      expect(signAsync).not.toHaveBeenCalled();
    });

    it('links an email-only invite on first Google sign-in then issues a session', async () => {
      const principal = {
        id: 'user-invited',
        organisationId: 'org-1',
        email: 'ada@neukleos.com',
        employeeId: null,
        permissions: [],
      };
      verifyIdToken.mockResolvedValue({
        subject: 'google-sub-first-login',
        email: 'ada@neukleos.com',
        hostedDomain: 'neukleos.com',
        emailVerified: true,
      });
      findActivePrincipalByGoogleSubject.mockResolvedValue(null);
      linkInvitedPrincipalByGoogleIdentity.mockResolvedValue(principal);

      const session = await service.loginWithGoogle('id-token');

      expect(session.user).toEqual(principal);
      expect(linkInvitedPrincipalByGoogleIdentity).toHaveBeenCalledWith({
        subject: 'google-sub-first-login',
        email: 'ada@neukleos.com',
        hostedDomain: 'neukleos.com',
      });
      expect(signAsync).toHaveBeenCalled();
      expect(createRefreshToken).toHaveBeenCalled();
    });

    it('rejects inactive user or organisation without disclosing account existence', async () => {
      verifyIdToken.mockResolvedValue({
        subject: 'google-sub-inactive',
        email: 'alice@neukleos.com',
        hostedDomain: 'neukleos.com',
        emailVerified: true,
      });
      findActivePrincipalByGoogleSubject.mockResolvedValue(null);
      linkInvitedPrincipalByGoogleIdentity.mockResolvedValue(null);

      await expect(service.loginWithGoogle('id-token')).rejects.toThrow(
        'Authentication failed',
      );
      expect(signAsync).not.toHaveBeenCalled();
    });

    it('rejects when the linked ERP email domain does not match the Google hosted domain', async () => {
      verifyIdToken.mockResolvedValue({
        subject: 'google-sub-mismatch',
        email: 'alice@neukleos.com',
        hostedDomain: 'neukleos.com',
        emailVerified: true,
      });
      findActivePrincipalByGoogleSubject.mockResolvedValue({
        id: 'user-1',
        organisationId: 'org-1',
        email: 'alice@other-company.com',
        employeeId: null,
        permissions: [],
      });

      await expect(service.loginWithGoogle('id-token')).rejects.toThrow(
        'Authentication failed',
      );
      expect(signAsync).not.toHaveBeenCalled();
    });

    it('never returns the Google ID token', async () => {
      verifyIdToken.mockResolvedValue({
        subject: 'google-sub-1',
        email: 'alice@neukleos.com',
        hostedDomain: 'neukleos.com',
        emailVerified: true,
      });
      findActivePrincipalByGoogleSubject.mockResolvedValue({
        id: 'user-1',
        organisationId: 'org-1',
        email: 'alice@neukleos.com',
        employeeId: null,
        permissions: [],
      });

      const session = await service.loginWithGoogle('raw-google-id-token');
      expect(JSON.stringify(session)).not.toContain('raw-google-id-token');
    });

    it('issues a token accepted by the JWT strategy with permissions loaded from the database', async () => {
      const principal = {
        id: 'user-1',
        organisationId: 'org-1',
        email: 'alice@neukleos.com',
        employeeId: null,
        permissions: ['employee.read', 'leave.submit'],
      };
      const accessTokenPayload: AccessTokenPayload = {
        sub: principal.id,
        organisationId: principal.organisationId,
        email: principal.email,
      };

      verifyIdToken.mockResolvedValue({
        subject: 'google-sub-1',
        email: principal.email,
        hostedDomain: 'neukleos.com',
        emailVerified: true,
      });
      findActivePrincipalByGoogleSubject.mockResolvedValue(principal);
      signAsync.mockImplementation((payload: AccessTokenPayload) => {
        expect(payload).toEqual(accessTokenPayload);
        expect(payload).not.toHaveProperty('permissions');
        return Promise.resolve('signed-access-token');
      });

      const session = await service.loginWithGoogle('id-token');

      findActivePrincipalById.mockResolvedValue({
        ...principal,
        permissions: ['employee.read', 'leave.submit', 'audit.read'],
      });

      const strategy = new JwtAccessStrategy(configService, service);
      const authenticatedUser = await strategy.validate(accessTokenPayload);

      expect(session.accessToken).toBe('signed-access-token');
      expect(typeof session.refreshToken).toBe('string');
      expect(authenticatedUser).toEqual({
        id: 'user-1',
        organisationId: 'org-1',
        email: 'alice@neukleos.com',
        employeeId: null,
        permissions: ['employee.read', 'leave.submit', 'audit.read'],
      });
      expect(findActivePrincipalById).toHaveBeenCalledWith('user-1', 'org-1');
      expect(authenticatedUser.permissions).not.toEqual(principal.permissions);
    });
  });

  describe('refreshSession', () => {
    const principal = {
      id: 'user-1',
      organisationId: 'org-1',
      email: 'alice@neukleos.com',
      employeeId: null,
      permissions: ['employee.read'],
    };

    it('rotates the refresh token and issues a new access token', async () => {
      rotateRefreshToken.mockResolvedValue({
        outcome: 'rotated',
        userId: 'user-1',
        organisationId: 'org-1',
        familyId: 'family-1',
        previousTokenId: 'old-id',
        replacementTokenId: 'new-id',
      });
      findActivePrincipalById.mockResolvedValue(principal);

      const session = await service.refreshSession('presented-refresh-token');

      expect(rotateRefreshToken).toHaveBeenCalledWith({
        presentedTokenHash: hashRefreshToken(
          'presented-refresh-token',
          refreshSecret,
        ),
        replacementTokenHash: hashRefreshToken(
          session.refreshToken,
          refreshSecret,
        ),
        replacementExpiresAt: expect.any(Date),
      });
      expect(session).toEqual(
        expect.objectContaining({
          accessToken: 'signed-access-token',
          tokenType: 'Bearer',
          expiresIn: '15m',
          refreshExpiresIn: '7d',
          user: principal,
        }),
      );
      expect(session.refreshToken).not.toBe('presented-refresh-token');
      expect(JSON.stringify(session)).not.toContain('presented-refresh-token');
    });

    it('rejects unknown, expired, or revoked refresh tokens', async () => {
      rotateRefreshToken.mockResolvedValue({ outcome: 'invalid' });

      await expect(service.refreshSession('bad-token')).rejects.toThrow(
        'Authentication failed',
      );
      expect(signAsync).not.toHaveBeenCalled();
    });

    it('rejects reused rotated tokens after family revocation', async () => {
      rotateRefreshToken.mockResolvedValue({
        outcome: 'reuse_detected',
        familyId: 'family-1',
      });

      await expect(service.refreshSession('old-rotated-token')).rejects.toThrow(
        'Authentication failed',
      );
      expect(signAsync).not.toHaveBeenCalled();
    });

    it('rejects concurrent refresh attempts that lose the rotation race', async () => {
      rotateRefreshToken.mockResolvedValue({
        outcome: 'concurrent_conflict',
      });

      await expect(
        service.refreshSession('same-refresh-token'),
      ).rejects.toThrow('Authentication failed');
      expect(signAsync).not.toHaveBeenCalled();
    });

    it('rejects refresh when the user or organisation is inactive', async () => {
      rotateRefreshToken.mockResolvedValue({
        outcome: 'rotated',
        userId: 'user-1',
        organisationId: 'org-1',
        familyId: 'family-1',
        previousTokenId: 'old-id',
        replacementTokenId: 'new-id',
      });
      findActivePrincipalById.mockResolvedValue(null);

      await expect(service.refreshSession('presented-token')).rejects.toThrow(
        'Authentication failed',
      );
      expect(revokeRefreshTokenFamilyByHash).toHaveBeenCalled();
    });

    it('rejects malformed empty refresh tokens', async () => {
      await expect(service.refreshSession('   ')).rejects.toThrow(
        'Authentication failed',
      );
      expect(rotateRefreshToken).not.toHaveBeenCalled();
    });

    it('issues an access token accepted by the JWT strategy', async () => {
      rotateRefreshToken.mockResolvedValue({
        outcome: 'rotated',
        userId: 'user-1',
        organisationId: 'org-1',
        familyId: 'family-1',
        previousTokenId: 'old-id',
        replacementTokenId: 'new-id',
      });
      findActivePrincipalById.mockResolvedValue(principal);

      const session = await service.refreshSession('presented-refresh-token');
      const strategy = new JwtAccessStrategy(configService, service);
      findActivePrincipalById.mockResolvedValue({
        ...principal,
        permissions: ['employee.read', 'audit.read'],
      });

      await expect(
        strategy.validate({
          sub: 'user-1',
          organisationId: 'org-1',
          email: 'alice@neukleos.com',
        }),
      ).resolves.toEqual({
        id: 'user-1',
        organisationId: 'org-1',
        email: 'alice@neukleos.com',
        employeeId: null,
        permissions: ['employee.read', 'audit.read'],
      });
      expect(session.accessToken).toBe('signed-access-token');
    });
  });

  describe('logout', () => {
    it('revokes the refresh-token family', async () => {
      await expect(service.logout('presented-refresh-token')).resolves.toEqual({
        success: true,
      });

      expect(revokeRefreshTokenFamilyByHash).toHaveBeenCalledWith(
        hashRefreshToken('presented-refresh-token', refreshSecret),
      );
      expect(record).toHaveBeenCalledWith({
        action: AuditAction.LOGOUT,
        resourceType: 'Session',
        metadata: {
          provider: 'REFRESH_TOKEN',
        },
      });
    });

    it('is idempotent for repeated logout', async () => {
      revokeRefreshTokenFamilyByHash
        .mockResolvedValueOnce('revoked')
        .mockResolvedValueOnce('already_inactive')
        .mockResolvedValueOnce('not_found');

      await expect(service.logout('same-token')).resolves.toEqual({
        success: true,
      });
      await expect(service.logout('same-token')).resolves.toEqual({
        success: true,
      });
      await expect(service.logout('same-token')).resolves.toEqual({
        success: true,
      });
    });
  });
});
