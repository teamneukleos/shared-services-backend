import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma/prisma.service';
import { OnboardingStatus, Prisma } from '../../../../generated/prisma/client';
import { PrismaOnboardingRepository } from './prisma-onboarding.repository';

describe('PrismaOnboardingRepository', () => {
  const employeeFindFirst = jest.fn();
  const userAccountFindFirst = jest.fn();
  const onboardingFindFirst = jest.fn();
  const onboardingCreate = jest.fn();
  const onboardingCount = jest.fn();
  const onboardingFindMany = jest.fn();
  const transaction = jest.fn();

  const prisma = {
    employee: { findFirst: employeeFindFirst },
    userAccount: { findFirst: userAccountFindFirst },
    onboardingPlan: {
      findFirst: onboardingFindFirst,
      create: onboardingCreate,
      count: onboardingCount,
      findMany: onboardingFindMany,
    },
    $transaction: transaction,
  } as unknown as PrismaService;

  let repository: PrismaOnboardingRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new PrismaOnboardingRepository(prisma);
  });

  it('rejects employees outside the organisation on create', async () => {
    employeeFindFirst.mockResolvedValue(null);

    await expect(
      repository.create({
        organisationId: 'org-1',
        employeeId: 'emp-other',
        name: 'Plan',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate active onboarding for an employee', async () => {
    employeeFindFirst.mockResolvedValue({ id: 'emp-1' });
    onboardingFindFirst.mockResolvedValue({ id: 'existing' });

    await expect(
      repository.create({
        organisationId: 'org-1',
        employeeId: 'emp-1',
        name: 'Plan',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps unique active-index conflicts', async () => {
    employeeFindFirst.mockResolvedValue({ id: 'emp-1' });
    onboardingFindFirst.mockResolvedValue(null);
    onboardingCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['employeeId'] },
      }),
    );

    await expect(
      repository.create({
        organisationId: 'org-1',
        employeeId: 'emp-1',
        name: 'Plan',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects coordinators outside the organisation', async () => {
    employeeFindFirst.mockResolvedValue({ id: 'emp-1' });
    userAccountFindFirst.mockResolvedValue(null);

    await expect(
      repository.create({
        organisationId: 'org-1',
        employeeId: 'emp-1',
        name: 'Plan',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        coordinatorUserId: 'user-other',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('scopes findById lookups through the employee organisation', async () => {
    onboardingFindFirst.mockResolvedValue(null);

    await expect(
      repository.findByIdInOrganisation('org-1', 'plan-1'),
    ).resolves.toBeNull();

    expect(onboardingFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'plan-1',
          employee: { organisationId: 'org-1' },
        },
      }),
    );
  });

  it('lists only within the organisation and applies filters', async () => {
    onboardingCount.mockResolvedValue(0);
    onboardingFindMany.mockResolvedValue([]);
    transaction.mockImplementation(async (ops: Promise<unknown>[]) =>
      Promise.all(ops),
    );

    await repository.list({
      organisationId: 'org-1',
      page: 1,
      size: 20,
      employeeId: 'emp-1',
      status: OnboardingStatus.IN_PROGRESS,
    });

    expect(onboardingCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employee: { organisationId: 'org-1' },
          employeeId: 'emp-1',
          status: OnboardingStatus.IN_PROGRESS,
        }),
      }),
    );
  });

  it('returns not found when updating outside organisation scope', async () => {
    onboardingFindFirst.mockResolvedValue(null);

    await expect(
      repository.update({
        organisationId: 'org-1',
        onboardingId: 'plan-other',
        name: 'Updated',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
