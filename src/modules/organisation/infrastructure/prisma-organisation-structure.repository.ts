import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  createPaginatedResult,
  getPaginationSkipTake,
} from '../../../common/utils/pagination.util';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import {
  BusinessUnitRecord,
  DepartmentRecord,
  PositionRecord,
  TeamRecord,
} from '../domain/organisation-structure.types';

@Injectable()
export class PrismaOrganisationStructureRepository {
  constructor(private readonly prisma: PrismaService) {}

  // --- Business units ---

  async createBusinessUnit(input: {
    organisationId: string;
    name: string;
    code: string;
  }): Promise<BusinessUnitRecord> {
    try {
      const created = await this.prisma.businessUnit.create({
        data: {
          organisationId: input.organisationId,
          name: input.name.trim(),
          code: input.code.trim().toUpperCase(),
        },
        include: { _count: { select: { departments: true } } },
      });
      return this.toBusinessUnit(created);
    } catch (error) {
      this.rethrowUniqueConflict(error, 'Business unit code');
      throw error;
    }
  }

  async findBusinessUnit(
    organisationId: string,
    id: string,
  ): Promise<BusinessUnitRecord | null> {
    const row = await this.prisma.businessUnit.findFirst({
      where: { id, organisationId },
      include: { _count: { select: { departments: true } } },
    });
    return row ? this.toBusinessUnit(row) : null;
  }

  async listBusinessUnits(query: {
    organisationId: string;
    page: number;
    size: number;
    search?: string;
  }) {
    const { skip, take } = getPaginationSkipTake(query.page, query.size);
    const search = query.search?.trim();
    const where: Prisma.BusinessUnitWhereInput = {
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
      this.prisma.businessUnit.count({ where }),
      this.prisma.businessUnit.findMany({
        where,
        include: { _count: { select: { departments: true } } },
        orderBy: { code: 'asc' },
        skip,
        take,
      }),
    ]);

