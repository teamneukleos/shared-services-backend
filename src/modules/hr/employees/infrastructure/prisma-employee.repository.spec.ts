import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma/prisma.service';
import {
  EmploymentStatus,
  EmploymentType,
  Prisma,
} from '../../../../generated/prisma/client';
import { PrismaEmployeeRepository } from './prisma-employee.repository';

describe('PrismaEmployeeRepository', () => {
  const departmentFindFirst = jest.fn();
  const employeeFindFirst = jest.fn();
  const employeeFindMany = jest.fn();
  const employeeCount = jest.fn();
  const userAccountFindFirst = jest.fn();
  const transaction = jest.fn();

  const prisma = {
    department: { findFirst: departmentFindFirst },
    employee: {
      findFirst: employeeFindFirst,
      findMany: employeeFindMany,
      count: employeeCount,
    },
    userAccount: { findFirst: userAccountFindFirst },
    $transaction: transaction,
  } as unknown as PrismaService;

  let repository: PrismaEmployeeRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new PrismaEmployeeRepository(prisma);
  });

  it('scopes findById lookups to the organisation', async () => {
    employeeFindFirst.mockResolvedValue(null);

    await expect(
      repository.findByIdInOrganisation('org-1', 'emp-1'),
    ).resolves.toBeNull();

    expect(employeeFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'emp-1', organisationId: 'org-1' },
      }),
    );
  });

  it('rejects departments outside the organisation on create', async () => {
    departmentFindFirst.mockResolvedValue(null);

    await expect(
      repository.create({
        organisationId: 'org-1',
        employeeNumber: 'E-001',
        firstName: 'Ada',
        lastName: 'Lovelace',
        workEmail: 'ada@neukleos.com',
        departmentId: 'dept-other',
        jobTitle: 'Engineer',
        employmentType: EmploymentType.FULL_TIME,
        hireDate: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects managers outside the organisation', async () => {
    departmentFindFirst.mockResolvedValue({ id: 'dept-1' });
    employeeFindFirst.mockResolvedValue(null);

    await expect(
      repository.create({
        organisationId: 'org-1',
        employeeNumber: 'E-001',
        firstName: 'Ada',
        lastName: 'Lovelace',
        workEmail: 'ada@neukleos.com',
        departmentId: 'dept-1',
        jobTitle: 'Engineer',
        employmentType: EmploymentType.FULL_TIME,
        hireDate: new Date('2026-01-01T00:00:00.000Z'),
        managerId: 'mgr-other-org',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects user accounts already linked to another employee', async () => {
    departmentFindFirst.mockResolvedValue({ id: 'dept-1' });
    userAccountFindFirst.mockResolvedValue({
      id: 'user-2',
      employeeId: 'emp-other',
    });

    await expect(
      repository.create({
        organisationId: 'org-1',
        employeeNumber: 'E-001',
        firstName: 'Ada',
        lastName: 'Lovelace',
        workEmail: 'ada@neukleos.com',
        departmentId: 'dept-1',
        jobTitle: 'Engineer',
        employmentType: EmploymentType.FULL_TIME,
        hireDate: new Date('2026-01-01T00:00:00.000Z'),
        userAccountId: 'user-2',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps unique employee number conflicts', async () => {
    departmentFindFirst.mockResolvedValue({ id: 'dept-1' });
    transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['organisationId', 'employeeNumber'] },
      }),
    );

    await expect(
      repository.create({
        organisationId: 'org-1',
        employeeNumber: 'E-001',
        firstName: 'Ada',
        lastName: 'Lovelace',
        workEmail: 'ada@neukleos.com',
        departmentId: 'dept-1',
        jobTitle: 'Engineer',
        employmentType: EmploymentType.FULL_TIME,
        hireDate: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lists only within the organisation and applies filters', async () => {
    employeeCount.mockResolvedValue(1);
    employeeFindMany.mockResolvedValue([
      {
        id: 'emp-1',
        organisationId: 'org-1',
        employeeNumber: 'E-001',
        workEmail: 'ada@neukleos.com',
        jobTitle: 'Engineer',
        departmentId: 'dept-1',
        positionId: null,
        employmentType: EmploymentType.FULL_TIME,
        status: EmploymentStatus.ACTIVE,
        hireDate: new Date('2026-01-01T00:00:00.000Z'),
        terminationDate: null,
        managerId: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        person: {
          firstName: 'Ada',
          lastName: 'Lovelace',
          preferredName: null,
          phone: null,
        },
        department: { name: 'Engineering' },
        manager: null,
        userAccount: null,
      },
    ]);
    transaction.mockImplementation(async (ops: Promise<unknown>[]) =>
      Promise.all(ops),
    );

    const result = await repository.list({
      organisationId: 'org-1',
      page: 1,
      size: 20,
      search: 'Ada',
      departmentId: 'dept-1',
      status: EmploymentStatus.ACTIVE,
      employmentType: EmploymentType.FULL_TIME,
      managerId: undefined,
    });

    expect(result.meta.totalItems).toBe(1);
    expect(employeeCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId: 'org-1',
          departmentId: 'dept-1',
          status: EmploymentStatus.ACTIVE,
        }),
      }),
    );
  });

  it('returns not found when updating outside organisation scope', async () => {
    employeeFindFirst.mockResolvedValue(null);

    await expect(
      repository.update({
        organisationId: 'org-1',
        employeeId: 'emp-other',
        jobTitle: 'Updated',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
