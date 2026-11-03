import { AuditService } from '../../audit/application/audit.service';
import { AuditAction } from '../../audit/domain/audit-action.enum';
import { AuthenticatedUser } from '../domain/authenticated-user.interface';
import { PrismaPermissionRepository } from '../infrastructure/prisma-permission.repository';
import { PermissionSyncService } from './permission-sync.service';

describe('PermissionSyncService', () => {
  const syncFromCatalogue = jest.fn();
  const list = jest.fn();
  const record = jest.fn();

  const permissionRepository = {
    syncFromCatalogue,
    list,
  } as unknown as PrismaPermissionRepository;

  const auditService = { record } as unknown as AuditService;
  let service: PermissionSyncService;

  const actor: AuthenticatedUser = {
    id: 'user-1',
    organisationId: 'org-1',
    email: 'admin@neukleos.com',
    employeeId: null,
    permissions: ['identity.role.manage'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    record.mockResolvedValue(undefined);
    service = new PermissionSyncService(permissionRepository, auditService);
  });

  it('syncs the catalogue and audits the import', async () => {
    syncFromCatalogue.mockResolvedValue({
      created: 2,
      updated: 1,
      total: 24,
    });

    await expect(service.syncCatalogue(actor)).resolves.toEqual({
      created: 2,
      updated: 1,
      total: 24,
    });

    expect(syncFromCatalogue).toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.IMPORT,
        resourceType: 'PermissionCatalogue',
        organisationId: 'org-1',
        actorId: 'user-1',
      }),
    );
  });

  it('lists permissions from the repository', async () => {
    list.mockResolvedValue({
      data: [{ id: 'p1', code: 'employee.read', description: 'View' }],
      meta: {
        page: 1,
        size: 20,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });

    await expect(
      service.list({ page: 1, size: 20, search: 'employee' }),
    ).resolves.toEqual(
      expect.objectContaining({
        data: [expect.objectContaining({ code: 'employee.read' })],
      }),
    );
  });
});
