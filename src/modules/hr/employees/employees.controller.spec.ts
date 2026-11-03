import { UnauthorizedException } from '@nestjs/common';
import {
  EmploymentStatus,
  EmploymentType,
} from '../../../generated/prisma/client';
import { PERMISSIONS_KEY } from '../../authorization/authorization.constants';
import { EmployeesService } from './application/employees.service';
import { EMPLOYEE_PERMISSIONS } from './domain/employee-permissions';
import { EmployeesController } from './employees.controller';

describe('EmployeesController', () => {
  const create = jest.fn();
  const list = jest.fn();
  const findOne = jest.fn();
  const update = jest.fn();
  const changeStatus = jest.fn();
  const service = {
    create,
    list,
    findOne,
    update,
    changeStatus,
  } as unknown as EmployeesService;

  let controller: EmployeesController;

  const actor = {
    id: 'user-1',
    organisationId: 'org-1',
    email: 'hr@neukleos.com',
    employeeId: null,
    permissions: [EMPLOYEE_PERMISSIONS.READ],
  };

  const employee = {
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
    status: EmploymentStatus.ACTIVE,
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
    controller = new EmployeesController(service);
  });

  it('requires an authenticated user', async () => {
    await expect(
      controller.list(undefined, { page: 1, size: 20 }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('declares the expected permissions on each route', () => {
    const route = (methodName: string): object => {
      const handler = Object.getOwnPropertyDescriptor(
        EmployeesController.prototype,
        methodName,
      )?.value;
      if (typeof handler !== 'function') {
        throw new Error(`Missing route handler: ${methodName}`);
      }
      return handler as object;
    };

    expect(Reflect.getMetadata(PERMISSIONS_KEY, route('create'))).toEqual([
      EMPLOYEE_PERMISSIONS.CREATE,
    ]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, route('list'))).toEqual([
      EMPLOYEE_PERMISSIONS.READ,
    ]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, route('findOne'))).toEqual([
      EMPLOYEE_PERMISSIONS.READ,
    ]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, route('update'))).toEqual([
      EMPLOYEE_PERMISSIONS.UPDATE,
    ]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, route('changeStatus'))).toEqual(
      [EMPLOYEE_PERMISSIONS.STATUS_CHANGE],
    );
  });

  it('returns ISO dates in responses', async () => {
    findOne.mockResolvedValue(employee);

    await expect(controller.findOne(actor, 'emp-1')).resolves.toEqual(
      expect.objectContaining({
        id: 'emp-1',
        hireDate: '2026-01-01T00:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    );
  });

  it('maps list results through the response DTO', async () => {
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

    const result = await controller.list(actor, { page: 1, size: 20 });
    expect(result.data[0].workEmail).toBe('ada@neukleos.com');
    expect(result.meta.totalItems).toBe(1);
  });
});
