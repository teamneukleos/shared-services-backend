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
  EmploymentStatus,
  LeaveRequestStatus,
  LeaveTransactionType,
  RecordStatus,
} from '../../../generated/prisma/client';
import { calculateLeaveDurationDays } from '../domain/leave-duration';
import {
  LeaveApplicationRecord,
  LeaveBalanceRecord,
  LeaveTypeRecord,
} from '../domain/leave.types';

const ACTIVE_LEAVE_STATUSES: LeaveRequestStatus[] = [
  LeaveRequestStatus.PENDING,
  LeaveRequestStatus.APPROVED,
];

const ELIGIBLE_EMPLOYMENT: EmploymentStatus[] = [
  EmploymentStatus.ACTIVE,
  EmploymentStatus.PENDING,
];

function decimalToNumber(value: Prisma.Decimal | number): number {
  return typeof value === 'number' ? value : Number(value);
}

@Injectable()
export class PrismaLeaveRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createLeaveType(input: {
    organisationId: string;
    name: string;
    code: string;
    description?: string;
    unit?: string;
    paid?: boolean;
  }): Promise<LeaveTypeRecord> {
    try {
      const created = await this.prisma.leaveType.create({
        data: {
          organisationId: input.organisationId,
          name: input.name.trim(),
          code: input.code.trim().toUpperCase(),
          description: input.description?.trim() || null,
          unit: input.unit?.trim() || 'DAYS',
          paid: input.paid ?? true,
          status: RecordStatus.ACTIVE,
        },
      });
      return this.toLeaveType(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Leave type code already exists in this organisation',
        );
      }
      throw error;
    }
  }

  async findLeaveType(
    organisationId: string,
    id: string,
  ): Promise<LeaveTypeRecord | null> {
    const row = await this.prisma.leaveType.findFirst({
      where: { id, organisationId },
    });
    return row ? this.toLeaveType(row) : null;
  }

  async listLeaveTypes(query: {
    organisationId: string;
    page: number;
    size: number;
    status?: RecordStatus;
  }) {
    const { skip, take } = getPaginationSkipTake(query.page, query.size);
    const where: Prisma.LeaveTypeWhereInput = {
      organisationId: query.organisationId,
      ...(query.status ? { status: query.status } : {}),
    };
    const [totalItems, rows] = await this.prisma.$transaction([
      this.prisma.leaveType.count({ where }),
      this.prisma.leaveType.findMany({
        where,
        orderBy: [{ name: 'asc' }],
        skip,
        take,
      }),
    ]);
    return createPaginatedResult(
      rows.map((row) => this.toLeaveType(row)),
      query.page,
      query.size,
      totalItems,
    );
  }

  async updateLeaveType(input: {
    organisationId: string;
    id: string;
    name?: string;
    description?: string | null;
    unit?: string;
    paid?: boolean;
    status?: RecordStatus;
  }): Promise<LeaveTypeRecord> {
    const existing = await this.findLeaveType(input.organisationId, input.id);
    if (!existing) {
      throw new NotFoundException('Leave type not found');
    }
    const updated = await this.prisma.leaveType.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined
          ? {
              description:
                input.description === null
                  ? null
                  : input.description.trim() || null,
            }
          : {}),
        ...(input.unit !== undefined ? { unit: input.unit.trim() } : {}),
        ...(input.paid !== undefined ? { paid: input.paid } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
    });
    return this.toLeaveType(updated);
  }

  async createLeaveBalance(input: {
    organisationId: string;
    employeeId: string;
    leaveTypeId: string;
    entitled: number;
  }): Promise<LeaveBalanceRecord> {
    await this.assertEligibleEmployee(input.organisationId, input.employeeId);
    const leaveType = await this.requireActiveLeaveType(
      input.organisationId,
      input.leaveTypeId,
    );

    try {
      const created = await this.prisma.leaveBalance.create({
        data: {
          employeeId: input.employeeId,
          leaveTypeId: leaveType.id,
          entitled: input.entitled,
          available: input.entitled,
          reserved: 0,
          used: 0,
        },
        include: this.balanceInclude,
      });
      return this.toLeaveBalance(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Leave balance already exists for this employee and leave type',
        );
      }
      throw error;
    }
  }

  async findLeaveBalance(
    organisationId: string,
    id: string,
  ): Promise<LeaveBalanceRecord | null> {
    const row = await this.prisma.leaveBalance.findFirst({
      where: {
        id,
        employee: { organisationId },
      },
      include: this.balanceInclude,
    });
    return row ? this.toLeaveBalance(row) : null;
  }

  async listLeaveBalances(query: {
    organisationId: string;
    page: number;
    size: number;
    employeeId?: string;
    leaveTypeId?: string;
  }) {
    const { skip, take } = getPaginationSkipTake(query.page, query.size);
    const where: Prisma.LeaveBalanceWhereInput = {
      employee: { organisationId: query.organisationId },
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.leaveTypeId ? { leaveTypeId: query.leaveTypeId } : {}),
    };
    const [totalItems, rows] = await this.prisma.$transaction([
      this.prisma.leaveBalance.count({ where }),
      this.prisma.leaveBalance.findMany({
        where,
        include: this.balanceInclude,
        orderBy: [{ updatedAt: 'desc' }],
        skip,
        take,
      }),
    ]);
    return createPaginatedResult(
      rows.map((row) => this.toLeaveBalance(row)),
      query.page,
      query.size,
      totalItems,
    );
  }

  async resolveLinkedEmployeeId(
    organisationId: string,
    userAccountId: string,
  ): Promise<string> {
    const account = await this.prisma.userAccount.findFirst({
      where: {
        id: userAccountId,
        organisationId,
        status: RecordStatus.ACTIVE,
      },
      select: { employeeId: true },
    });
    if (!account?.employeeId) {
      throw new BadRequestException(
        'User account is not linked to an employee record',
      );
    }
    return account.employeeId;
  }

  async submitApplication(input: {
    organisationId: string;
    employeeId: string;
    leaveTypeId: string;
    startDate: Date;
    endDate: Date;
    reason?: string;
  }): Promise<LeaveApplicationRecord> {
    if (input.endDate.getTime() < input.startDate.getTime()) {
      throw new BadRequestException('endDate must be on or after startDate');
    }
    const quantity = calculateLeaveDurationDays(input.startDate, input.endDate);

    await this.assertEligibleEmployee(input.organisationId, input.employeeId);
    await this.requireActiveLeaveType(input.organisationId, input.leaveTypeId);

    return this.prisma.$transaction(async (tx) => {
      const overlap = await tx.leaveRequest.findFirst({
        where: {
          employeeId: input.employeeId,
          status: { in: ACTIVE_LEAVE_STATUSES },
          startDate: { lte: input.endDate },
          endDate: { gte: input.startDate },
        },
        select: { id: true },
      });
      if (overlap) {
        throw new ConflictException(
          'Overlapping pending or approved leave application exists',
        );
      }

      const balance = await tx.leaveBalance.findFirst({
        where: {
          employeeId: input.employeeId,
          leaveTypeId: input.leaveTypeId,
          employee: { organisationId: input.organisationId },
        },
      });
      if (!balance) {
        throw new BadRequestException(
          'No leave balance exists for this employee and leave type',
        );
      }
      if (decimalToNumber(balance.available) < quantity) {
        throw new BadRequestException('Insufficient leave balance');
      }

      const reserved = await tx.leaveBalance.updateMany({
        where: {
          id: balance.id,
          version: balance.version,
          available: { gte: quantity },
        },
        data: {
          available: { decrement: quantity },
          reserved: { increment: quantity },
          version: { increment: 1 },
        },
      });
      if (reserved.count !== 1) {
        throw new ConflictException(
          'Leave balance changed concurrently; retry the request',
        );
      }

      const created = await tx.leaveRequest.create({
        data: {
          employeeId: input.employeeId,
          leaveTypeId: input.leaveTypeId,
          startDate: input.startDate,
          endDate: input.endDate,
          quantity,
          reason: input.reason?.trim() || null,
          status: LeaveRequestStatus.PENDING,
          submittedAt: new Date(),
        },
        include: this.applicationInclude,
      });

      await tx.leaveTransaction.create({
        data: {
          employeeId: input.employeeId,
          leaveRequestId: created.id,
          type: LeaveTransactionType.RESERVE,
          quantity,
        },
      });

      return this.toLeaveApplication(created);
    });
  }

  async findApplication(
    organisationId: string,
    id: string,
  ): Promise<LeaveApplicationRecord | null> {
    const row = await this.prisma.leaveRequest.findFirst({
      where: {
        id,
        employee: { organisationId },
      },
      include: this.applicationInclude,
    });
    return row ? this.toLeaveApplication(row) : null;
  }

  async listApplications(query: {
    organisationId: string;
    page: number;
    size: number;
    employeeId?: string;
    leaveTypeId?: string;
    status?: LeaveRequestStatus;
    startDateFrom?: Date;
    startDateTo?: Date;
  }) {
    const { skip, take } = getPaginationSkipTake(query.page, query.size);
    const where: Prisma.LeaveRequestWhereInput = {
      employee: { organisationId: query.organisationId },
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.leaveTypeId ? { leaveTypeId: query.leaveTypeId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
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
      this.prisma.leaveRequest.count({ where }),
      this.prisma.leaveRequest.findMany({
        where,
        include: this.applicationInclude,
        orderBy: [{ submittedAt: 'desc' }],
        skip,
        take,
      }),
    ]);

    return createPaginatedResult(
      rows.map((row) => this.toLeaveApplication(row)),
      query.page,
      query.size,
      totalItems,
    );
  }

  async approveApplication(input: {
    organisationId: string;
    applicationId: string;
    reviewerUserId: string;
  }): Promise<LeaveApplicationRecord> {
    return this.prisma.$transaction(async (tx) => {
      const application = await this.requirePendingApplication(
        tx,
        input.organisationId,
        input.applicationId,
      );
      await this.assertNotSelfReview(
        tx,
        application.employeeId,
        input.reviewerUserId,
      );

      const quantity = decimalToNumber(application.quantity);
      const balance = await tx.leaveBalance.findFirst({
        where: {
          employeeId: application.employeeId,
          leaveTypeId: application.leaveTypeId,
        },
      });
      if (!balance || decimalToNumber(balance.reserved) < quantity) {
        throw new ConflictException(
          'Leave balance reservation is missing or insufficient',
        );
      }

      const consumed = await tx.leaveBalance.updateMany({
        where: {
          id: balance.id,
          version: balance.version,
          reserved: { gte: quantity },
        },
        data: {
          reserved: { decrement: quantity },
          used: { increment: quantity },
          version: { increment: 1 },
        },
      });
      if (consumed.count !== 1) {
        throw new ConflictException(
          'Leave balance changed concurrently; retry the request',
        );
      }

      const updated = await tx.leaveRequest.updateMany({
        where: {
          id: application.id,
          status: LeaveRequestStatus.PENDING,
        },
        data: {
          status: LeaveRequestStatus.APPROVED,
          reviewedAt: new Date(),
          reviewedByUserId: input.reviewerUserId,
          reviewComment: null,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Leave application is no longer pending');
      }

      await tx.leaveTransaction.create({
        data: {
          employeeId: application.employeeId,
          leaveRequestId: application.id,
          type: LeaveTransactionType.CONSUME,
          quantity,
        },
      });

      const row = await tx.leaveRequest.findUniqueOrThrow({
        where: { id: application.id },
        include: this.applicationInclude,
      });
      return this.toLeaveApplication(row);
    });
  }

  async rejectApplication(input: {
    organisationId: string;
    applicationId: string;
    reviewerUserId: string;
    reason: string;
  }): Promise<LeaveApplicationRecord> {
    return this.releasePendingApplication({
      organisationId: input.organisationId,
      applicationId: input.applicationId,
      actorUserId: input.reviewerUserId,
      nextStatus: LeaveRequestStatus.REJECTED,
      reviewComment: input.reason,
      preventSelfReview: true,
      transactionType: LeaveTransactionType.RELEASE,
    });
  }

  async withdrawApplication(input: {
    organisationId: string;
    applicationId: string;
    employeeId: string;
  }): Promise<LeaveApplicationRecord> {
    return this.releasePendingApplication({
      organisationId: input.organisationId,
      applicationId: input.applicationId,
      actorUserId: null,
      nextStatus: LeaveRequestStatus.CANCELLED,
      reviewComment: null,
      preventSelfReview: false,
      requiredEmployeeId: input.employeeId,
      transactionType: LeaveTransactionType.RELEASE,
    });
  }

  private async releasePendingApplication(input: {
    organisationId: string;
    applicationId: string;
    actorUserId: string | null;
    nextStatus: LeaveRequestStatus;
    reviewComment: string | null;
    preventSelfReview: boolean;
    requiredEmployeeId?: string;
    transactionType: LeaveTransactionType;
  }): Promise<LeaveApplicationRecord> {
    return this.prisma.$transaction(async (tx) => {
      const application = await this.requirePendingApplication(
        tx,
        input.organisationId,
        input.applicationId,
      );

      if (
        input.requiredEmployeeId &&
        application.employeeId !== input.requiredEmployeeId
      ) {
        throw new NotFoundException('Leave application not found');
      }

      if (input.preventSelfReview && input.actorUserId) {
        await this.assertNotSelfReview(
          tx,
          application.employeeId,
          input.actorUserId,
        );
      }

      const quantity = decimalToNumber(application.quantity);
      const balance = await tx.leaveBalance.findFirst({
        where: {
          employeeId: application.employeeId,
          leaveTypeId: application.leaveTypeId,
        },
      });
      if (!balance || decimalToNumber(balance.reserved) < quantity) {
        throw new ConflictException(
          'Leave balance reservation is missing or insufficient',
        );
      }

      const released = await tx.leaveBalance.updateMany({
        where: {
          id: balance.id,
          version: balance.version,
          reserved: { gte: quantity },
        },
        data: {
          reserved: { decrement: quantity },
          available: { increment: quantity },
          version: { increment: 1 },
        },
      });
      if (released.count !== 1) {
        throw new ConflictException(
          'Leave balance changed concurrently; retry the request',
        );
      }

      const updated = await tx.leaveRequest.updateMany({
        where: {
          id: application.id,
          status: LeaveRequestStatus.PENDING,
        },
        data: {
          status: input.nextStatus,
          reviewedAt: input.actorUserId ? new Date() : null,
          reviewedByUserId: input.actorUserId,
          reviewComment: input.reviewComment,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Leave application is no longer pending');
      }

      await tx.leaveTransaction.create({
        data: {
          employeeId: application.employeeId,
          leaveRequestId: application.id,
          type: input.transactionType,
          quantity,
        },
      });

      const row = await tx.leaveRequest.findUniqueOrThrow({
        where: { id: application.id },
        include: this.applicationInclude,
      });
      return this.toLeaveApplication(row);
    });
  }

  private async requirePendingApplication(
    tx: Prisma.TransactionClient,
    organisationId: string,
    applicationId: string,
  ) {
    const application = await tx.leaveRequest.findFirst({
      where: {
        id: applicationId,
        employee: { organisationId },
      },
    });
    if (!application) {
      throw new NotFoundException('Leave application not found');
    }
    if (application.status !== LeaveRequestStatus.PENDING) {
      throw new BadRequestException(
        `Leave application must be PENDING (current: ${application.status})`,
      );
    }
    return application;
  }

  private async assertNotSelfReview(
    tx: Prisma.TransactionClient,
    employeeId: string,
    reviewerUserId: string,
  ): Promise<void> {
    const linked = await tx.userAccount.findFirst({
      where: { employeeId, id: reviewerUserId },
      select: { id: true },
    });
    if (linked) {
      throw new BadRequestException(
        'Applicants cannot approve or reject their own leave application',
      );
    }
  }

  private async assertEligibleEmployee(
    organisationId: string,
    employeeId: string,
  ): Promise<void> {
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        organisationId,
        status: { in: ELIGIBLE_EMPLOYMENT },
      },
      select: { id: true },
    });
    if (!employee) {
      throw new BadRequestException(
        'Employee is not eligible or does not belong to this organisation',
      );
    }
  }

  private async requireActiveLeaveType(
    organisationId: string,
    leaveTypeId: string,
  ) {
    const leaveType = await this.prisma.leaveType.findFirst({
      where: {
        id: leaveTypeId,
        organisationId,
        status: RecordStatus.ACTIVE,
      },
    });
    if (!leaveType) {
      throw new BadRequestException(
        'Leave type is inactive or does not belong to this organisation',
      );
    }
    return leaveType;
  }

  private readonly balanceInclude = {
    employee: {
      select: {
        organisationId: true,
        employeeNumber: true,
        person: { select: { firstName: true, lastName: true } },
      },
    },
    leaveType: { select: { code: true, name: true } },
  } satisfies Prisma.LeaveBalanceInclude;

  private readonly applicationInclude = {
    employee: {
      select: {
        organisationId: true,
        employeeNumber: true,
        person: { select: { firstName: true, lastName: true } },
      },
    },
    leaveType: { select: { code: true, name: true } },
  } satisfies Prisma.LeaveRequestInclude;

  private toLeaveType(row: {
    id: string;
    organisationId: string;
    name: string;
    code: string;
    description: string | null;
    unit: string;
    paid: boolean;
    status: RecordStatus;
    createdAt: Date;
    updatedAt: Date;
  }): LeaveTypeRecord {
    return { ...row };
  }

  private toLeaveBalance(row: {
    id: string;
    employeeId: string;
    leaveTypeId: string;
    entitled: Prisma.Decimal;
    available: Prisma.Decimal;
    reserved: Prisma.Decimal;
    used: Prisma.Decimal;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    employee: {
      organisationId: string;
      employeeNumber: string;
      person: { firstName: string; lastName: string };
    };
    leaveType: { code: string; name: string };
  }): LeaveBalanceRecord {
    return {
      id: row.id,
      organisationId: row.employee.organisationId,
      employeeId: row.employeeId,
      employeeNumber: row.employee.employeeNumber,
      employeeName: `${row.employee.person.firstName} ${row.employee.person.lastName}`,
      leaveTypeId: row.leaveTypeId,
      leaveTypeCode: row.leaveType.code,
      leaveTypeName: row.leaveType.name,
      entitled: decimalToNumber(row.entitled),
      available: decimalToNumber(row.available),
      reserved: decimalToNumber(row.reserved),
      used: decimalToNumber(row.used),
      version: row.version,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toLeaveApplication(row: {
    id: string;
    employeeId: string;
    leaveTypeId: string;
    startDate: Date;
    endDate: Date;
    quantity: Prisma.Decimal;
    reason: string | null;
    status: LeaveRequestStatus;
    submittedAt: Date;
    reviewedAt: Date | null;
    reviewedByUserId: string | null;
    reviewComment: string | null;
    createdAt: Date;
    updatedAt: Date;
    employee: {
      organisationId: string;
      employeeNumber: string;
      person: { firstName: string; lastName: string };
    };
    leaveType: { code: string; name: string };
  }): LeaveApplicationRecord {
    return {
      id: row.id,
      organisationId: row.employee.organisationId,
      employeeId: row.employeeId,
      employeeNumber: row.employee.employeeNumber,
      employeeName: `${row.employee.person.firstName} ${row.employee.person.lastName}`,
      leaveTypeId: row.leaveTypeId,
      leaveTypeCode: row.leaveType.code,
      leaveTypeName: row.leaveType.name,
      startDate: row.startDate,
      endDate: row.endDate,
      quantity: decimalToNumber(row.quantity),
      reason: row.reason,
      status: row.status,
      submittedAt: row.submittedAt,
      reviewedAt: row.reviewedAt,
      reviewedByUserId: row.reviewedByUserId,
      reviewComment: row.reviewComment,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
