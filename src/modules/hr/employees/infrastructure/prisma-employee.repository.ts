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
  EmploymentStatus,
  Prisma,
  RecordStatus,
} from '../../../../generated/prisma/client';
import { EmployeeRepository } from '../domain/employee.repository';
import {
  ChangeEmployeeStatusInput,
  CreateEmployeeInput,
  EmployeeRecord,
  ListEmployeesQuery,
  UpdateEmployeeInput,
} from '../domain/employee.types';

type EmployeeRow = {
  id: string;
  organisationId: string;
  employeeNumber: string;
  workEmail: string;
  jobTitle: string;
  departmentId: string;
  positionId: string | null;
  employmentType: EmployeeRecord['employmentType'];
  status: EmploymentStatus;
  hireDate: Date;
  terminationDate: Date | null;
  managerId: string | null;
  createdAt: Date;
  updatedAt: Date;
  person: {
    firstName: string;
    lastName: string;
    preferredName: string | null;
    phone: string | null;
  };
  department: {
    name: string;
  };
  manager: {
    person: {
      firstName: string;
      lastName: string;
    };
  } | null;
  userAccount: {
    id: string;
  } | null;
};

const employeeInclude = {
  person: {
    select: {
      firstName: true,
      lastName: true,
      preferredName: true,
      phone: true,
    },
  },
  department: {
    select: {
      name: true,
    },
  },
  manager: {
    select: {
      person: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  },
  userAccount: {
    select: {
      id: true,
    },
  },
} as const;

@Injectable()
export class PrismaEmployeeRepository implements EmployeeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateEmployeeInput): Promise<EmployeeRecord> {
    await this.assertDepartmentInOrganisation(
      input.organisationId,
      input.departmentId,
    );
    if (input.positionId) {
      await this.assertPositionInDepartment(
        input.departmentId,
        input.positionId,
      );
    }
    if (input.teamId) {
      await this.assertTeamInDepartment(input.departmentId, input.teamId);
    }
    if (input.managerId) {
      await this.assertEmployeeInOrganisation(
        input.organisationId,
        input.managerId,
      );
    }
    if (input.userAccountId) {
      await this.assertLinkableUserAccount(
        input.organisationId,
        input.userAccountId,
      );
    }

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const person = await tx.person.create({
          data: {
            firstName: input.firstName.trim(),
            lastName: input.lastName.trim(),
            preferredName: input.preferredName?.trim() || null,
            phone: input.phone?.trim() || null,
          },
        });

        const employee = await tx.employee.create({
          data: {
            organisationId: input.organisationId,
            employeeNumber: input.employeeNumber.trim(),
            personId: person.id,
            workEmail: input.workEmail.trim().toLowerCase(),
            jobTitle: input.jobTitle.trim(),
            departmentId: input.departmentId,
            positionId: input.positionId,
            teamId: input.teamId,
            managerId: input.managerId,
            employmentType: input.employmentType,
            status: input.status ?? EmploymentStatus.PENDING,
            hireDate: input.hireDate,
            terminationDate: input.terminationDate,
            employments: {
              create: {
                type: input.employmentType,
                startDate: input.hireDate,
                endDate: input.terminationDate,
              },
            },
          },
          include: employeeInclude,
        });

        if (input.userAccountId) {
          await tx.userAccount.update({
            where: { id: input.userAccountId },
            data: { employeeId: employee.id },
          });
        }

