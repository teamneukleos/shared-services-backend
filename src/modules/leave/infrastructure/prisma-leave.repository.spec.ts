import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  EmploymentStatus,
  LeaveRequestStatus,
  Prisma,
  RecordStatus,
} from '../../../generated/prisma/client';
import { PrismaLeaveRepository } from './prisma-leave.repository';

describe('PrismaLeaveRepository', () => {
  const leaveTypeCreate = jest.fn();
  const leaveTypeFindFirst = jest.fn();
  const employeeFindFirst = jest.fn();
  const leaveBalanceCreate = jest.fn();
  const userAccountFindFirst = jest.fn();
  const transaction = jest.fn();

  const prisma = {
    leaveType: {
      create: leaveTypeCreate,
      findFirst: leaveTypeFindFirst,
    },
    employee: { findFirst: employeeFindFirst },
    leaveBalance: { create: leaveBalanceCreate },
    userAccount: { findFirst: userAccountFindFirst },
    $transaction: transaction,
  } as unknown as PrismaService;

  let repository: PrismaLeaveRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new PrismaLeaveRepository(prisma);
  });

  it('maps duplicate leave type codes to conflict', async () => {
    leaveTypeCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['organisationId', 'code'] },
      }),
    );

    await expect(
      repository.createLeaveType({
        organisationId: 'org-1',
        name: 'Annual',
        code: 'ANNUAL',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects ineligible employees when creating balances', async () => {
    employeeFindFirst.mockResolvedValue(null);

    await expect(
      repository.createLeaveBalance({
        organisationId: 'org-1',
        employeeId: 'emp-1',
        leaveTypeId: 'type-1',
        entitled: 20,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects inactive leave types for balances', async () => {
    employeeFindFirst.mockResolvedValue({ id: 'emp-1' });
    leaveTypeFindFirst.mockResolvedValue(null);

    await expect(
      repository.createLeaveBalance({
        organisationId: 'org-1',
        employeeId: 'emp-1',
        leaveTypeId: 'type-1',
        entitled: 20,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(leaveTypeFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: RecordStatus.ACTIVE,
          organisationId: 'org-1',
        }),
      }),
    );
  });

  it('requires a linked employee for application submission identity', async () => {
    userAccountFindFirst.mockResolvedValue({ employeeId: null });

    await expect(
      repository.resolveLinkedEmployeeId('org-1', 'user-1'),
    ).rejects.toThrow(/not linked to an employee/i);
  });

  it('rejects inverted application dates before opening a transaction', async () => {
    await expect(
      repository.submitApplication({
        organisationId: 'org-1',
        employeeId: 'emp-1',
        leaveTypeId: 'type-1',
        startDate: new Date('2026-03-10T00:00:00.000Z'),
        endDate: new Date('2026-03-01T00:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('detects overlapping applications inside the submit transaction', async () => {
    employeeFindFirst.mockResolvedValue({
      id: 'emp-1',
      status: EmploymentStatus.ACTIVE,
    });
    leaveTypeFindFirst.mockResolvedValue({
      id: 'type-1',
      status: RecordStatus.ACTIVE,
    });

    const leaveRequestFindFirst = jest.fn().mockResolvedValue({ id: 'other' });
    transaction.mockImplementation(
      async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({
          leaveRequest: { findFirst: leaveRequestFindFirst },
          leaveBalance: { findFirst: jest.fn(), updateMany: jest.fn() },
          leaveTransaction: { create: jest.fn() },
        }),
    );

    await expect(
      repository.submitApplication({
        organisationId: 'org-1',
        employeeId: 'emp-1',
        leaveTypeId: 'type-1',
        startDate: new Date('2026-03-01T00:00:00.000Z'),
        endDate: new Date('2026-03-03T00:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(leaveRequestFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employeeId: 'emp-1',
          status: {
            in: [LeaveRequestStatus.PENDING, LeaveRequestStatus.APPROVED],
          },
        }),
      }),
    );
  });

  it('rejects insufficient balance on submit', async () => {
    employeeFindFirst.mockResolvedValue({ id: 'emp-1' });
    leaveTypeFindFirst.mockResolvedValue({ id: 'type-1' });

    transaction.mockImplementation(
      async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({
          leaveRequest: { findFirst: jest.fn().mockResolvedValue(null) },
          leaveBalance: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'bal-1',
              available: new Prisma.Decimal(1),
              version: 1,
            }),
            updateMany: jest.fn(),
          },
          leaveTransaction: { create: jest.fn() },
        }),
    );

    await expect(
      repository.submitApplication({
        organisationId: 'org-1',
        employeeId: 'emp-1',
        leaveTypeId: 'type-1',
        startDate: new Date('2026-03-01T00:00:00.000Z'),
        endDate: new Date('2026-03-05T00:00:00.000Z'),
      }),
    ).rejects.toThrow(/Insufficient leave balance/i);
  });

  it('prevents self-approval', async () => {
    transaction.mockImplementation(
      async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({
          leaveRequest: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'app-1',
              employeeId: 'emp-1',
              leaveTypeId: 'type-1',
              quantity: new Prisma.Decimal(2),
              status: LeaveRequestStatus.PENDING,
            }),
            updateMany: jest.fn(),
            findUniqueOrThrow: jest.fn(),
          },
          userAccount: {
            findFirst: jest.fn().mockResolvedValue({ id: 'user-1' }),
          },
          leaveBalance: { findFirst: jest.fn(), updateMany: jest.fn() },
          leaveTransaction: { create: jest.fn() },
        }),
    );

    await expect(
      repository.approveApplication({
        organisationId: 'org-1',
        applicationId: 'app-1',
        reviewerUserId: 'user-1',
      }),
    ).rejects.toThrow(/cannot approve or reject their own/i);
  });
});
