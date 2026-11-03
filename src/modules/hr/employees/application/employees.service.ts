import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PaginatedResult } from '../../../../common/interfaces/pagination.interface';
import { AuditService } from '../../../audit/application/audit.service';
import { AuditAction } from '../../../audit/domain/audit-action.enum';
import { AuthenticatedUser } from '../../../authorization/domain/authenticated-user.interface';
import { canTransitionEmploymentStatus } from '../domain/employment-status.transitions';
import {
  EMPLOYEE_REPOSITORY,
  EmployeeRepository,
} from '../domain/employee.repository';
import { EmployeeRecord } from '../domain/employee.types';
import { ChangeEmployeeStatusDto } from '../dto/change-employee-status.dto';
import { CreateEmployeeDto } from '../dto/create-employee.dto';
import { ListEmployeesQueryDto } from '../dto/list-employees-query.dto';
import { UpdateEmployeeDto } from '../dto/update-employee.dto';
import { EmploymentStatus } from '../../../../generated/prisma/client';

@Injectable()
export class EmployeesService {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY)
    private readonly employeeRepository: EmployeeRepository,
    private readonly auditService: AuditService,
  ) {}

  async create(
    actor: AuthenticatedUser,
    dto: CreateEmployeeDto,
  ): Promise<EmployeeRecord> {
    const organisationId = this.requireOrganisationId(actor);
    this.assertHireDates(dto.hireDate, dto.terminationDate);

    const created = await this.employeeRepository.create({
      organisationId,
      employeeNumber: dto.employeeNumber,
      firstName: dto.firstName,
      lastName: dto.lastName,
      preferredName: dto.preferredName,
      workEmail: dto.workEmail,
      phone: dto.phone,
      departmentId: dto.departmentId,
      jobTitle: dto.jobTitle,
      positionId: dto.positionId,
      teamId: dto.teamId,
      employmentType: dto.employmentType,
      status: dto.status,
      hireDate: dto.hireDate,
      terminationDate: dto.terminationDate,
      managerId: dto.managerId,
      userAccountId: dto.userAccountId,
    });

    await this.auditService.record({
      action: AuditAction.CREATE,
      resourceType: 'Employee',
      resourceId: created.id,
      actorId: actor.id,
      organisationId,
      newValues: this.toAuditSnapshot(created),
    });

    return created;
  }

  async findOne(
    actor: AuthenticatedUser,
    employeeId: string,
  ): Promise<EmployeeRecord> {
    const organisationId = this.requireOrganisationId(actor);
    const employee = await this.employeeRepository.findByIdInOrganisation(
      organisationId,
      employeeId,
    );
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    return employee;
  }

  async list(
    actor: AuthenticatedUser,
    query: ListEmployeesQueryDto,
  ): Promise<PaginatedResult<EmployeeRecord>> {
    const organisationId = this.requireOrganisationId(actor);
    return this.employeeRepository.list({
      organisationId,
      page: query.page,
      size: query.size,
      search: query.search,
      departmentId: query.departmentId,
      status: query.status,
      employmentType: query.employmentType,
      managerId: query.managerId,
    });
  }

  async update(
    actor: AuthenticatedUser,
    employeeId: string,
    dto: UpdateEmployeeDto,
  ): Promise<EmployeeRecord> {
    const organisationId = this.requireOrganisationId(actor);
    const existing = await this.employeeRepository.findByIdInOrganisation(
      organisationId,
      employeeId,
    );
    if (!existing) {
      throw new NotFoundException('Employee not found');
    }

    this.assertHireDates(
      dto.hireDate ?? existing.hireDate,
      dto.terminationDate === undefined
        ? (existing.terminationDate ?? undefined)
        : (dto.terminationDate ?? undefined),
    );

    const updated = await this.employeeRepository.update({
      organisationId,
      employeeId,
      ...dto,
    });

    await this.auditService.record({
      action: AuditAction.UPDATE,
      resourceType: 'Employee',
      resourceId: updated.id,
      actorId: actor.id,
      organisationId,
      oldValues: this.toAuditSnapshot(existing),
      newValues: this.toAuditSnapshot(updated),
    });

    return updated;
  }

  async changeStatus(
    actor: AuthenticatedUser,
    employeeId: string,
    dto: ChangeEmployeeStatusDto,
  ): Promise<EmployeeRecord> {
    const organisationId = this.requireOrganisationId(actor);
    const existing = await this.employeeRepository.findByIdInOrganisation(
      organisationId,
      employeeId,
    );
    if (!existing) {
      throw new NotFoundException('Employee not found');
    }

    if (!canTransitionEmploymentStatus(existing.status, dto.status)) {
      throw new BadRequestException(
        `Cannot change employment status from ${existing.status} to ${dto.status}`,
      );
    }

    if (
      dto.status === EmploymentStatus.TERMINATED &&
      dto.terminationDate === undefined &&
      !existing.terminationDate
    ) {
      // repository defaults terminationDate to now
    }

    if (
      dto.status !== EmploymentStatus.TERMINATED &&
      dto.terminationDate != null
    ) {
      throw new BadRequestException(
        'terminationDate is only valid when status is TERMINATED',
      );
    }

    const updated = await this.employeeRepository.changeStatus({
      organisationId,
      employeeId,
      status: dto.status,
      terminationDate: dto.terminationDate,
      reason: dto.reason,
    });

    await this.auditService.record({
      action: AuditAction.UPDATE,
      resourceType: 'Employee',
      resourceId: updated.id,
      actorId: actor.id,
      organisationId,
      reason: dto.reason,
      oldValues: {
        status: existing.status,
        terminationDate: existing.terminationDate?.toISOString() ?? null,
      },
      newValues: {
        status: updated.status,
        terminationDate: updated.terminationDate?.toISOString() ?? null,
      },
    });

    return updated;
  }

  private requireOrganisationId(actor: AuthenticatedUser): string {
    const organisationId = actor.organisationId?.trim();
    if (!organisationId) {
      throw new UnauthorizedException('Organisation context is required');
    }
    return organisationId;
  }

  private assertHireDates(hireDate: Date, terminationDate?: Date | null): void {
    if (terminationDate && terminationDate.getTime() < hireDate.getTime()) {
      throw new BadRequestException(
        'terminationDate must be on or after hireDate',
      );
    }
  }

  private toAuditSnapshot(employee: EmployeeRecord): Record<string, unknown> {
    return {
      employeeNumber: employee.employeeNumber,
      workEmail: employee.workEmail,
      departmentId: employee.departmentId,
      jobTitle: employee.jobTitle,
      employmentType: employee.employmentType,
      status: employee.status,
      managerId: employee.managerId,
      userAccountId: employee.userAccountId,
      hireDate: employee.hireDate.toISOString(),
      terminationDate: employee.terminationDate?.toISOString() ?? null,
    };
  }
}