    return createPaginatedResult(
      rows.map((row) => this.toBusinessUnit(row)),
      query.page,
      query.size,
      totalItems,
    );
  }

  async updateBusinessUnit(input: {
    organisationId: string;
    id: string;
    name?: string;
    code?: string;
  }): Promise<BusinessUnitRecord> {
    await this.requireBusinessUnit(input.organisationId, input.id);

    try {
      const updated = await this.prisma.businessUnit.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.code !== undefined
            ? { code: input.code.trim().toUpperCase() }
            : {}),
        },
        include: { _count: { select: { departments: true } } },
      });
      return this.toBusinessUnit(updated);
    } catch (error) {
      this.rethrowUniqueConflict(error, 'Business unit code');
      throw error;
    }
  }

  async deleteBusinessUnit(
    organisationId: string,
    id: string,
  ): Promise<void> {
    await this.requireBusinessUnit(organisationId, id);
    try {
      await this.prisma.businessUnit.delete({ where: { id } });
    } catch (error) {
      this.rethrowRestrictConflict(
        error,
        'Business unit has dependent departments or cost centres',
      );
      throw error;
    }
  }

  // --- Departments ---

  async createDepartment(input: {
    organisationId: string;
    businessUnitId: string;
    name: string;
    code: string;
  }): Promise<DepartmentRecord> {
    await this.requireBusinessUnit(input.organisationId, input.businessUnitId);

    try {
      const created = await this.prisma.department.create({
        data: {
          businessUnitId: input.businessUnitId,
          name: input.name.trim(),
          code: input.code.trim().toUpperCase(),
        },
        include: this.departmentInclude(),
      });
      return this.toDepartment(created);
    } catch (error) {
      this.rethrowUniqueConflict(error, 'Department code');
      throw error;
    }
  }

  async findDepartment(
    organisationId: string,
    id: string,
  ): Promise<DepartmentRecord | null> {
    const row = await this.prisma.department.findFirst({
      where: {
        id,
        businessUnit: { organisationId },
      },
      include: this.departmentInclude(),
    });
    return row ? this.toDepartment(row) : null;
  }

  async listDepartments(query: {
    organisationId: string;
    page: number;
    size: number;
    search?: string;
    businessUnitId?: string;
  }) {
    const { skip, take } = getPaginationSkipTake(query.page, query.size);
    const search = query.search?.trim();
    const where: Prisma.DepartmentWhereInput = {
      businessUnit: {
        organisationId: query.organisationId,
        ...(query.businessUnitId ? { id: query.businessUnitId } : {}),
      },
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
      this.prisma.department.count({ where }),
      this.prisma.department.findMany({
        where,
        include: this.departmentInclude(),
        orderBy: { code: 'asc' },
        skip,
        take,
      }),
    ]);

    return createPaginatedResult(
      rows.map((row) => this.toDepartment(row)),
      query.page,
      query.size,
      totalItems,
    );
  }

  async updateDepartment(input: {
    organisationId: string;
    id: string;
    name?: string;
    code?: string;
    businessUnitId?: string;
  }): Promise<DepartmentRecord> {
    const existing = await this.findDepartment(input.organisationId, input.id);
    if (!existing) {
      throw new NotFoundException('Department not found');
    }

    if (input.businessUnitId && input.businessUnitId !== existing.businessUnitId) {
      await this.requireBusinessUnit(
        input.organisationId,
        input.businessUnitId,
      );
    }

    try {
      const updated = await this.prisma.department.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.code !== undefined
            ? { code: input.code.trim().toUpperCase() }
            : {}),
          ...(input.businessUnitId !== undefined
            ? { businessUnitId: input.businessUnitId }
            : {}),
        },
        include: this.departmentInclude(),
      });
      return this.toDepartment(updated);
    } catch (error) {
      this.rethrowUniqueConflict(error, 'Department code');
      throw error;
    }
  }

  async deleteDepartment(organisationId: string, id: string): Promise<void> {
    const existing = await this.findDepartment(organisationId, id);
    if (!existing) {
      throw new NotFoundException('Department not found');
    }

    try {
      await this.prisma.department.delete({ where: { id } });
    } catch (error) {
      this.rethrowRestrictConflict(
        error,
        'Department has dependent teams, positions, or employees',
      );
      throw error;
    }
  }

  // --- Teams ---

  async createTeam(input: {
    organisationId: string;
    departmentId: string;
    name: string;
    code: string;
  }): Promise<TeamRecord> {
    await this.requireDepartmentInOrganisation(
      input.organisationId,
      input.departmentId,
    );

    try {
      const created = await this.prisma.team.create({
        data: {
          departmentId: input.departmentId,
          name: input.name.trim(),
          code: input.code.trim().toUpperCase(),
        },
        include: this.teamInclude(),
      });
      return this.toTeam(created);
    } catch (error) {
      this.rethrowUniqueConflict(error, 'Team code');
      throw error;
    }
  }

  async findTeam(
    organisationId: string,
    id: string,
  ): Promise<TeamRecord | null> {
    const row = await this.prisma.team.findFirst({
      where: {
        id,
        department: { businessUnit: { organisationId } },
      },
      include: this.teamInclude(),
    });
    return row ? this.toTeam(row) : null;
  }

  async listTeams(query: {
    organisationId: string;
    page: number;
    size: number;
    search?: string;
    departmentId?: string;
  }) {
    const { skip, take } = getPaginationSkipTake(query.page, query.size);
    const search = query.search?.trim();
    const where: Prisma.TeamWhereInput = {
      department: {
        ...(query.departmentId ? { id: query.departmentId } : {}),
        businessUnit: { organisationId: query.organisationId },
      },
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
      this.prisma.team.count({ where }),
      this.prisma.team.findMany({
        where,
        include: this.teamInclude(),
        orderBy: { code: 'asc' },
        skip,
        take,
      }),
    ]);

    return createPaginatedResult(
      rows.map((row) => this.toTeam(row)),
      query.page,
      query.size,
      totalItems,
    );
  }

  async updateTeam(input: {
    organisationId: string;
    id: string;
    name?: string;
    code?: string;
    departmentId?: string;
  }): Promise<TeamRecord> {
    const existing = await this.findTeam(input.organisationId, input.id);
    if (!existing) {
      throw new NotFoundException('Team not found');
    }

    if (input.departmentId && input.departmentId !== existing.departmentId) {
      await this.requireDepartmentInOrganisation(
        input.organisationId,
        input.departmentId,
      );
    }

    try {
      const updated = await this.prisma.team.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.code !== undefined
            ? { code: input.code.trim().toUpperCase() }
            : {}),
          ...(input.departmentId !== undefined
            ? { departmentId: input.departmentId }
            : {}),
        },
        include: this.teamInclude(),
      });
      return this.toTeam(updated);
    } catch (error) {
      this.rethrowUniqueConflict(error, 'Team code');
      throw error;
    }
  }

  async deleteTeam(organisationId: string, id: string): Promise<void> {
    const existing = await this.findTeam(organisationId, id);
    if (!existing) {
      throw new NotFoundException('Team not found');
    }

    try {
      await this.prisma.team.delete({ where: { id } });
    } catch (error) {
      this.rethrowRestrictConflict(error, 'Team has dependent employees');
      throw error;
    }
  }

  // --- Positions ---

  async createPosition(input: {
    organisationId: string;
    departmentId: string;
    title: string;
    code: string;
  }): Promise<PositionRecord> {
    await this.requireDepartmentInOrganisation(
      input.organisationId,
      input.departmentId,
    );

    try {
      const created = await this.prisma.position.create({
        data: {
          departmentId: input.departmentId,
          title: input.title.trim(),
          code: input.code.trim().toUpperCase(),
        },
        include: this.positionInclude(),
      });
      return this.toPosition(created);
    } catch (error) {
      this.rethrowUniqueConflict(error, 'Position code');
      throw error;
    }
  }

  async findPosition(
    organisationId: string,
    id: string,
  ): Promise<PositionRecord | null> {
    const row = await this.prisma.position.findFirst({
      where: {
        id,
        department: { businessUnit: { organisationId } },
      },
      include: this.positionInclude(),
    });
    return row ? this.toPosition(row) : null;
  }

  async listPositions(query: {
    organisationId: string;
    page: number;
    size: number;
    search?: string;
    departmentId?: string;
  }) {
    const { skip, take } = getPaginationSkipTake(query.page, query.size);
    const search = query.search?.trim();
    const where: Prisma.PositionWhereInput = {
      department: {
        ...(query.departmentId ? { id: query.departmentId } : {}),
        businessUnit: { organisationId: query.organisationId },
      },
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [totalItems, rows] = await this.prisma.$transaction([
      this.prisma.position.count({ where }),
      this.prisma.position.findMany({
        where,
        include: this.positionInclude(),
        orderBy: { code: 'asc' },
        skip,
        take,
      }),
    ]);

    return createPaginatedResult(
      rows.map((row) => this.toPosition(row)),
      query.page,
      query.size,
      totalItems,
    );
  }

  async updatePosition(input: {
    organisationId: string;
    id: string;
    title?: string;
    code?: string;
    departmentId?: string;
  }): Promise<PositionRecord> {
    const existing = await this.findPosition(input.organisationId, input.id);
    if (!existing) {
      throw new NotFoundException('Position not found');
    }

    if (input.departmentId && input.departmentId !== existing.departmentId) {
      await this.requireDepartmentInOrganisation(
        input.organisationId,
        input.departmentId,
      );
    }

    try {
      const updated = await this.prisma.position.update({
        where: { id: input.id },
        data: {
          ...(input.title !== undefined ? { title: input.title.trim() } : {}),
          ...(input.code !== undefined
            ? { code: input.code.trim().toUpperCase() }
            : {}),
          ...(input.departmentId !== undefined
            ? { departmentId: input.departmentId }
            : {}),
        },
        include: this.positionInclude(),
      });
      return this.toPosition(updated);
    } catch (error) {
      this.rethrowUniqueConflict(error, 'Position code');
      throw error;
    }
  }

  async deletePosition(organisationId: string, id: string): Promise<void> {
    const existing = await this.findPosition(organisationId, id);
    if (!existing) {
      throw new NotFoundException('Position not found');
    }

    try {
      await this.prisma.position.delete({ where: { id } });
    } catch (error) {
      this.rethrowRestrictConflict(
        error,
        'Position has dependent employees or requisitions',
      );
      throw error;
    }
  }

  // --- helpers ---

  private async requireBusinessUnit(
    organisationId: string,
    id: string,
  ): Promise<void> {
    const row = await this.prisma.businessUnit.findFirst({
      where: { id, organisationId },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundException('Business unit not found');
    }
  }

  private async requireDepartmentInOrganisation(
    organisationId: string,
    departmentId: string,
  ): Promise<void> {
    const row = await this.prisma.department.findFirst({
      where: {
        id: departmentId,
        businessUnit: { organisationId },
      },
      select: { id: true },
    });
    if (!row) {
      throw new BadRequestException(
        'Department does not belong to this organisation',
      );
    }
  }

  private departmentInclude() {
    return {
      businessUnit: {
        select: {
          id: true,
          code: true,
          organisationId: true,
        },
      },
      _count: {
        select: { teams: true, positions: true },
      },
    } satisfies Prisma.DepartmentInclude;
  }

  private teamInclude() {
    return {
      department: {
        select: {
          id: true,
          code: true,
          businessUnitId: true,
          businessUnit: { select: { organisationId: true } },
        },
      },
    } satisfies Prisma.TeamInclude;
  }

  private positionInclude() {
    return {
      department: {
        select: {
          id: true,
          code: true,
          businessUnitId: true,
          businessUnit: { select: { organisationId: true } },
        },
      },
    } satisfies Prisma.PositionInclude;
  }

  private toBusinessUnit(row: {
    id: string;
    organisationId: string;
    name: string;
    code: string;
    createdAt: Date;
    updatedAt: Date;
    _count: { departments: number };
  }): BusinessUnitRecord {
    return {
      id: row.id,
      organisationId: row.organisationId,
      name: row.name,
      code: row.code,
      departmentCount: row._count.departments,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toDepartment(row: {
    id: string;
    businessUnitId: string;
    name: string;
    code: string;
    createdAt: Date;
    updatedAt: Date;
    businessUnit: { id: string; code: string; organisationId: string };
    _count: { teams: number; positions: number };
  }): DepartmentRecord {
    return {
      id: row.id,
      businessUnitId: row.businessUnitId,
      businessUnitCode: row.businessUnit.code,
      organisationId: row.businessUnit.organisationId,
      name: row.name,
      code: row.code,
      teamCount: row._count.teams,
      positionCount: row._count.positions,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toTeam(row: {
    id: string;
    departmentId: string;
    name: string;
    code: string;
    department: {
      id: string;
      code: string;
      businessUnitId: string;
      businessUnit: { organisationId: string };
    };
  }): TeamRecord {
    return {
      id: row.id,
      departmentId: row.departmentId,
      departmentCode: row.department.code,
      businessUnitId: row.department.businessUnitId,
      organisationId: row.department.businessUnit.organisationId,
      name: row.name,
      code: row.code,
    };
  }

  private toPosition(row: {
    id: string;
    departmentId: string;
    title: string;
    code: string;
    department: {
      id: string;
      code: string;
      businessUnitId: string;
      businessUnit: { organisationId: string };
    };
  }): PositionRecord {
    return {
      id: row.id,
      departmentId: row.departmentId,
      departmentCode: row.department.code,
      businessUnitId: row.department.businessUnitId,
      organisationId: row.department.businessUnit.organisationId,
      title: row.title,
      code: row.code,
    };
  }

  private rethrowUniqueConflict(error: unknown, label: string): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(`${label} already exists in this parent scope`);
    }
  }

  private rethrowRestrictConflict(error: unknown, message: string): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2003' || error.code === 'P2014')
    ) {
      throw new ConflictException(message);
    }
  }
}
