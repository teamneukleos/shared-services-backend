import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PaginatedResult } from '../../../common/interfaces/pagination.interface';
import { AuditService } from '../../audit/application/audit.service';
import { AuditAction } from '../../audit/domain/audit-action.enum';
import { AuthenticatedUser } from '../../authorization/domain/authenticated-user.interface';
import {
  LeaveApplicationRecord,
  LeaveBalanceRecord,
  LeaveTypeRecord,
} from '../domain/leave.types';
import {
  CreateLeaveApplicationDto,
  ListLeaveApplicationsQueryDto,
  RejectLeaveApplicationDto,
} from '../dto/leave-application.dto';
import {
  CreateLeaveBalanceDto,
  ListLeaveBalancesQueryDto,
} from '../dto/leave-balance.dto';
import {
  CreateLeaveTypeDto,
  ListLeaveTypesQueryDto,
  UpdateLeaveTypeDto,
} from '../dto/leave-type.dto';
import { PrismaLeaveRepository } from '../infrastructure/prisma-leave.repository';

@Injectable()
export class LeaveService {
  constructor(
    private readonly leaveRepository: PrismaLeaveRepository,
    private readonly auditService: AuditService,
  ) {}

  async createLeaveType(actor: AuthenticatedUser, dto: CreateLeaveTypeDto) {
    const organisationId = this.requireOrganisationId(actor);
    const created = await this.leaveRepository.createLeaveType({
      organisationId,
      ...dto,
    });
    await this.auditService.record({
      action: AuditAction.CREATE,
      resourceType: 'LeaveType',
      resourceId: created.id,
      actorId: actor.id,
      organisationId,
      newValues: this.typeSnapshot(created),
    });
    return created;
  }

  async listLeaveTypes(
    actor: AuthenticatedUser,
    query: ListLeaveTypesQueryDto,
  ) {
    return this.leaveRepository.listLeaveTypes({
      organisationId: this.requireOrganisationId(actor),
      page: query.page,
      size: query.size,
      status: query.status,
    });
  }

  async getLeaveType(actor: AuthenticatedUser, id: string) {
    const organisationId = this.requireOrganisationId(actor);
    const record = await this.leaveRepository.findLeaveType(organisationId, id);
    if (!record) {
      throw new NotFoundException('Leave type not found');
    }
    return record;
  }

  async updateLeaveType(
    actor: AuthenticatedUser,
    id: string,
    dto: UpdateLeaveTypeDto,
  ) {
    const organisationId = this.requireOrganisationId(actor);
    const existing = await this.getLeaveType(actor, id);
    const updated = await this.leaveRepository.updateLeaveType({
      organisationId,
      id,
      ...dto,
    });
    await this.auditService.record({
      action: AuditAction.UPDATE,
      resourceType: 'LeaveType',
      resourceId: updated.id,
      actorId: actor.id,
      organisationId,
      oldValues: this.typeSnapshot(existing),
      newValues: this.typeSnapshot(updated),
    });
    return updated;
  }

  async createLeaveBalance(
    actor: AuthenticatedUser,
    dto: CreateLeaveBalanceDto,
  ) {
    const organisationId = this.requireOrganisationId(actor);
    const created = await this.leaveRepository.createLeaveBalance({
      organisationId,
      employeeId: dto.employeeId,
      leaveTypeId: dto.leaveTypeId,
      entitled: dto.entitled,
    });
    await this.auditService.record({
      action: AuditAction.CREATE,
      resourceType: 'LeaveBalance',
      resourceId: created.id,
      actorId: actor.id,
      organisationId,
      newValues: this.balanceSnapshot(created),
    });
    return created;
  }

  async listLeaveBalances(
    actor: AuthenticatedUser,
    query: ListLeaveBalancesQueryDto,
  ) {
    return this.leaveRepository.listLeaveBalances({
      organisationId: this.requireOrganisationId(actor),
      page: query.page,
      size: query.size,
      employeeId: query.employeeId,
      leaveTypeId: query.leaveTypeId,
    });
  }

  async getLeaveBalance(actor: AuthenticatedUser, id: string) {
    const organisationId = this.requireOrganisationId(actor);
    const record = await this.leaveRepository.findLeaveBalance(
      organisationId,
      id,
    );
    if (!record) {
      throw new NotFoundException('Leave balance not found');
    }
    return record;
  }

