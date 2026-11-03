import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  IntegrationProvider,
  RecordStatus,
} from '../../../generated/prisma/client';
import { PrismaAuthenticationRepository } from './prisma-authentication.repository';

describe('PrismaAuthenticationRepository', () => {
  const findFirst = jest.fn();
  const findMany = jest.fn();
  const userUpdate = jest.fn();
  const externalFindFirst = jest.fn();
  const externalCreate = jest.fn();
  const refreshCreate = jest.fn();
  const refreshFindUnique = jest.fn();
  const refreshUpdateMany = jest.fn();
  const refreshDelete = jest.fn();
  const transaction = jest.fn();

  const prisma = {
    userAccount: { findFirst, findMany, update: userUpdate },
    externalIdentity: {
      findFirst: externalFindFirst,
      create: externalCreate,
    },
    refreshToken: {
      create: refreshCreate,
      findUnique: refreshFindUnique,
      updateMany: refreshUpdateMany,
      delete: refreshDelete,
    },
    $transaction: transaction,
  } as unknown as PrismaService;

  let repository: PrismaAuthenticationRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new PrismaAuthenticationRepository(prisma);
    transaction.mockImplementation(
      async (callback: (tx: typeof prisma) => Promise<unknown>) =>
        callback(prisma),
    );
  });

  it('maps an active user and aggregates permissions', async () => {
    findFirst.mockResolvedValue({
      id: 'user-1',
      organisationId: 'org-1',
      officialEmail: 'user@example.com',
      employeeId: null,
      roleAssignments: [
        {
          role: {
            permissions: [
              { permission: { code: 'employee.read' } },
              { permission: { code: 'employee.update' } },
            ],
          },
        },
        {
          role: {
            permissions: [
              { permission: { code: 'employee.read' } },
              { permission: { code: 'audit.read' } },
            ],
          },
        },
      ],
    });

    await expect(
      repository.findActivePrincipalById('user-1', 'org-1'),
    ).resolves.toEqual({
      id: 'user-1',
      organisationId: 'org-1',
      email: 'user@example.com',
      employeeId: null,
      permissions: ['employee.read', 'employee.update', 'audit.read'],
    });

    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'user-1',
          organisationId: 'org-1',
          status: RecordStatus.ACTIVE,
          organisation: { status: RecordStatus.ACTIVE },
        }),
      }),
    );
  });

  it('removes duplicate permissions', async () => {
    findFirst.mockResolvedValue({
      id: 'user-1',
      organisationId: 'org-1',
      officialEmail: 'user@example.com',
      employeeId: null,
      roleAssignments: [
        {
          role: {
            permissions: [
              { permission: { code: 'leave.submit' } },
              { permission: { code: 'leave.submit' } },
            ],
          },
        },
      ],
    });

    const principal = await repository.findActivePrincipalById(
      'user-1',
      'org-1',
    );
    expect(principal?.permissions).toEqual(['leave.submit']);
  });

  it('returns null for an inactive or missing user', async () => {
    findFirst.mockResolvedValue(null);

    await expect(
      repository.findActivePrincipalById('missing', 'org-1'),
    ).resolves.toBeNull();
  });

  it('propagates Prisma errors', async () => {
    findFirst.mockRejectedValue(new Error('db failure'));

    await expect(
      repository.findActivePrincipalById('user-1', 'org-1'),
    ).rejects.toThrow('db failure');
  });

  it('uses one Prisma query per lookup', async () => {
    findFirst.mockResolvedValue({
      id: 'user-1',
      organisationId: 'org-1',
      officialEmail: 'user@example.com',
      employeeId: null,
      roleAssignments: [],
    });

    await repository.findActivePrincipalById('user-1', 'org-1');
    expect(findFirst).toHaveBeenCalledTimes(1);
  });

  it('finds an active principal by Google Workspace subject', async () => {
    externalFindFirst.mockResolvedValue({
      user: {
        id: 'user-1',
        organisationId: 'org-1',
        officialEmail: 'alice@neukleos.com',
        employeeId: null,
        roleAssignments: [
          {
            role: {
              permissions: [{ permission: { code: 'employee.read' } }],
            },
          },
        ],
      },
    });

    await expect(
      repository.findActivePrincipalByGoogleSubject('google-sub-1'),
    ).resolves.toEqual({
      id: 'user-1',
      organisationId: 'org-1',
      email: 'alice@neukleos.com',
      employeeId: null,
      permissions: ['employee.read'],
    });

    expect(externalFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          provider: IntegrationProvider.GOOGLE_WORKSPACE,
          subject: 'google-sub-1',
          user: {
            status: RecordStatus.ACTIVE,
            organisation: { status: RecordStatus.ACTIVE },
          },
        },
      }),
    );
  });

  it('returns null when Google subject has no active linked ERP account', async () => {
    externalFindFirst.mockResolvedValue(null);

    await expect(
      repository.findActivePrincipalByGoogleSubject('missing-or-inactive'),
    ).resolves.toBeNull();
  });

  it('links an invited inactive user on first Google sign-in and activates them', async () => {
    findMany.mockResolvedValue([{ id: 'user-1', status: RecordStatus.INACTIVE }]);
    externalCreate.mockResolvedValue({ id: 'ext-1' });
    userUpdate.mockResolvedValue({ id: 'user-1' });
    findFirst.mockResolvedValue({
      id: 'user-1',
      organisationId: 'org-1',
      officialEmail: 'ada@neukleos.com',
      employeeId: null,
      roleAssignments: [],
    });

    await expect(
      repository.linkInvitedPrincipalByGoogleIdentity({
        subject: 'google-sub-1',
        email: 'ada@neukleos.com',
        hostedDomain: 'neukleos.com',
      }),
    ).resolves.toEqual({
      id: 'user-1',
      organisationId: 'org-1',
      email: 'ada@neukleos.com',
      employeeId: null,
      permissions: [],
    });

    expect(externalCreate).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        provider: IntegrationProvider.GOOGLE_WORKSPACE,
        subject: 'google-sub-1',
        email: 'ada@neukleos.com',
      },
    });
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { status: RecordStatus.ACTIVE },
    });
  });

  it('returns null when Google email domain does not match hosted domain', async () => {
    await expect(
      repository.linkInvitedPrincipalByGoogleIdentity({
        subject: 'google-sub-1',
        email: 'ada@neukleos.com',
        hostedDomain: 'other.com',
      }),
    ).resolves.toBeNull();
    expect(findMany).not.toHaveBeenCalled();
  });

  it('returns null when invite email matches more than one eligible account', async () => {
    findMany.mockResolvedValue([
      { id: 'user-1', status: RecordStatus.INACTIVE },
      { id: 'user-2', status: RecordStatus.INACTIVE },
    ]);

    await expect(
      repository.linkInvitedPrincipalByGoogleIdentity({
        subject: 'google-sub-1',
        email: 'ada@neukleos.com',
        hostedDomain: 'neukleos.com',
      }),
    ).resolves.toBeNull();
    expect(externalCreate).not.toHaveBeenCalled();
  });

  it('creates a hashed refresh token record', async () => {
    refreshCreate.mockResolvedValue({ id: 'rt-1' });
    const expiresAt = new Date('2026-01-08T00:00:00.000Z');

    await expect(
      repository.createRefreshToken({
        userId: 'user-1',
        organisationId: 'org-1',
        tokenHash: 'hashed-token',
        familyId: 'family-1',
        expiresAt,
      }),
    ).resolves.toEqual({ id: 'rt-1' });

    expect(refreshCreate).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        organisationId: 'org-1',
        tokenHash: 'hashed-token',
        familyId: 'family-1',
        expiresAt,
      },
      select: { id: true },
    });
  });

  it('rotates a valid refresh token atomically', async () => {
    refreshFindUnique.mockResolvedValue({
      id: 'old-id',
      userId: 'user-1',
      organisationId: 'org-1',
      familyId: 'family-1',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      replacedById: null,
    });
    refreshCreate.mockResolvedValue({ id: 'new-id' });
    refreshUpdateMany.mockResolvedValue({ count: 1 });

    await expect(
      repository.rotateRefreshToken({
        presentedTokenHash: 'old-hash',
        replacementTokenHash: 'new-hash',
        replacementExpiresAt: new Date(Date.now() + 120_000),
      }),
    ).resolves.toEqual({
      outcome: 'rotated',
      userId: 'user-1',
      organisationId: 'org-1',
      familyId: 'family-1',
      previousTokenId: 'old-id',
      replacementTokenId: 'new-id',
    });

    expect(refreshUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'old-id',
        revokedAt: null,
        replacedById: null,
      },
      data: {
        replacedById: 'new-id',
      },
    });
  });

  it('treats a just-rotated token presentation as a concurrent conflict', async () => {
    refreshFindUnique.mockResolvedValueOnce({
      id: 'old-id',
      userId: 'user-1',
      organisationId: 'org-1',
      familyId: 'family-1',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      replacedById: 'replacement-id',
    });
    refreshFindUnique.mockResolvedValueOnce({
      id: 'replacement-id',
      replacedById: null,
      revokedAt: null,
    });

    await expect(
      repository.rotateRefreshToken({
        presentedTokenHash: 'old-hash',
        replacementTokenHash: 'new-hash',
        replacementExpiresAt: new Date(Date.now() + 120_000),
      }),
    ).resolves.toEqual({ outcome: 'concurrent_conflict' });

    expect(refreshCreate).not.toHaveBeenCalled();
    expect(refreshUpdateMany).not.toHaveBeenCalled();
  });

  it('detects reuse after the replacement was itself rotated and revokes the family', async () => {
    refreshFindUnique.mockResolvedValueOnce({
      id: 'old-id',
      userId: 'user-1',
      organisationId: 'org-1',
      familyId: 'family-1',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      replacedById: 'replacement-id',
    });
    refreshFindUnique.mockResolvedValueOnce({
      id: 'replacement-id',
      replacedById: 'later-id',
      revokedAt: null,
    });
    refreshUpdateMany.mockResolvedValue({ count: 2 });

    await expect(
      repository.rotateRefreshToken({
        presentedTokenHash: 'old-hash',
        replacementTokenHash: 'new-hash',
        replacementExpiresAt: new Date(Date.now() + 120_000),
      }),
    ).resolves.toEqual({
      outcome: 'reuse_detected',
      familyId: 'family-1',
    });

    expect(refreshUpdateMany).toHaveBeenCalledWith({
      where: {
        familyId: 'family-1',
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
    expect(refreshCreate).not.toHaveBeenCalled();
  });

  it('rejects concurrent refresh attempts that lose the claim', async () => {
    refreshFindUnique.mockResolvedValue({
      id: 'old-id',
      userId: 'user-1',
      organisationId: 'org-1',
      familyId: 'family-1',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      replacedById: null,
    });
    refreshCreate.mockResolvedValue({ id: 'new-id' });
    refreshUpdateMany.mockResolvedValue({ count: 0 });
    refreshDelete.mockResolvedValue({});

    await expect(
      repository.rotateRefreshToken({
        presentedTokenHash: 'old-hash',
        replacementTokenHash: 'new-hash',
        replacementExpiresAt: new Date(Date.now() + 120_000),
      }),
    ).resolves.toEqual({ outcome: 'concurrent_conflict' });

    expect(refreshDelete).toHaveBeenCalledWith({ where: { id: 'new-id' } });
  });

  it('returns invalid for unknown, expired, or revoked tokens', async () => {
    refreshFindUnique.mockResolvedValueOnce(null);
    await expect(
      repository.rotateRefreshToken({
        presentedTokenHash: 'missing',
        replacementTokenHash: 'new-hash',
        replacementExpiresAt: new Date(Date.now() + 120_000),
      }),
    ).resolves.toEqual({ outcome: 'invalid' });

    refreshFindUnique.mockResolvedValueOnce({
      id: 'old-id',
      userId: 'user-1',
      organisationId: 'org-1',
      familyId: 'family-1',
      expiresAt: new Date(Date.now() - 1000),
      revokedAt: null,
      replacedById: null,
    });
    await expect(
      repository.rotateRefreshToken({
        presentedTokenHash: 'expired',
        replacementTokenHash: 'new-hash',
        replacementExpiresAt: new Date(Date.now() + 120_000),
      }),
    ).resolves.toEqual({ outcome: 'invalid' });

    refreshFindUnique.mockResolvedValueOnce({
      id: 'old-id',
      userId: 'user-1',
      organisationId: 'org-1',
      familyId: 'family-1',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
      replacedById: null,
    });
    await expect(
      repository.rotateRefreshToken({
        presentedTokenHash: 'revoked',
        replacementTokenHash: 'new-hash',
        replacementExpiresAt: new Date(Date.now() + 120_000),
      }),
    ).resolves.toEqual({ outcome: 'invalid' });
  });

  it('revokes a refresh-token family on logout', async () => {
    refreshFindUnique.mockResolvedValue({ familyId: 'family-1' });
    refreshUpdateMany.mockResolvedValue({ count: 2 });

    await expect(
      repository.revokeRefreshTokenFamilyByHash('hash'),
    ).resolves.toBe('revoked');
  });

  it('treats repeated logout as already inactive or not found', async () => {
    refreshFindUnique.mockResolvedValueOnce({ familyId: 'family-1' });
    refreshUpdateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      repository.revokeRefreshTokenFamilyByHash('hash'),
    ).resolves.toBe('already_inactive');

    refreshFindUnique.mockResolvedValueOnce(null);
    await expect(
      repository.revokeRefreshTokenFamilyByHash('missing'),
    ).resolves.toBe('not_found');
  });
});
