import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditAction } from '../domain/audit-action.enum';
import { PersistedAuditEntry } from '../domain/audit-entry.interface';
import { PrismaAuditRepository } from './prisma-audit.repository';

describe('PrismaAuditRepository', () => {
  const create = jest.fn();
  const prisma = {
    auditEvent: { create },
  } as unknown as PrismaService;

  let repository: PrismaAuditRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    create.mockResolvedValue({ id: 'audit-1' });
    repository = new PrismaAuditRepository(prisma);
  });

  it('maps domain fields to Prisma fields', async () => {
    const entry: PersistedAuditEntry = {
      action: AuditAction.APPROVE,
      entityType: 'FinancialRequest',
      entityId: 'fr-1',
      actorUserId: 'user-1',
      oldValue: { status: 'PENDING' },
      newValue: { status: 'APPROVED' },
      metadata: {
        requestId: 'req-1',
        organisationId: 'org-1',
        reason: 'policy met',
      },
    };

    await repository.create(entry);

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      data: {
        action: AuditAction.APPROVE,
        entityType: 'FinancialRequest',
        entityId: 'fr-1',
        actorUserId: 'user-1',
        oldValue: { status: 'PENDING' },
        newValue: { status: 'APPROVED' },
        metadata: {
          requestId: 'req-1',
          organisationId: 'org-1',
          reason: 'policy met',
        },
      },
    });
  });

  it('persists JSON values correctly', async () => {
    await repository.create({
      action: AuditAction.UPDATE,
      entityType: 'Employee',
      oldValue: null,
      newValue: { tags: ['a', 'b'], count: 2, active: true },
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        action: AuditAction.UPDATE,
        entityType: 'Employee',
        entityId: undefined,
        actorUserId: undefined,
        oldValue: Prisma.JsonNull,
        newValue: { tags: ['a', 'b'], count: 2, active: true },
        metadata: undefined,
      },
    });
  });

  it('handles optional fields correctly', async () => {
    await repository.create({
      action: AuditAction.READ,
      entityType: 'Report',
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        action: AuditAction.READ,
        entityType: 'Report',
        entityId: undefined,
        actorUserId: undefined,
        oldValue: undefined,
        newValue: undefined,
        metadata: undefined,
      },
    });
  });

  it('calls Prisma create exactly once', async () => {
    await repository.create({
      action: AuditAction.EXPORT,
      entityType: 'Budget',
      entityId: 'b-1',
    });

    expect(create).toHaveBeenCalledTimes(1);
  });

  it('propagates Prisma failures', async () => {
    create.mockRejectedValue(new Error('unique constraint'));

    await expect(
      repository.create({
        action: AuditAction.CREATE,
        entityType: 'Vendor',
      }),
    ).rejects.toThrow('unique constraint');
  });
});
