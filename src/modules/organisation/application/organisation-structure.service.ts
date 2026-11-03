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
  CreateBusinessUnitDto,
  CreateDepartmentDto,
  CreatePositionDto,
  CreateTeamDto,
  ListBusinessUnitsQueryDto,
  ListDepartmentsQueryDto,
  ListPositionsQueryDto,
  ListTeamsQueryDto,
  UpdateBusinessUnitDto,
  UpdateDepartmentDto,
  UpdatePositionDto,
  UpdateTeamDto,
} from '../dto/organisation-structure.dto';
import {
  BusinessUnitRecord,
  DepartmentRecord,
  PositionRecord,
  TeamRecord,
} from '../domain/organisation-structure.types';
import { PrismaOrganisationStructureRepository } from '../infrastructure/prisma-organisation-structure.repository';

@Injectable()
export class OrganisationStructureService {
  constructor(
    private readonly repository: PrismaOrganisationStructureRepository,
    private readonly auditService: AuditService,
  ) {}

  // --- Business units ---

  async createBusinessUnit(
    actor: AuthenticatedUser,
    dto: CreateBusinessUnitDto,
  ): Promise<BusinessUnitRecord> {
    const organisationId = this.requireOrganisationId(actor);
    const created = await this.repository.createBusinessUnit({
      organisationId,
      name: dto.name,
      code: dto.code,
    });
    await this.auditService.record({
      action: AuditAction.CREATE,
      resourceType: 'BusinessUnit',
      resourceId: created.id,
      actorId: actor.id,
      organisationId,
      newValues: this.businessUnitSnapshot(created),
    });
    return created;
  }

  async listBusinessUnits(
    actor: AuthenticatedUser,
    query: ListBusinessUnitsQueryDto,
  ): Promise<PaginatedResult<BusinessUnitRecord>> {
    const organisationId = this.requireOrganisationId(actor);
    return this.repository.listBusinessUnits({
      organisationId,
      page: query.page,
      size: query.size,
      search: query.search,
    });
  }

