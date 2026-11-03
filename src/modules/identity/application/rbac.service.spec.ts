import {
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuditService } from '../../audit/application/audit.service';
import { AuditAction } from '../../audit/domain/audit-action.enum';
import { AuthenticatedUser } from '../../authorization/domain/authenticated-user.interface';
import { RoleAssignmentRecord, RoleRecord } from '../domain/rbac.types';
import { PrismaRbacRepository } from '../infrastructure/prisma-rbac.repository';
import { RbacService } from './rbac.service';

describe('RbacService', () => {
  const createRole = jest.fn();
  const listRoles = jest.fn();
  const findRole = jest.fn();
  const updateRole = jest.fn();
  const deleteRole = jest.fn();
  const assignPermissions = jest.fn();
  const removePermission = jest.fn();
  const assignRoleToUser = jest.fn();
  const removeRoleFromUser = jest.fn();
  const listUserRoles = jest.fn();
  const record = jest.fn();

  const repository = {
    createRole,
    listRoles,
    findRole,
    updateRole,
    deleteRole,
    assignPermissions,
    removePermission,
    assignRoleToUser,
    removeRoleFromUser,
    listUserRoles,
  } as unknown as PrismaRbacRepository;

  const auditService = { record } as unknown as AuditService;
  let service: RbacService;

  const actor: AuthenticatedUser = {
    id: 'user-1',
    organisationId: 'org-1',
    email: 'admin@neukleos.com',
    employeeId: null,
    permissions: ['identity.role.manage', 'identity.role.read'],
  };

  const role: RoleRecord = {
    id: 'role-1',
    organisationId: 'org-1',
    name: 'HR Manager',
    code: 'HR_MANAGER',
    permissions: [
      {
        id: 'perm-1',
        code: 'employee.read',
        description: 'View employee records',
      },
    ],
    assignmentCount: 0,
  };

  const assignment: RoleAssignmentRecord = {
    id: 'assign-1',
    userId: 'user-2',
    roleId: 'role-1',
    roleCode: 'HR_MANAGER',
    roleName: 'HR Manager',
    startsAt: new Date('2026-01-01T00:00:00.000Z'),
    endsAt: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    record.mockResolvedValue(undefined);
    service = new RbacService(repository, auditService);
  });

  it('creates a role in the actor organisation and audits', async () => {
    createRole.mockResolvedValue(role);

    await expect(
      service.createRole(actor, {
        name: 'HR Manager',
        code: 'HR_MANAGER',
        permissionCodes: ['employee.read'],
      }),
    ).resolves.toEqual(role);

    expect(createRole).toHaveBeenCalledWith(
      expect.objectContaining({ organisationId: 'org-1', code: 'HR_MANAGER' }),
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CREATE,
        resourceType: 'Role',
        resourceId: 'role-1',
      }),
    );
  });

  it('rejects access without organisation context', async () => {
    await expect(
      service.listRoles({ ...actor, organisationId: '' }, { page: 1, size: 20 }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns not found for roles outside the organisation', async () => {
    findRole.mockResolvedValue(null);

    await expect(service.getRole(actor, 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('assigns permissions and audits', async () => {
    assignPermissions.mockResolvedValue(role);

    await expect(
      service.assignPermissions(actor, 'role-1', {
        permissionCodes: ['employee.read'],
      }),
    ).resolves.toEqual(role);

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.ASSIGN,
        resourceType: 'RolePermission',
      }),
    );
  });

  it('assigns a role to a user and audits', async () => {
    assignRoleToUser.mockResolvedValue(assignment);

    await expect(
      service.assignRoleToUser(actor, 'user-2', { roleId: 'role-1' }),
    ).resolves.toEqual(assignment);

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.ASSIGN,
        resourceType: 'RoleAssignment',
      }),
    );
  });

  it('ends a user role assignment and audits', async () => {
    const ended = {
      ...assignment,
      endsAt: new Date('2026-02-01T00:00:00.000Z'),
    };
    removeRoleFromUser.mockResolvedValue(ended);

    await expect(
      service.removeRoleFromUser(actor, 'user-2', 'role-1'),
    ).resolves.toEqual(ended);

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.UNASSIGN,
        resourceType: 'RoleAssignment',
      }),
    );
  });

  it('deletes a role after loading it for audit', async () => {
    findRole.mockResolvedValue(role);
    deleteRole.mockResolvedValue(undefined);

    await service.deleteRole(actor, 'role-1');

    expect(deleteRole).toHaveBeenCalledWith('org-1', 'role-1');
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.DELETE,
        resourceType: 'Role',
        oldValues: expect.objectContaining({ code: 'HR_MANAGER' }),
      }),
    );
  });
});
