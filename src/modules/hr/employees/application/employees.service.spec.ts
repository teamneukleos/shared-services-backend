import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuditService } from '../../../audit/application/audit.service';
import { AuditAction } from '../../../audit/domain/audit-action.enum';
import { AuthenticatedUser } from '../../../authorization/domain/authenticated-user.interface';
import {
  EmploymentStatus,
  EmploymentType,
} from '../../../../generated/prisma/client';
import { EmployeeRepository } from '../domain/employee.repository';
import { EmployeeRecord } from '../domain/employee.types';
import { EmployeesService } from './employees.service';

describe('EmployeesService', () => {
  const create = jest.fn();
  const findByIdInOrganisation = jest.fn();
  const list = jest.fn();
  const update = jest.fn();
  const changeStatus = jest.fn();
  const record = jest.fn();

  const repository = {
    create,
    findByIdInOrganisation,
    list,
    update,
    changeStatus,
  } as unknown as EmployeeRepository;

  const auditService = { record } as unknown as AuditService;
  let service: EmployeesService;

  const actor: AuthenticatedUser = {
    id: 'user-1',
    organisationId: 'org-1',
    email: 'hr@neukleos.com',
    employeeId: null,
    permissions: ['employee.create', 'employee.read', 'employee.update'],
  };

  const employee: EmployeeRecord = {
    id: 'emp-1',
    organisationId: 'org-1',
    employeeNumber: 'E-001',
    firstName: 'Ada',
    lastName: 'Lovelace',
    preferredName: null,
    workEmail: 'ada@neukleos.com',
    phone: null,
    departmentId: 'dept-1',
    departmentName: 'Engineering',
    jobTitle: 'Engineer',
    positionId: null,
    employmentType: EmploymentType.FULL_TIME,
    status: EmploymentStatus.PENDING,
    hireDate: new Date('2026-01-01T00:00:00.000Z'),
    terminationDate: null,
    managerId: null,
    managerName: null,
    userAccountId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    record.mockResolvedValue(undefined);
    service = new EmployeesService(repository, auditService);
  });

  it('creates an employee in the actor organisation and audits', async () => {
    create.mockResolvedValue(employee);

    await expect(
      service.create(actor, {
        employeeNumber: 'E-001',
        firstName: 'Ada',
        lastName: 'Lovelace',
        workEmail: 'ada@neukleos.com',
        departmentId: 'dept-1',
        jobTitle: 'Engineer',
        employmentType: EmploymentType.FULL_TIME,
        hireDate: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ).resolves.toEqual(employee);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ organisationId: 'org-1' }),
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CREATE,
        resourceType: 'Employee',
        resourceId: 'emp-1',
        organisationId: 'org-1',
      }),
    );
  });

  it('rejects access without organisation context', async () => {
    await expect(
      service.list({ ...actor, organisationId: '' }, { page: 1, size: 20 }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns not found for employees outside the organisation scope', async () => {
    findByIdInOrganisation.mockResolvedValue(null);

    await expect(service.findOne(actor, 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(findByIdInOrganisation).toHaveBeenCalledWith('org-1', 'missing');
  });

  it('rejects invalid status transitions', async () => {
    findByIdInOrganisation.mockResolvedValue(employee);

    await expect(
      service.changeStatus(actor, 'emp-1', {
        status: EmploymentStatus.SUSPENDED,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(changeStatus).not.toHaveBeenCalled();
  });

  it('changes status through a valid transition and audits', async () => {
    findByIdInOrganisation.mockResolvedValue(employee);
    changeStatus.mockResolvedValue({
      ...employee,
      status: EmploymentStatus.ACTIVE,
    });

    await expect(
      service.changeStatus(actor, 'emp-1', {
        status: EmploymentStatus.ACTIVE,
        reason: 'Onboarding complete',
      }),
    ).resolves.toEqual(
      expect.objectContaining({ status: EmploymentStatus.ACTIVE }),
    );

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.UPDATE,
        reason: 'Onboarding complete',
        oldValues: expect.objectContaining({
          status: EmploymentStatus.PENDING,
        }),
        newValues: expect.objectContaining({ status: EmploymentStatus.ACTIVE }),
      }),
    );
  });

  it('lists with organisation scoping', async () => {
    list.mockResolvedValue({
      data: [employee],
      meta: {
        page: 1,
        size: 20,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });

    await service.list(actor, {
      page: 1,
      size: 20,
      search: 'Ada',
      status: EmploymentStatus.PENDING,
    });

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: 'org-1',
        search: 'Ada',
        status: EmploymentStatus.PENDING,
      }),
    );
  });

  it('updates an employee and audits the change', async () => {
    findByIdInOrganisation.mockResolvedValue(employee);
    update.mockResolvedValue({
      ...employee,
      jobTitle: 'Senior Engineer',
    });

    await expect(
      service.update(actor, 'emp-1', { jobTitle: 'Senior Engineer' }),
    ).resolves.toEqual(
      expect.objectContaining({ jobTitle: 'Senior Engineer' }),
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: 'org-1',
        employeeId: 'emp-1',
        jobTitle: 'Senior Engineer',
      }),
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.UPDATE,
        resourceType: 'Employee',
        resourceId: 'emp-1',
      }),
    );
  });

  it('rejects terminationDate earlier than hireDate', async () => {
    await expect(
      service.create(actor, {
        employeeNumber: 'E-002',
        firstName: 'Grace',
        lastName: 'Hopper',
        workEmail: 'grace@neukleos.com',
        departmentId: 'dept-1',
        jobTitle: 'Engineer',
        employmentType: EmploymentType.FULL_TIME,
        hireDate: new Date('2026-06-01T00:00:00.000Z'),
        terminationDate: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects terminationDate when status is not TERMINATED', async () => {
    findByIdInOrganisation.mockResolvedValue({
      ...employee,
      status: EmploymentStatus.ACTIVE,
    });

    await expect(
      service.changeStatus(actor, 'emp-1', {
        status: EmploymentStatus.SUSPENDED,
        terminationDate: new Date('2026-06-01T00:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(changeStatus).not.toHaveBeenCalled();
  });
});
