import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import {
  createPaginatedResult,
  getPaginationSkipTake,
} from '../../../common/utils/pagination.util';
import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  RoleAssignmentRecord,
  RolePermissionSummary,
  RoleRecord,
} from '../domain/rbac.types';

type RoleRow = {
  id: string;
  organisationId: string;
  name: string;
  code: string;
  permissions: Array<{
    permission: {
      id: string;
      code: string;
      description: string | null;
    };
  }>;
  _count: { assignments: number };
};

@Injectable()
export class PrismaRbacRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createRole(input: {
    organisationId: string;
    name: string;
    code: string;
    permissionCodes?: string[];
  }): Promise<RoleRecord> {
    const permissionIds = await this.resolvePermissionIds(
      input.permissionCodes ?? [],
    );

    try {
      const created = await this.prisma.role.create({
        data: {
          organisationId: input.organisationId,
          name: input.name.trim(),
          code: input.code.trim().toUpperCase(),
          permissions:
            permissionIds.length > 0
              ? {
                  create: permissionIds.map((permissionId) => ({
                    permissionId,
                  })),
                }
              : undefined,
        },
        include: this.roleInclude(),
      });
      return this.toRoleRecord(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Role code already exists in this organisation',
        );
      }
      throw error;
    }
  }

  async findRole(
    organisationId: string,
    roleId: string,
  ): Promise<RoleRecord | null> {
    const row = await this.prisma.role.findFirst({
      where: { id: roleId, organisationId },
      include: this.roleInclude(),
    });
    return row ? this.toRoleRecord(row) : null;
  }

  async listRoles(query: {
    organisationId: string;
    page: number;
    size: number;
    search?: string;
  }) {
    const { skip, take } = getPaginationSkipTake(query.page, query.size);
    const search = query.search?.trim();
    const where: Prisma.RoleWhereInput = {
      organisationId: query.organisationId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [totalItems, rows] = await this.prisma.$transaction([
      this.prisma.role.count({ where }),
      this.prisma.role.findMany({
        where,
        include: this.roleInclude(),
        orderBy: [{ code: 'asc' }],
        skip,
        take,
      }),
    ]);

    return createPaginatedResult(
      rows.map((row) => this.toRoleRecord(row)),
      query.page,
      query.size,
      totalItems,
    );
  }

  async updateRole(input: {
    organisationId: string;
    roleId: string;
    name?: string;
  }): Promise<RoleRecord> {
    const existing = await this.prisma.role.findFirst({
      where: { id: input.roleId, organisationId: input.organisationId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Role not found');
    }

    const updated = await this.prisma.role.update({
      where: { id: input.roleId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      },
      include: this.roleInclude(),
    });
    return this.toRoleRecord(updated);
  }

  async deleteRole(organisationId: string, roleId: string): Promise<void> {
    const existing = await this.prisma.role.findFirst({
      where: { id: roleId, organisationId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Role not found');
    }

    await this.prisma.role.delete({ where: { id: roleId } });
  }

  async assignPermissions(input: {
    organisationId: string;
    roleId: string;
    permissionCodes: string[];
  }): Promise<RoleRecord> {
    const role = await this.requireRole(input.organisationId, input.roleId);
    const permissionIds = await this.resolvePermissionIds(input.permissionCodes);

    if (permissionIds.length > 0) {
      await this.prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
        skipDuplicates: true,
      });
    }

    const refreshed = await this.findRole(input.organisationId, input.roleId);
    if (!refreshed) {
      throw new NotFoundException('Role not found');
    }
    return refreshed;
  }

  async removePermission(input: {
    organisationId: string;
    roleId: string;
    permissionCode: string;
  }): Promise<RoleRecord> {
    const role = await this.requireRole(input.organisationId, input.roleId);
    const permission = await this.prisma.permission.findUnique({
      where: { code: input.permissionCode },
      select: { id: true },
    });
    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    await this.prisma.rolePermission.deleteMany({
      where: {
        roleId: role.id,
        permissionId: permission.id,
      },
    });

    const refreshed = await this.findRole(input.organisationId, input.roleId);
    if (!refreshed) {
      throw new NotFoundException('Role not found');
    }
    return refreshed;
  }

  async assignRoleToUser(input: {
    organisationId: string;
    userId: string;
    roleId: string;
  }): Promise<RoleAssignmentRecord> {
    await this.requireUserInOrganisation(input.organisationId, input.userId);
    await this.requireRole(input.organisationId, input.roleId);

    const active = await this.prisma.roleAssignment.findFirst({
      where: {
        userId: input.userId,
        roleId: input.roleId,
        OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
      },
      include: {
        role: { select: { code: true, name: true } },
      },
    });

    if (active) {
      throw new ConflictException('User already has this role assigned');
    }

    const created = await this.prisma.roleAssignment.create({
      data: {
        userId: input.userId,
        roleId: input.roleId,
      },
      include: {
        role: { select: { code: true, name: true } },
      },
    });

    return this.toAssignmentRecord(created);
  }

  async removeRoleFromUser(input: {
    organisationId: string;
    userId: string;
    roleId: string;
  }): Promise<RoleAssignmentRecord> {
    await this.requireUserInOrganisation(input.organisationId, input.userId);
    await this.requireRole(input.organisationId, input.roleId);

    const active = await this.prisma.roleAssignment.findFirst({
      where: {
        userId: input.userId,
        roleId: input.roleId,
        OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
      },
      include: {
        role: { select: { code: true, name: true } },
      },
      orderBy: { startsAt: 'desc' },
    });

    if (!active) {
      throw new NotFoundException('Active role assignment not found');
    }

    const ended = await this.prisma.roleAssignment.update({
      where: { id: active.id },
      data: { endsAt: new Date() },
      include: {
        role: { select: { code: true, name: true } },
      },
    });

    return this.toAssignmentRecord(ended);
  }

  async listUserRoles(input: {
    organisationId: string;
    userId: string;
    page: number;
    size: number;
    includeEnded?: boolean;
  }) {
    await this.requireUserInOrganisation(input.organisationId, input.userId);
    const { skip, take } = getPaginationSkipTake(input.page, input.size);
    const now = new Date();
    const where: Prisma.RoleAssignmentWhereInput = {
      userId: input.userId,
      role: { organisationId: input.organisationId },
      ...(input.includeEnded
        ? {}
        : {
            OR: [{ endsAt: null }, { endsAt: { gt: now } }],
          }),
    };

    const [totalItems, rows] = await this.prisma.$transaction([
      this.prisma.roleAssignment.count({ where }),
      this.prisma.roleAssignment.findMany({
        where,
        include: {
          role: { select: { code: true, name: true } },
        },
        orderBy: { startsAt: 'desc' },
        skip,
        take,
      }),
    ]);

    return createPaginatedResult(
      rows.map((row) => this.toAssignmentRecord(row)),
      input.page,
      input.size,
      totalItems,
    );
  }

  private async requireRole(organisationId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organisationId },
      select: { id: true },
    });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }

  private async requireUserInOrganisation(
    organisationId: string,
    userId: string,
  ): Promise<void> {
    const user = await this.prisma.userAccount.findFirst({
      where: { id: userId, organisationId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('User not found in this organisation');
    }
  }

  private async resolvePermissionIds(codes: string[]): Promise<string[]> {
    const uniqueCodes = [
      ...new Set(codes.map((code) => code.trim()).filter((code) => code)),
    ];
    if (uniqueCodes.length === 0) {
      return [];
    }

    const permissions = await this.prisma.permission.findMany({
      where: { code: { in: uniqueCodes } },
      select: { id: true, code: true },
    });

    if (permissions.length !== uniqueCodes.length) {
      const found = new Set(permissions.map((item) => item.code));
      const missing = uniqueCodes.filter((code) => !found.has(code));
      throw new BadRequestException(
        `Unknown permission codes: ${missing.join(', ')}. Sync the catalogue first.`,
      );
    }

    return permissions.map((item) => item.id);
  }

  private roleInclude() {
    return {
      permissions: {
        include: {
          permission: {
            select: {
              id: true,
              code: true,
              description: true,
            },
          },
        },
      },
      _count: {
        select: { assignments: true },
      },
    } satisfies Prisma.RoleInclude;
  }

  private toRoleRecord(row: RoleRow): RoleRecord {
    const permissions: RolePermissionSummary[] = row.permissions
      .map((item) => ({
        id: item.permission.id,
        code: item.permission.code,
        description: item.permission.description,
      }))
      .sort((a, b) => a.code.localeCompare(b.code));

    return {
      id: row.id,
      organisationId: row.organisationId,
      name: row.name,
      code: row.code,
      permissions,
      assignmentCount: row._count.assignments,
    };
  }

  private toAssignmentRecord(row: {
    id: string;
    userId: string;
    roleId: string;
    startsAt: Date;
    endsAt: Date | null;
    role: { code: string; name: string };
  }): RoleAssignmentRecord {
    return {
      id: row.id,
      userId: row.userId,
      roleId: row.roleId,
      roleCode: row.role.code,
      roleName: row.role.name,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
    };
  }
}
