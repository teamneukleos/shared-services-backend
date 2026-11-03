import { BadRequestException } from '@nestjs/common';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AuditAction } from '../domain/audit-action.enum';
import { CreateAuditEntry } from '../domain/audit-entry.interface';
import { AuditRepository } from '../domain/audit.repository';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  const createMock = jest.fn();
  const getContext = jest.fn();

  const auditRepository = {
    create: createMock,
  } as unknown as AuditRepository;

  const requestContextService = {
    getContext,
  } as unknown as RequestContextService;

  let service: AuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    createMock.mockResolvedValue(undefined);
    getContext.mockReturnValue({
      requestId: 'req-123',
      ipAddress: '203.0.113.10',
      userAgent: 'jest-agent',
      userId: 'user-context',
      organisationId: 'org-context',
    });
    service = new AuditService(auditRepository, requestContextService);
  });

  it('enriches an entry from request context', async () => {
    await service.record({
      action: AuditAction.CREATE,
      resourceType: 'Invoice',
      resourceId: 'inv-1',
      newValues: { amount: 100 },
    });

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith({
      action: AuditAction.CREATE,
      entityType: 'Invoice',
      entityId: 'inv-1',
      actorUserId: 'user-context',
      oldValue: undefined,
      newValue: { amount: 100 },
      metadata: {
        organisationId: 'org-context',
        requestId: 'req-123',
        ipAddress: '203.0.113.10',
        userAgent: 'jest-agent',
      },
    });
  });

  it('lets explicit actor and organisation values override context', async () => {
    await service.record({
      action: AuditAction.UPDATE,
      resourceType: 'Employee',
      actorId: 'user-explicit',
      organisationId: 'org-explicit',
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'user-explicit',
        metadata: expect.objectContaining({
          organisationId: 'org-explicit',
          requestId: 'req-123',
        }),
      }),
    );
  });

  it('does not mutate the caller-provided object', async () => {
    const entry: CreateAuditEntry = {
      action: AuditAction.DELETE,
      resourceType: 'Document',
      metadata: { password: 'secret-value', note: 'keep' },
      oldValues: { token: 'abc' },
    };
    const snapshot = structuredClone(entry);

    await service.record(entry);

    expect(entry).toEqual(snapshot);
  });

  it('rejects an empty resource type', async () => {
    await expect(
      service.record({
        action: AuditAction.READ,
        resourceType: '   ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(createMock).not.toHaveBeenCalled();
  });

  it('redacts sensitive nested values', async () => {
    await service.record({
      action: AuditAction.UPDATE,
      resourceType: 'UserAccount',
      oldValues: {
        profile: {
          password: 'p@ss',
          email: 'a@b.com',
        },
      },
      newValues: {
        authorization: 'Bearer xyz',
        nested: { refreshToken: 'r1', ok: true },
      },
      metadata: {
        apiKey: 'k1',
        safe: true,
      },
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        oldValue: {
          profile: {
            password: '[REDACTED]',
            email: 'a@b.com',
          },
        },
        newValue: {
          authorization: '[REDACTED]',
          nested: { refreshToken: '[REDACTED]', ok: true },
        },
        metadata: expect.objectContaining({
          apiKey: '[REDACTED]',
          safe: true,
        }),
      }),
    );
  });

  it('sanitizes arrays', async () => {
    await service.record({
      action: AuditAction.EXPORT,
      resourceType: 'Report',
      newValues: [{ token: 't1' }, { name: 'ok' }],
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        newValue: [{ token: '[REDACTED]' }, { name: 'ok' }],
      }),
    );
  });

  it('keeps dates safely serializable', async () => {
    const occurred = new Date('2026-08-04T00:00:00.000Z');

    await service.record({
      action: AuditAction.CREATE,
      resourceType: 'LeaveRequest',
      newValues: { occurred },
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        newValue: { occurred: '2026-08-04T00:00:00.000Z' },
      }),
    );
  });

  it('does not crash on circular references', async () => {
    const circular: Record<string, unknown> = { name: 'loop' };
    circular.self = circular;

    await expect(
      service.record({
        action: AuditAction.UPDATE,
        resourceType: 'Thing',
        newValues: circular,
      }),
    ).resolves.toBeUndefined();

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        newValue: {
          name: 'loop',
          self: '[Circular]',
        },
      }),
    );
  });

  it('calls the repository exactly once', async () => {
    await service.record({
      action: AuditAction.LOGIN,
      resourceType: 'Session',
    });

    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it('re-throws repository failures', async () => {
    createMock.mockRejectedValue(new Error('db down'));

    await expect(
      service.record({
        action: AuditAction.CREATE,
        resourceType: 'Invoice',
      }),
    ).rejects.toThrow('db down');
  });
});