  async getBusinessUnit(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<BusinessUnitRecord> {
    const organisationId = this.requireOrganisationId(actor);
    const record = await this.repository.findBusinessUnit(organisationId, id);
    if (!record) {
      throw new NotFoundException('Business unit not found');
    }
    return record;
  }

  async updateBusinessUnit(
    actor: AuthenticatedUser,
    id: string,
    dto: UpdateBusinessUnitDto,
  ): Promise<BusinessUnitRecord> {
    const organisationId = this.requireOrganisationId(actor);
    const before = await this.repository.findBusinessUnit(organisationId, id);
    if (!before) {
      throw new NotFoundException('Business unit not found');
    }
    const updated = await this.repository.updateBusinessUnit({
      organisationId,
      id,
      name: dto.name,
      code: dto.code,
    });
    await this.auditService.record({
      action: AuditAction.UPDATE,
      resourceType: 'BusinessUnit',
      resourceId: id,
      actorId: actor.id,
      organisationId,
      oldValues: this.businessUnitSnapshot(before),
      newValues: this.businessUnitSnapshot(updated),
    });
    return updated;
  }

  async deleteBusinessUnit(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<BusinessUnitRecord> {
    const organisationId = this.requireOrganisationId(actor);
    const before = await this.repository.findBusinessUnit(organisationId, id);
    if (!before) {
      throw new NotFoundException('Business unit not found');
    }
    await this.repository.deleteBusinessUnit(organisationId, id);
    await this.auditService.record({
      action: AuditAction.DELETE,
      resourceType: 'BusinessUnit',
      resourceId: id,
      actorId: actor.id,
      organisationId,
      oldValues: this.businessUnitSnapshot(before),
    });
    return before;
  }

  // --- Departments ---

  async createDepartment(
    actor: AuthenticatedUser,
    dto: CreateDepartmentDto,
  ): Promise<DepartmentRecord> {
    const organisationId = this.requireOrganisationId(actor);
    const created = await this.repository.createDepartment({
      organisationId,
      businessUnitId: dto.businessUnitId,
      name: dto.name,
      code: dto.code,
    });
    await this.auditService.record({
      action: AuditAction.CREATE,
      resourceType: 'Department',
      resourceId: created.id,
      actorId: actor.id,
      organisationId,
      newValues: this.departmentSnapshot(created),
    });
    return created;
  }

  async listDepartments(
    actor: AuthenticatedUser,
    query: ListDepartmentsQueryDto,
  ): Promise<PaginatedResult<DepartmentRecord>> {
    const organisationId = this.requireOrganisationId(actor);
    return this.repository.listDepartments({
      organisationId,
      page: query.page,
      size: query.size,
      search: query.search,
      businessUnitId: query.businessUnitId,
    });
  }

  async getDepartment(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<DepartmentRecord> {
    const organisationId = this.requireOrganisationId(actor);
    const record = await this.repository.findDepartment(organisationId, id);
    if (!record) {
      throw new NotFoundException('Department not found');
    }
    return record;
  }

  async updateDepartment(
    actor: AuthenticatedUser,
    id: string,
    dto: UpdateDepartmentDto,
  ): Promise<DepartmentRecord> {
    const organisationId = this.requireOrganisationId(actor);
    const before = await this.repository.findDepartment(organisationId, id);
    if (!before) {
      throw new NotFoundException('Department not found');
    }
    const updated = await this.repository.updateDepartment({
      organisationId,
      id,
      name: dto.name,
      code: dto.code,
      businessUnitId: dto.businessUnitId,
    });
    await this.auditService.record({
      action: AuditAction.UPDATE,
      resourceType: 'Department',
      resourceId: id,
      actorId: actor.id,
      organisationId,
      oldValues: this.departmentSnapshot(before),
      newValues: this.departmentSnapshot(updated),
    });
    return updated;
  }

  async deleteDepartment(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<DepartmentRecord> {
    const organisationId = this.requireOrganisationId(actor);
    const before = await this.repository.findDepartment(organisationId, id);
    if (!before) {
      throw new NotFoundException('Department not found');
    }
    await this.repository.deleteDepartment(organisationId, id);
    await this.auditService.record({
      action: AuditAction.DELETE,
      resourceType: 'Department',
      resourceId: id,
      actorId: actor.id,
      organisationId,
      oldValues: this.departmentSnapshot(before),
    });
    return before;
  }

  // --- Teams ---

  async createTeam(
    actor: AuthenticatedUser,
    dto: CreateTeamDto,
  ): Promise<TeamRecord> {
    const organisationId = this.requireOrganisationId(actor);
    const created = await this.repository.createTeam({
      organisationId,
      departmentId: dto.departmentId,
      name: dto.name,
      code: dto.code,
    });
    await this.auditService.record({
      action: AuditAction.CREATE,
      resourceType: 'Team',
      resourceId: created.id,
      actorId: actor.id,
      organisationId,
      newValues: this.teamSnapshot(created),
    });
    return created;
  }

  async listTeams(
    actor: AuthenticatedUser,
    query: ListTeamsQueryDto,
  ): Promise<PaginatedResult<TeamRecord>> {
    const organisationId = this.requireOrganisationId(actor);
    return this.repository.listTeams({
      organisationId,
      page: query.page,
      size: query.size,
      search: query.search,
      departmentId: query.departmentId,
    });
  }

  async getTeam(actor: AuthenticatedUser, id: string): Promise<TeamRecord> {
    const organisationId = this.requireOrganisationId(actor);
    const record = await this.repository.findTeam(organisationId, id);
    if (!record) {
      throw new NotFoundException('Team not found');
    }
    return record;
  }

  async updateTeam(
    actor: AuthenticatedUser,
    id: string,
    dto: UpdateTeamDto,
  ): Promise<TeamRecord> {
    const organisationId = this.requireOrganisationId(actor);
    const before = await this.repository.findTeam(organisationId, id);
    if (!before) {
      throw new NotFoundException('Team not found');
    }
    const updated = await this.repository.updateTeam({
      organisationId,
      id,
      name: dto.name,
      code: dto.code,
      departmentId: dto.departmentId,
    });
    await this.auditService.record({
      action: AuditAction.UPDATE,
      resourceType: 'Team',
      resourceId: id,
      actorId: actor.id,
      organisationId,
      oldValues: this.teamSnapshot(before),
      newValues: this.teamSnapshot(updated),
    });
    return updated;
  }

  async deleteTeam(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<TeamRecord> {
    const organisationId = this.requireOrganisationId(actor);
    const before = await this.repository.findTeam(organisationId, id);
    if (!before) {
      throw new NotFoundException('Team not found');
    }
    await this.repository.deleteTeam(organisationId, id);
    await this.auditService.record({
      action: AuditAction.DELETE,
      resourceType: 'Team',
      resourceId: id,
      actorId: actor.id,
      organisationId,
      oldValues: this.teamSnapshot(before),
    });
    return before;
  }

  // --- Positions ---

  async createPosition(
    actor: AuthenticatedUser,
    dto: CreatePositionDto,
  ): Promise<PositionRecord> {
    const organisationId = this.requireOrganisationId(actor);
    const created = await this.repository.createPosition({
      organisationId,
      departmentId: dto.departmentId,
      title: dto.title,
      code: dto.code,
    });
    await this.auditService.record({
      action: AuditAction.CREATE,
      resourceType: 'Position',
      resourceId: created.id,
      actorId: actor.id,
      organisationId,
      newValues: this.positionSnapshot(created),
    });
    return created;
  }

  async listPositions(
    actor: AuthenticatedUser,
    query: ListPositionsQueryDto,
  ): Promise<PaginatedResult<PositionRecord>> {
    const organisationId = this.requireOrganisationId(actor);
    return this.repository.listPositions({
      organisationId,
      page: query.page,
      size: query.size,
      search: query.search,
      departmentId: query.departmentId,
    });
  }

  async getPosition(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<PositionRecord> {
    const organisationId = this.requireOrganisationId(actor);
    const record = await this.repository.findPosition(organisationId, id);
    if (!record) {
      throw new NotFoundException('Position not found');
    }
    return record;
  }

  async updatePosition(
    actor: AuthenticatedUser,
    id: string,
    dto: UpdatePositionDto,
  ): Promise<PositionRecord> {
    const organisationId = this.requireOrganisationId(actor);
    const before = await this.repository.findPosition(organisationId, id);
    if (!before) {
      throw new NotFoundException('Position not found');
    }
    const updated = await this.repository.updatePosition({
      organisationId,
      id,
      title: dto.title,
      code: dto.code,
      departmentId: dto.departmentId,
    });
    await this.auditService.record({
      action: AuditAction.UPDATE,
      resourceType: 'Position',
      resourceId: id,
      actorId: actor.id,
      organisationId,
      oldValues: this.positionSnapshot(before),
      newValues: this.positionSnapshot(updated),
    });
    return updated;
  }

  async deletePosition(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<PositionRecord> {
    const organisationId = this.requireOrganisationId(actor);
    const before = await this.repository.findPosition(organisationId, id);
    if (!before) {
      throw new NotFoundException('Position not found');
    }
    await this.repository.deletePosition(organisationId, id);
    await this.auditService.record({
      action: AuditAction.DELETE,
      resourceType: 'Position',
      resourceId: id,
      actorId: actor.id,
      organisationId,
      oldValues: this.positionSnapshot(before),
    });
    return before;
  }

  private requireOrganisationId(actor: AuthenticatedUser): string {
    const organisationId = actor.organisationId?.trim();
    if (!organisationId) {
      throw new UnauthorizedException('Organisation context is required');
    }
    return organisationId;
  }

  private businessUnitSnapshot(record: BusinessUnitRecord) {
    return {
      code: record.code,
      name: record.name,
      departmentCount: record.departmentCount,
    };
  }

  private departmentSnapshot(record: DepartmentRecord) {
    return {
      code: record.code,
      name: record.name,
      businessUnitId: record.businessUnitId,
    };
  }

  private teamSnapshot(record: TeamRecord) {
    return {
      code: record.code,
      name: record.name,
      departmentId: record.departmentId,
    };
  }

  private positionSnapshot(record: PositionRecord) {
    return {
      code: record.code,
      title: record.title,
      departmentId: record.departmentId,
    };
  }
}