  async submitApplication(
    actor: AuthenticatedUser,
    dto: CreateLeaveApplicationDto,
  ) {
    const organisationId = this.requireOrganisationId(actor);
    const employeeId = await this.leaveRepository.resolveLinkedEmployeeId(
      organisationId,
      actor.id,
    );
    const created = await this.leaveRepository.submitApplication({
      organisationId,
      employeeId,
      leaveTypeId: dto.leaveTypeId,
      startDate: dto.startDate,
      endDate: dto.endDate,
      reason: dto.reason,
    });
    await this.auditService.record({
      action: AuditAction.SUBMIT,
      resourceType: 'LeaveRequest',
      resourceId: created.id,
      actorId: actor.id,
      organisationId,
      newValues: this.applicationSnapshot(created),
    });
    return created;
  }

  async listApplications(
    actor: AuthenticatedUser,
    query: ListLeaveApplicationsQueryDto,
  ): Promise<PaginatedResult<LeaveApplicationRecord>> {
    if (
      query.startDateFrom &&
      query.startDateTo &&
      query.startDateTo.getTime() < query.startDateFrom.getTime()
    ) {
      throw new BadRequestException(
        'startDateTo must be on or after startDateFrom',
      );
    }
    return this.leaveRepository.listApplications({
      organisationId: this.requireOrganisationId(actor),
      page: query.page,
      size: query.size,
      employeeId: query.employeeId,
      leaveTypeId: query.leaveTypeId,
      status: query.status,
      startDateFrom: query.startDateFrom,
      startDateTo: query.startDateTo,
    });
  }

  async getApplication(actor: AuthenticatedUser, id: string) {
    const organisationId = this.requireOrganisationId(actor);
    const record = await this.leaveRepository.findApplication(
      organisationId,
      id,
    );
    if (!record) {
      throw new NotFoundException('Leave application not found');
    }
    return record;
  }

  async approveApplication(actor: AuthenticatedUser, id: string) {
    const organisationId = this.requireOrganisationId(actor);
    const updated = await this.leaveRepository.approveApplication({
      organisationId,
      applicationId: id,
      reviewerUserId: actor.id,
    });
    await this.auditService.record({
      action: AuditAction.APPROVE,
      resourceType: 'LeaveRequest',
      resourceId: updated.id,
      actorId: actor.id,
      organisationId,
      newValues: this.applicationSnapshot(updated),
    });
    return updated;
  }

  async rejectApplication(
    actor: AuthenticatedUser,
    id: string,
    dto: RejectLeaveApplicationDto,
  ) {
    const organisationId = this.requireOrganisationId(actor);
    const updated = await this.leaveRepository.rejectApplication({
      organisationId,
      applicationId: id,
      reviewerUserId: actor.id,
      reason: dto.reason,
    });
    await this.auditService.record({
      action: AuditAction.REJECT,
      resourceType: 'LeaveRequest',
      resourceId: updated.id,
      actorId: actor.id,
      organisationId,
      reason: dto.reason,
      newValues: this.applicationSnapshot(updated),
    });
    return updated;
  }

  async withdrawApplication(actor: AuthenticatedUser, id: string) {
    const organisationId = this.requireOrganisationId(actor);
    const employeeId = await this.leaveRepository.resolveLinkedEmployeeId(
      organisationId,
      actor.id,
    );
    const updated = await this.leaveRepository.withdrawApplication({
      organisationId,
      applicationId: id,
      employeeId,
    });
    await this.auditService.record({
      action: AuditAction.CANCEL,
      resourceType: 'LeaveRequest',
      resourceId: updated.id,
      actorId: actor.id,
      organisationId,
      newValues: this.applicationSnapshot(updated),
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

  private typeSnapshot(record: LeaveTypeRecord) {
    return {
      code: record.code,
      name: record.name,
      status: record.status,
      paid: record.paid,
      unit: record.unit,
    };
  }

  private balanceSnapshot(record: LeaveBalanceRecord) {
    return {
      employeeId: record.employeeId,
      leaveTypeId: record.leaveTypeId,
      entitled: record.entitled,
      available: record.available,
      reserved: record.reserved,
      used: record.used,
    };
  }

  private applicationSnapshot(record: LeaveApplicationRecord) {
    return {
      employeeId: record.employeeId,
      leaveTypeId: record.leaveTypeId,
      startDate: record.startDate.toISOString(),
      endDate: record.endDate.toISOString(),
      quantity: record.quantity,
      status: record.status,
      reviewedByUserId: record.reviewedByUserId,
    };
  }
}
