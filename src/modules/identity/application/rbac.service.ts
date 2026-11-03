import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PaginatedResult } from '../../../common/interfaces/pagination.interface';
import { AuditService } from '../../audit/application/audit.service';
import { AuditAction } from '../../audit/domain/audit-action.enum';
import { AuthenticatedUser } from '../../authorization/domain/authenticated-user.interface';
import {
  AssignPermissionsDto,
  AssignRoleDto,
  CreateRoleDto,
  ListRolesQueryDto,
  ListUserRolesQueryDto,
  UpdateRoleDto,
} from '../dto/rbac.dto';
import {
  RoleAssignmentRecord,
  RoleRecord,
} from '../domain/rbac.types';
import { PrismaRbacRepository } from '../infrastructure/prisma-rbac.repository';

@Injectable()
export class RbacService {
  constructor(
    private readonly rbacRepository: PrismaRbacRepository,
    private readonly auditService: AuditService,
  ) {}

  async createRole(
    actor: AuthenticatedUser,
    dto: CreateRoleDto,
  ): Promise<RoleRecord> {
    const organisationId = this.requireOrganisationId(actor);
    const created = await this.rbacRepository.createRole({
      organisationId,
      name: dto.name,
      code: dto.code,
      permissionCodes: dto.permissionCodes,
    });

    await this.auditService.record({
      action: AuditAction.CREATE,
      resourceType: 'Role',
      resourceId: created.id,
      actorId: actor.id,
      organisationId,
      newValues: this.roleSnapshot(created),
    });

    return created;
  }

  async listRoles(
    actor: AuthenticatedUser,
    query: ListRolesQueryDto,
  ): Promise<PaginatedResult<RoleRecord>> {
    const organisationId = this.requireOrganisationId(actor);
    return this.rbacRepository.listRoles({
      organisationId,
      page: query.page,
      size: query.size,
      search: query.search,
    });
  }

  async getRole(
    actor: AuthenticatedUser,
    roleId: string,
  ): Promise<RoleRecord> {
    const organisationId = this.requireOrganisationId(actor);
    const role = await this.rbacRepository.findRole(organisationId, roleId);
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }

  async updateRole(
    actor: AuthenticatedUser,
    roleId: string,
    dto: UpdateRoleDto,
  ): Promise<RoleRecord> {
    const organisationId = this.requireOrganisationId(actor);
    const before = await this.rbacRepository.findRole(organisationId, roleId);
    if (!before) {
      throw new NotFoundException('Role not found');
    }

    const updated = await this.rbacRepository.updateRole({
      organisationId,
      roleId,
      name: dto.name,
    });

    await this.auditService.record({
      action: AuditAction.UPDATE,
      resourceType: 'Role',
      resourceId: updated.id,
      actorId: actor.id,
      organisationId,
      oldValues: this.roleSnapshot(before),
      newValues: this.roleSnapshot(updated),
    });

    return updated;
  }

  async deleteRole(actor: AuthenticatedUser, roleId: string): Promise<void> {
    const organisationId = this.requireOrganisationId(actor);
    const before = await this.rbacRepository.findRole(organisationId, roleId);
    if (!before) {
      throw new NotFoundException('Role not found');
    }

    await this.rbacRepository.deleteRole(organisationId, roleId);

    await this.auditService.record({
      action: AuditAction.DELETE,
      resourceType: 'Role',
      resourceId: roleId,
      actorId: actor.id,
      organisationId,
      oldValues: this.roleSnapshot(before),
    });
  }

  async assignPermissions(
    actor: AuthenticatedUser,
    roleId: string,
    dto: AssignPermissionsDto,
  ): Promise<RoleRecord> {
    const organisationId = this.requireOrganisationId(actor);
    const updated = await this.rbacRepository.assignPermissions({
      organisationId,
      roleId,
      permissionCodes: dto.permissionCodes,
    });

    await this.auditService.record({
      action: AuditAction.ASSIGN,
      resourceType: 'RolePermission',
      resourceId: roleId,
      actorId: actor.id,
      organisationId,
      newValues: {
        roleId,
        permissionCodes: dto.permissionCodes,
        permissions: updated.permissions.map((item) => item.code),
      },
    });

    return updated;
  }

  async removePermission(
    actor: AuthenticatedUser,
    roleId: string,
    permissionCode: string,
  ): Promise<RoleRecord> {
    const organisationId = this.requireOrganisationId(actor);
    const updated = await this.rbacRepository.removePermission({
      organisationId,
      roleId,
      permissionCode,
    });

    await this.auditService.record({
      action: AuditAction.UNASSIGN,
      resourceType: 'RolePermission',
      resourceId: roleId,
      actorId: actor.id,
      organisationId,
      oldValues: { permissionCode },
      newValues: {
        permissions: updated.permissions.map((item) => item.code),
      },
    });

    return updated;
  }

  async assignRoleToUser(
    actor: AuthenticatedUser,
    userId: string,
    dto: AssignRoleDto,
  ): Promise<RoleAssignmentRecord> {
    const organisationId = this.requireOrganisationId(actor);
    const assignment = await this.rbacRepository.assignRoleToUser({
      organisationId,
      userId,
      roleId: dto.roleId,
    });

    await this.auditService.record({
      action: AuditAction.ASSIGN,
      resourceType: 'RoleAssignment',
      resourceId: assignment.id,
      actorId: actor.id,
      organisationId,
      newValues: this.assignmentSnapshot(assignment),
    });

    return assignment;
  }

  async removeRoleFromUser(
    actor: AuthenticatedUser,
    userId: string,
    roleId: string,
  ): Promise<RoleAssignmentRecord> {
    const organisationId = this.requireOrganisationId(actor);
    const assignment = await this.rbacRepository.removeRoleFromUser({
      organisationId,
      userId,
      roleId,
    });

    await this.auditService.record({
      action: AuditAction.UNASSIGN,
      resourceType: 'RoleAssignment',
      resourceId: assignment.id,
      actorId: actor.id,
      organisationId,
      newValues: this.assignmentSnapshot(assignment),
    });

    return assignment;
  }

  async listUserRoles(
    actor: AuthenticatedUser,
    userId: string,
    query: ListUserRolesQueryDto,
  ): Promise<PaginatedResult<RoleAssignmentRecord>> {
    const organisationId = this.requireOrganisationId(actor);
    return this.rbacRepository.listUserRoles({
      organisationId,
      userId,
      page: query.page,
      size: query.size,
      includeEnded: query.includeEnded,
    });
  }

  private requireOrganisationId(actor: AuthenticatedUser): string {
    const organisationId = actor.organisationId?.trim();
    if (!organisationId) {
      throw new UnauthorizedException('Organisation context is required');
    }
    return organisationId;
  }

  private roleSnapshot(role: RoleRecord) {
    return {
      code: role.code,
      name: role.name,
      permissionCodes: role.permissions.map((item) => item.code),
      assignmentCount: role.assignmentCount,
    };
  }

  private assignmentSnapshot(assignment: RoleAssignmentRecord) {
    return {
      userId: assignment.userId,
      roleId: assignment.roleId,
      roleCode: assignment.roleCode,
      startsAt: assignment.startsAt.toISOString(),
      endsAt: assignment.endsAt?.toISOString() ?? null,
    };
  }
}
