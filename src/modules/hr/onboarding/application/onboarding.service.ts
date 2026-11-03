import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PaginatedResult } from '../../../../common/interfaces/pagination.interface';
import {
  OnboardingStatus,
  OnboardingTaskStatus,
} from '../../../../generated/prisma/client';
import { AuditService } from '../../../audit/application/audit.service';
import { AuditAction } from '../../../audit/domain/audit-action.enum';
import { AuthenticatedUser } from '../../../authorization/domain/authenticated-user.interface';
import {
  canSkipOnboardingTask,
  canTransitionOnboardingStatus,
  canTransitionOnboardingTaskStatus,
  isRequiredTaskSatisfied,
} from '../domain/onboarding-status.transitions';
import {
  ONBOARDING_REPOSITORY,
  OnboardingRepository,
} from '../domain/onboarding.repository';
import {
  OnboardingRecord,
  OnboardingTaskRecord,
} from '../domain/onboarding.types';
import { ChangeOnboardingStatusDto } from '../dto/change-onboarding-status.dto';
import { ChangeOnboardingTaskStatusDto } from '../dto/change-onboarding-task-status.dto';
import { CreateOnboardingDto } from '../dto/create-onboarding.dto';
import { CreateOnboardingTaskDto } from '../dto/create-onboarding-task.dto';
import { ListOnboardingQueryDto } from '../dto/list-onboarding-query.dto';
import { UpdateOnboardingDto } from '../dto/update-onboarding.dto';
import { UpdateOnboardingTaskDto } from '../dto/update-onboarding-task.dto';

@Injectable()
export class OnboardingService {
  constructor(
    @Inject(ONBOARDING_REPOSITORY)
    private readonly onboardingRepository: OnboardingRepository,
    private readonly auditService: AuditService,
  ) {}

  async create(
    actor: AuthenticatedUser,
    dto: CreateOnboardingDto,
  ): Promise<OnboardingRecord> {
    const organisationId = this.requireOrganisationId(actor);
    this.assertPlanDates(dto.startDate, dto.targetCompletionDate);

    const created = await this.onboardingRepository.create({
      organisationId,
      employeeId: dto.employeeId,
      name: dto.name,
      notes: dto.notes,
      startDate: dto.startDate,
      targetCompletionDate: dto.targetCompletionDate,
      coordinatorUserId: dto.coordinatorUserId,
    });

    await this.auditService.record({
      action: AuditAction.CREATE,
      resourceType: 'OnboardingPlan',
      resourceId: created.id,
      actorId: actor.id,
      organisationId,
      newValues: this.toPlanAuditSnapshot(created),
    });

    return created;
  }

  async findOne(
    actor: AuthenticatedUser,
    onboardingId: string,
  ): Promise<OnboardingRecord> {
    const organisationId = this.requireOrganisationId(actor);
    const record = await this.onboardingRepository.findByIdInOrganisation(
      organisationId,
      onboardingId,
    );
    if (!record) {
      throw new NotFoundException('Onboarding record not found');
    }
    return record;
  }

  async list(
    actor: AuthenticatedUser,
    query: ListOnboardingQueryDto,
  ): Promise<PaginatedResult<OnboardingRecord>> {
    const organisationId = this.requireOrganisationId(actor);
    this.assertDateRange(query.startDateFrom, query.startDateTo);

    return this.onboardingRepository.list({
      organisationId,
      page: query.page,
      size: query.size,
      employeeId: query.employeeId,
      status: query.status,
      startDateFrom: query.startDateFrom,
      startDateTo: query.startDateTo,
    });
  }

  async update(
    actor: AuthenticatedUser,
    onboardingId: string,
    dto: UpdateOnboardingDto,
  ): Promise<OnboardingRecord> {
    const organisationId = this.requireOrganisationId(actor);
    const existing = await this.requireRecord(organisationId, onboardingId);

    this.assertPlanDates(
      dto.startDate ?? existing.startDate,
      dto.targetCompletionDate === undefined
        ? (existing.targetCompletionDate ?? undefined)
        : (dto.targetCompletionDate ?? undefined),
    );

    const updated = await this.onboardingRepository.update({
      organisationId,
      onboardingId,
      ...dto,
    });

    await this.auditService.record({
      action: AuditAction.UPDATE,
      resourceType: 'OnboardingPlan',
      resourceId: updated.id,
      actorId: actor.id,
      organisationId,
      oldValues: this.toPlanAuditSnapshot(existing),
      newValues: this.toPlanAuditSnapshot(updated),
    });

    return updated;
  }

  async changeStatus(
    actor: AuthenticatedUser,
    onboardingId: string,
    dto: ChangeOnboardingStatusDto,
  ): Promise<OnboardingRecord> {
    const organisationId = this.requireOrganisationId(actor);
    const existing = await this.requireRecord(organisationId, onboardingId);

    if (!canTransitionOnboardingStatus(existing.status, dto.status)) {
      throw new BadRequestException(
        `Cannot change onboarding status from ${existing.status} to ${dto.status}`,
      );
    }

    if (dto.status === OnboardingStatus.COMPLETED) {
      const blocking = existing.tasks.filter(
        (task) => !isRequiredTaskSatisfied(task.isRequired, task.status),
      );
      if (blocking.length > 0) {
        throw new BadRequestException(
          'Cannot complete onboarding while required tasks remain incomplete. Required tasks must be COMPLETED; SKIPPED does not satisfy required tasks.',
        );
      }
    }

    const updated = await this.onboardingRepository.changeStatus({
      organisationId,
      onboardingId,
      status: dto.status,
      reason: dto.reason,
    });

    await this.auditService.record({
      action: AuditAction.UPDATE,
      resourceType: 'OnboardingPlan',
      resourceId: updated.id,
      actorId: actor.id,
      organisationId,
      reason: dto.reason,
      oldValues: { status: existing.status, completedAt: existing.completedAt },
      newValues: { status: updated.status, completedAt: updated.completedAt },
    });

    return updated;
  }

