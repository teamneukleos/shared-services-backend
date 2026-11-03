import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  createPaginatedResult,
  getPaginationSkipTake,
} from '../../../../common/utils/pagination.util';
import { PrismaService } from '../../../../database/prisma/prisma.service';
import {
  OnboardingStatus,
  OnboardingTaskStatus,
  Prisma,
  RecordStatus,
} from '../../../../generated/prisma/client';
import { OnboardingRepository } from '../domain/onboarding.repository';
import {
  ChangeOnboardingStatusInput,
  ChangeOnboardingTaskStatusInput,
  CreateOnboardingInput,
  CreateOnboardingTaskInput,
  ListOnboardingQuery,
  OnboardingRecord,
  OnboardingTaskRecord,
  UpdateOnboardingInput,
  UpdateOnboardingTaskInput,
} from '../domain/onboarding.types';

type OnboardingRow = {
  id: string;
  employeeId: string;
  name: string;
  notes: string | null;
  startDate: Date;
  targetCompletionDate: Date | null;
  completedAt: Date | null;
  status: OnboardingStatus;
  coordinatorUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  employee: {
    organisationId: string;
    employeeNumber: string;
    person: {
      firstName: string;
      lastName: string;
    };
  };
  tasks: Array<{
    id: string;
    planId: string;
    title: string;
    description: string | null;
    category: string | null;
    isRequired: boolean;
    status: OnboardingTaskStatus;
    dueDate: Date | null;
    assigneeUserId: string | null;
    completedAt: Date | null;
    completedByUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
};

const onboardingInclude: Prisma.OnboardingPlanInclude = {
  employee: {
    select: {
      organisationId: true,
      employeeNumber: true,
      person: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  },
  tasks: {
    orderBy: [{ createdAt: 'asc' }, { title: 'asc' }],
  },
};

@Injectable()
export class PrismaOnboardingRepository implements OnboardingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateOnboardingInput): Promise<OnboardingRecord> {
    await this.assertEmployeeInOrganisation(
      input.organisationId,
      input.employeeId,
    );
    if (input.coordinatorUserId) {
      await this.assertUserInOrganisation(
        input.organisationId,
        input.coordinatorUserId,
      );
    }

    const active = await this.prisma.onboardingPlan.findFirst({
      where: {
        employeeId: input.employeeId,
        status: {
          in: [OnboardingStatus.NOT_STARTED, OnboardingStatus.IN_PROGRESS],
        },
      },
      select: { id: true },
    });
    if (active) {
      throw new ConflictException(
        'Employee already has an active onboarding record',
      );
    }

    try {
      const created = await this.prisma.onboardingPlan.create({
        data: {
          employeeId: input.employeeId,
          name: input.name.trim(),
          notes: input.notes?.trim() || null,
          startDate: input.startDate,
          targetCompletionDate: input.targetCompletionDate,
          coordinatorUserId: input.coordinatorUserId,
          status: OnboardingStatus.NOT_STARTED,
        },
        include: onboardingInclude,
      });
      return this.toRecord(created as unknown as OnboardingRow);
    } catch (error) {
      this.rethrowActiveConflict(error);
      throw error;
    }
  }

  async findByIdInOrganisation(
    organisationId: string,
    onboardingId: string,
  ): Promise<OnboardingRecord | null> {
    const row = await this.prisma.onboardingPlan.findFirst({
      where: {
        id: onboardingId,
        employee: { organisationId },
      },
      include: onboardingInclude,
    });
    return row ? this.toRecord(row as unknown as OnboardingRow) : null;
  }

  async list(query: ListOnboardingQuery) {
    const { skip, take } = getPaginationSkipTake(query.page, query.size);
    const where: Prisma.OnboardingPlanWhereInput = {
      employee: { organisationId: query.organisationId },
    };

    if (query.employeeId) {
      where.employeeId = query.employeeId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.startDateFrom || query.startDateTo) {
      where.startDate = {};
      if (query.startDateFrom) {
        where.startDate.gte = query.startDateFrom;
      }
      if (query.startDateTo) {
        where.startDate.lte = query.startDateTo;
      }
    }

    const [totalItems, rows] = await this.prisma.$transaction([
      this.prisma.onboardingPlan.count({ where }),
      this.prisma.onboardingPlan.findMany({
        where,
        include: onboardingInclude,
        orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take,
      }),
    ]);

    return createPaginatedResult(
      rows.map((row) => this.toRecord(row as unknown as OnboardingRow)),
      query.page,
      query.size,
      totalItems,
    );
  }

  async update(input: UpdateOnboardingInput): Promise<OnboardingRecord> {
    const existing = await this.requirePlan(
      input.organisationId,
      input.onboardingId,
    );

    if (
      existing.status === OnboardingStatus.COMPLETED ||
      existing.status === OnboardingStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Cannot update a completed or cancelled onboarding record',
      );
    }

    if (input.coordinatorUserId) {
      await this.assertUserInOrganisation(
        input.organisationId,
        input.coordinatorUserId,
      );
    }

    const updated = await this.prisma.onboardingPlan.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.notes !== undefined
          ? {
              notes: input.notes === null ? null : input.notes.trim() || null,
            }
          : {}),
        ...(input.startDate !== undefined
          ? { startDate: input.startDate }
          : {}),
        ...(input.targetCompletionDate !== undefined
          ? { targetCompletionDate: input.targetCompletionDate }
          : {}),
        ...(input.coordinatorUserId !== undefined
          ? { coordinatorUserId: input.coordinatorUserId }
          : {}),
      },
      include: onboardingInclude,
    });

    return this.toRecord(updated as unknown as OnboardingRow);
  }

  async changeStatus(
    input: ChangeOnboardingStatusInput,
  ): Promise<OnboardingRecord> {
    const existing = await this.requirePlan(
      input.organisationId,
      input.onboardingId,
    );

    const data: Prisma.OnboardingPlanUpdateInput = {
      status: input.status,
    };

    if (input.status === OnboardingStatus.COMPLETED) {
      data.completedAt = existing.completedAt ?? new Date();
    } else if (input.status === OnboardingStatus.CANCELLED) {
      data.completedAt = null;
    } else if (input.status === OnboardingStatus.IN_PROGRESS) {
      data.completedAt = null;
    }

    const updated = await this.prisma.onboardingPlan.update({
      where: { id: existing.id },
      data,
      include: onboardingInclude,
    });

    return this.toRecord(updated as unknown as OnboardingRow);
  }

  async addTask(
    input: CreateOnboardingTaskInput,
  ): Promise<OnboardingTaskRecord> {
    const plan = await this.requirePlan(
      input.organisationId,
      input.onboardingId,
    );
    this.assertPlanMutable(plan.status);

    if (input.assigneeUserId) {
      await this.assertUserInOrganisation(
        input.organisationId,
        input.assigneeUserId,
      );
    }

    const created = await this.prisma.onboardingTask.create({
      data: {
        planId: plan.id,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        category: input.category?.trim() || null,
        isRequired: input.isRequired ?? true,
        dueDate: input.dueDate,
        assigneeUserId: input.assigneeUserId,
        status: OnboardingTaskStatus.PENDING,
      },
    });

    return this.toTaskRecord(created);
  }

  async updateTask(
    input: UpdateOnboardingTaskInput,
  ): Promise<OnboardingTaskRecord> {
    const plan = await this.requirePlan(
      input.organisationId,
      input.onboardingId,
    );
    this.assertPlanMutable(plan.status);

    const task = await this.requireTask(plan.id, input.taskId);

    if (input.assigneeUserId) {
      await this.assertUserInOrganisation(
        input.organisationId,
        input.assigneeUserId,
      );
    }

    if (
      input.isRequired === true &&
      task.status === OnboardingTaskStatus.SKIPPED
    ) {
      throw new BadRequestException(
        'A skipped task cannot be marked required; change its status first',
      );
    }

    const updated = await this.prisma.onboardingTask.update({
      where: { id: task.id },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.description !== undefined
          ? {
              description:
                input.description === null
                  ? null
                  : input.description.trim() || null,
            }
          : {}),
        ...(input.category !== undefined
          ? {
              category:
                input.category === null ? null : input.category.trim() || null,
            }
          : {}),
        ...(input.isRequired !== undefined
          ? { isRequired: input.isRequired }
          : {}),
        ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
        ...(input.assigneeUserId !== undefined
          ? { assigneeUserId: input.assigneeUserId }
          : {}),
      },
    });

    return this.toTaskRecord(updated);
  }

  async changeTaskStatus(
    input: ChangeOnboardingTaskStatusInput,
  ): Promise<OnboardingTaskRecord> {
    const plan = await this.requirePlan(
      input.organisationId,
      input.onboardingId,
    );
    this.assertPlanMutable(plan.status);
    const task = await this.requireTask(plan.id, input.taskId);

    const data: Prisma.OnboardingTaskUpdateInput = {
      status: input.status,
    };

    if (input.status === OnboardingTaskStatus.COMPLETED) {
      data.completedAt = new Date();
      data.completedBy = { connect: { id: input.actorUserId } };
    } else {
      data.completedAt = null;
      data.completedBy = { disconnect: true };
    }

    const updated = await this.prisma.onboardingTask.update({
      where: { id: task.id },
      data,
    });

    return this.toTaskRecord(updated);
  }

  private async requirePlan(organisationId: string, onboardingId: string) {
    const plan = await this.prisma.onboardingPlan.findFirst({
      where: {
        id: onboardingId,
        employee: { organisationId },
      },
      select: {
        id: true,
        status: true,
        completedAt: true,
      },
    });
    if (!plan) {
      throw new NotFoundException('Onboarding record not found');
    }
    return plan;
  }

  private async requireTask(planId: string, taskId: string) {
    const task = await this.prisma.onboardingTask.findFirst({
      where: { id: taskId, planId },
    });
    if (!task) {
      throw new NotFoundException('Onboarding task not found');
    }
    return task;
  }

  private assertPlanMutable(status: OnboardingStatus): void {
    if (
      status === OnboardingStatus.COMPLETED ||
      status === OnboardingStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Cannot modify tasks on a completed or cancelled onboarding record',
      );
    }
  }

  private async assertEmployeeInOrganisation(
    organisationId: string,
    employeeId: string,
  ): Promise<void> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organisationId },
      select: { id: true },
    });
    if (!employee) {
      throw new BadRequestException(
        'Employee does not belong to this organisation',
      );
    }
  }

  private async assertUserInOrganisation(
    organisationId: string,
    userAccountId: string,
  ): Promise<void> {
    const account = await this.prisma.userAccount.findFirst({
      where: {
        id: userAccountId,
        organisationId,
        status: RecordStatus.ACTIVE,
      },
      select: { id: true },
    });
    if (!account) {
      throw new BadRequestException(
        'User account does not belong to this organisation',
      );
    }
  }

  private rethrowActiveConflict(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Employee already has an active onboarding record',
      );
    }
  }

  private toTaskRecord(row: {
    id: string;
    planId: string;
    title: string;
    description: string | null;
    category: string | null;
    isRequired: boolean;
    status: OnboardingTaskStatus;
    dueDate: Date | null;
    assigneeUserId: string | null;
    completedAt: Date | null;
    completedByUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): OnboardingTaskRecord {
    return {
      id: row.id,
      planId: row.planId,
      title: row.title,
      description: row.description,
      category: row.category,
      isRequired: row.isRequired,
      status: row.status,
      dueDate: row.dueDate,
      assigneeUserId: row.assigneeUserId,
      completedAt: row.completedAt,
      completedByUserId: row.completedByUserId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toRecord(row: OnboardingRow): OnboardingRecord {
    return {
      id: row.id,
      organisationId: row.employee.organisationId,
      employeeId: row.employeeId,
      employeeNumber: row.employee.employeeNumber,
      employeeName: `${row.employee.person.firstName} ${row.employee.person.lastName}`,
      name: row.name,
      notes: row.notes,
      startDate: row.startDate,
      targetCompletionDate: row.targetCompletionDate,
      completedAt: row.completedAt,
      status: row.status,
      coordinatorUserId: row.coordinatorUserId,
      tasks: row.tasks.map((task) => this.toTaskRecord(task)),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