        return tx.employee.findUniqueOrThrow({
          where: { id: employee.id },
          include: employeeInclude,
        });
      });

      return this.toRecord(created);
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  async findByIdInOrganisation(
    organisationId: string,
    employeeId: string,
  ): Promise<EmployeeRecord | null> {
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        organisationId,
      },
      include: employeeInclude,
    });

    return employee ? this.toRecord(employee) : null;
  }

  async list(query: ListEmployeesQuery) {
    const { skip, take } = getPaginationSkipTake(query.page, query.size);
    const where: Prisma.EmployeeWhereInput = {
      organisationId: query.organisationId,
    };

    if (query.departmentId) {
      where.departmentId = query.departmentId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.employmentType) {
      where.employmentType = query.employmentType;
    }
    if (query.managerId) {
      where.managerId = query.managerId;
    }
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { employeeNumber: { contains: term, mode: 'insensitive' } },
        { workEmail: { contains: term, mode: 'insensitive' } },
        { jobTitle: { contains: term, mode: 'insensitive' } },
        {
          person: {
            OR: [
              { firstName: { contains: term, mode: 'insensitive' } },
              { lastName: { contains: term, mode: 'insensitive' } },
              { preferredName: { contains: term, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const [totalItems, rows] = await this.prisma.$transaction([
      this.prisma.employee.count({ where }),
      this.prisma.employee.findMany({
        where,
        include: employeeInclude,
        orderBy: [
          { person: { lastName: 'asc' } },
          { person: { firstName: 'asc' } },
          { employeeNumber: 'asc' },
        ],
        skip,
        take,
      }),
    ]);

    return createPaginatedResult(
      rows.map((row) => this.toRecord(row)),
      query.page,
      query.size,
      totalItems,
    );
  }

  async update(input: UpdateEmployeeInput): Promise<EmployeeRecord> {
    const existing = await this.prisma.employee.findFirst({
      where: {
        id: input.employeeId,
        organisationId: input.organisationId,
      },
      select: {
        id: true,
        personId: true,
        departmentId: true,
        userAccount: { select: { id: true } },
      },
    });

    if (!existing) {
      throw new NotFoundException('Employee not found');
    }

    const nextDepartmentId = input.departmentId ?? existing.departmentId;
    if (input.departmentId) {
      await this.assertDepartmentInOrganisation(
        input.organisationId,
        input.departmentId,
      );
    }
    if (input.positionId) {
      await this.assertPositionInDepartment(nextDepartmentId, input.positionId);
    }
    if (input.teamId) {
      await this.assertTeamInDepartment(nextDepartmentId, input.teamId);
    }
    if (input.managerId) {
      if (input.managerId === input.employeeId) {
        throw new BadRequestException('An employee cannot manage themselves');
      }
      await this.assertEmployeeInOrganisation(
        input.organisationId,
        input.managerId,
      );
    }
    if (input.userAccountId) {
      await this.assertLinkableUserAccount(
        input.organisationId,
        input.userAccountId,
        input.employeeId,
      );
    }

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.person.update({
          where: { id: existing.personId },
          data: {
            ...(input.firstName !== undefined
              ? { firstName: input.firstName.trim() }
              : {}),
            ...(input.lastName !== undefined
              ? { lastName: input.lastName.trim() }
              : {}),
            ...(input.preferredName !== undefined
              ? {
                  preferredName:
                    input.preferredName === null
                      ? null
                      : input.preferredName.trim() || null,
                }
              : {}),
            ...(input.phone !== undefined
              ? {
                  phone:
                    input.phone === null ? null : input.phone.trim() || null,
                }
              : {}),
          },
        });

        await tx.employee.update({
          where: { id: existing.id },
          data: {
            ...(input.workEmail !== undefined
              ? { workEmail: input.workEmail.trim().toLowerCase() }
              : {}),
            ...(input.jobTitle !== undefined
              ? { jobTitle: input.jobTitle.trim() }
              : {}),
            ...(input.departmentId !== undefined
              ? { departmentId: input.departmentId }
              : {}),
            ...(input.positionId !== undefined
              ? { positionId: input.positionId }
              : {}),
            ...(input.teamId !== undefined ? { teamId: input.teamId } : {}),
            ...(input.employmentType !== undefined
              ? { employmentType: input.employmentType }
              : {}),
            ...(input.hireDate !== undefined
              ? { hireDate: input.hireDate }
              : {}),
            ...(input.terminationDate !== undefined
              ? { terminationDate: input.terminationDate }
              : {}),
            ...(input.managerId !== undefined
              ? { managerId: input.managerId }
              : {}),
            version: { increment: 1 },
          },
        });

        if (input.userAccountId !== undefined) {
          if (
            existing.userAccount?.id &&
            existing.userAccount.id !== input.userAccountId
          ) {
            await tx.userAccount.update({
              where: { id: existing.userAccount.id },
              data: { employeeId: null },
            });
          }
          if (input.userAccountId) {
            await tx.userAccount.update({
              where: { id: input.userAccountId },
              data: { employeeId: existing.id },
            });
          }
        }

        return tx.employee.findUniqueOrThrow({
          where: { id: existing.id },
          include: employeeInclude,
        });
      });

      return this.toRecord(updated);
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  async changeStatus(
    input: ChangeEmployeeStatusInput,
  ): Promise<EmployeeRecord> {
    const existing = await this.prisma.employee.findFirst({
      where: {
        id: input.employeeId,
        organisationId: input.organisationId,
      },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Employee not found');
    }

    const data: Prisma.EmployeeUpdateInput = {
      status: input.status,
      version: { increment: 1 },
    };

    if (input.terminationDate !== undefined) {
      data.terminationDate = input.terminationDate;
    } else if (input.status === EmploymentStatus.TERMINATED) {
      data.terminationDate = new Date();
    } else if (
      input.status === EmploymentStatus.ACTIVE ||
      input.status === EmploymentStatus.SUSPENDED ||
      input.status === EmploymentStatus.PENDING
    ) {
      data.terminationDate = null;
    }

    const updated = await this.prisma.employee.update({
      where: { id: existing.id },
      data,
      include: employeeInclude,
    });

    return this.toRecord(updated);
  }

  private async assertDepartmentInOrganisation(
    organisationId: string,
    departmentId: string,
  ): Promise<void> {
    const department = await this.prisma.department.findFirst({
      where: {
        id: departmentId,
        businessUnit: { organisationId },
      },
      select: { id: true },
    });
    if (!department) {
      throw new BadRequestException(
        'Department does not belong to this organisation',
      );
    }
  }

  private async assertPositionInDepartment(
    departmentId: string,
    positionId: string,
  ): Promise<void> {
    const position = await this.prisma.position.findFirst({
      where: { id: positionId, departmentId },
      select: { id: true },
    });
    if (!position) {
      throw new BadRequestException(
        'Position does not belong to the selected department',
      );
    }
  }

  private async assertTeamInDepartment(
    departmentId: string,
    teamId: string,
  ): Promise<void> {
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, departmentId },
      select: { id: true },
    });
    if (!team) {
      throw new BadRequestException(
        'Team does not belong to the selected department',
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
        'Manager does not belong to this organisation',
      );
    }
  }

  private async assertLinkableUserAccount(
    organisationId: string,
    userAccountId: string,
    employeeId?: string,
  ): Promise<void> {
    const account = await this.prisma.userAccount.findFirst({
      where: {
        id: userAccountId,
        organisationId,
        status: RecordStatus.ACTIVE,
      },
      select: { id: true, employeeId: true },
    });
    if (!account) {
      throw new BadRequestException(
        'User account does not belong to this organisation',
      );
    }
    if (account.employeeId && account.employeeId !== employeeId) {
      throw new ConflictException(
        'User account is already linked to another employee',
      );
    }
  }

  private rethrowUniqueConflict(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const rawTarget = error.meta?.target;
      const target = Array.isArray(rawTarget)
        ? rawTarget.map(String).join(',')
        : typeof rawTarget === 'string'
          ? rawTarget
          : '';
      if (target.includes('employeeNumber')) {
        throw new ConflictException(
          'Employee number already exists in this organisation',
        );
      }
      if (target.includes('workEmail')) {
        throw new ConflictException(
          'Work email already exists in this organisation',
        );
      }
      throw new ConflictException(
        'Employee record conflicts with existing data',
      );
    }
  }

  private toRecord(row: EmployeeRow): EmployeeRecord {
    return {
      id: row.id,
      organisationId: row.organisationId,
      employeeNumber: row.employeeNumber,
      firstName: row.person.firstName,
      lastName: row.person.lastName,
      preferredName: row.person.preferredName,
      workEmail: row.workEmail,
      phone: row.person.phone,
      departmentId: row.departmentId,
      departmentName: row.department.name,
      jobTitle: row.jobTitle,
      positionId: row.positionId,
      employmentType: row.employmentType,
      status: row.status,
      hireDate: row.hireDate,
      terminationDate: row.terminationDate,
      managerId: row.managerId,
      managerName: row.manager
        ? `${row.manager.person.firstName} ${row.manager.person.lastName}`
        : null,
      userAccountId: row.userAccount?.id ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