  async addTask(
    actor: AuthenticatedUser,
    onboardingId: string,
    dto: CreateOnboardingTaskDto,
  ): Promise<OnboardingTaskRecord> {
    const organisationId = this.requireOrganisationId(actor);

    const created = await this.onboardingRepository.addTask({
      organisationId,
      onboardingId,
      title: dto.title,
      description: dto.description,
      category: dto.category,
      isRequired: dto.isRequired,
      dueDate: dto.dueDate,
      assigneeUserId: dto.assigneeUserId,
    });

    await this.auditService.record({
      action: AuditAction.CREATE,
      resourceType: 'OnboardingTask',
      resourceId: created.id,
      actorId: actor.id,
      organisationId,
      newValues: this.toTaskAuditSnapshot(created),
    });

    return created;
  }

  async updateTask(
    actor: AuthenticatedUser,
    onboardingId: string,
    taskId: string,
    dto: UpdateOnboardingTaskDto,
  ): Promise<OnboardingTaskRecord> {
    const organisationId = this.requireOrganisationId(actor);
    const plan = await this.requireRecord(organisationId, onboardingId);
    const existing = plan.tasks.find((task) => task.id === taskId);
    if (!existing) {
      throw new NotFoundException('Onboarding task not found');
    }

    const updated = await this.onboardingRepository.updateTask({
      organisationId,
      onboardingId,
      taskId,
      ...dto,
    });

    await this.auditService.record({
      action: AuditAction.UPDATE,
      resourceType: 'OnboardingTask',
      resourceId: updated.id,
      actorId: actor.id,
      organisationId,
      oldValues: this.toTaskAuditSnapshot(existing),
      newValues: this.toTaskAuditSnapshot(updated),
    });

    return updated;
  }

  async changeTaskStatus(
    actor: AuthenticatedUser,
    onboardingId: string,
    taskId: string,
    dto: ChangeOnboardingTaskStatusDto,
  ): Promise<OnboardingTaskRecord> {
    const organisationId = this.requireOrganisationId(actor);
    const plan = await this.requireRecord(organisationId, onboardingId);
    const existing = plan.tasks.find((task) => task.id === taskId);
    if (!existing) {
      throw new NotFoundException('Onboarding task not found');
    }

    if (!canTransitionOnboardingTaskStatus(existing.status, dto.status)) {
      throw new BadRequestException(
        `Cannot change task status from ${existing.status} to ${dto.status}`,
      );
    }

    if (
      dto.status === OnboardingTaskStatus.SKIPPED &&
      !canSkipOnboardingTask(existing.isRequired)
    ) {
      throw new BadRequestException(
        'Required onboarding tasks cannot be skipped',
      );
    }

    const updated = await this.onboardingRepository.changeTaskStatus({
      organisationId,
      onboardingId,
      taskId,
      status: dto.status,
      actorUserId: actor.id,
      reason: dto.reason,
    });

    await this.auditService.record({
      action: AuditAction.UPDATE,
      resourceType: 'OnboardingTask',
      resourceId: updated.id,
      actorId: actor.id,
      organisationId,
      reason: dto.reason,
      oldValues: {
        status: existing.status,
        completedAt: existing.completedAt,
        completedByUserId: existing.completedByUserId,
      },
      newValues: {
        status: updated.status,
        completedAt: updated.completedAt,
        completedByUserId: updated.completedByUserId,
      },
    });

    return updated;
  }

  private async requireRecord(
    organisationId: string,
    onboardingId: string,
  ): Promise<OnboardingRecord> {
    const record = await this.onboardingRepository.findByIdInOrganisation(
      organisationId,
      onboardingId,
    );
    if (!record) {
      throw new NotFoundException('Onboarding record not found');
    }
    return record;
  }

  private requireOrganisationId(actor: AuthenticatedUser): string {
    const organisationId = actor.organisationId?.trim();
    if (!organisationId) {
      throw new UnauthorizedException('Organisation context is required');
    }
    return organisationId;
  }

  private assertPlanDates(
    startDate: Date,
    targetCompletionDate?: Date | null,
  ): void {
    if (
      targetCompletionDate &&
      targetCompletionDate.getTime() < startDate.getTime()
    ) {
      throw new BadRequestException(
        'targetCompletionDate must be on or after startDate',
      );
    }
  }

  private assertDateRange(from?: Date, to?: Date): void {
    if (from && to && to.getTime() < from.getTime()) {
      throw new BadRequestException(
        'startDateTo must be on or after startDateFrom',
      );
    }
  }

  private toPlanAuditSnapshot(
    record: OnboardingRecord,
  ): Record<string, unknown> {
    return {
      employeeId: record.employeeId,
      name: record.name,
      status: record.status,
      startDate: record.startDate.toISOString(),
      targetCompletionDate: record.targetCompletionDate?.toISOString() ?? null,
      coordinatorUserId: record.coordinatorUserId,
      completedAt: record.completedAt?.toISOString() ?? null,
    };
  }

  private toTaskAuditSnapshot(
    task: OnboardingTaskRecord,
  ): Record<string, unknown> {
    return {
      planId: task.planId,
      title: task.title,
      category: task.category,
      isRequired: task.isRequired,
      status: task.status,
      assigneeUserId: task.assigneeUserId,
      dueDate: task.dueDate?.toISOString() ?? null,
      completedAt: task.completedAt?.toISOString() ?? null,
      completedByUserId: task.completedByUserId,
    };
  }
}
