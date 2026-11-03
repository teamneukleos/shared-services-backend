import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  EmploymentStatus,
  EmploymentType,
} from '../../../../generated/prisma/client';
import { CreateEmployeeDto } from './create-employee.dto';
import { ListEmployeesQueryDto } from './list-employees-query.dto';
import { ChangeEmployeeStatusDto } from './change-employee-status.dto';
import { UpdateEmployeeDto } from './update-employee.dto';

async function validateCreate(plain: Record<string, unknown>) {
  const dto = plainToInstance(CreateEmployeeDto, plain);
  return { dto, errors: await validate(dto) };
}

describe('CreateEmployeeDto', () => {
  const valid = {
    employeeNumber: 'E-001',
    firstName: 'Ada',
    lastName: 'Lovelace',
    workEmail: 'ada@neukleos.com',
    departmentId: '11111111-1111-4111-8111-111111111111',
    jobTitle: 'Engineer',
    employmentType: EmploymentType.FULL_TIME,
    hireDate: '2026-01-01T00:00:00.000Z',
  };

  it('accepts a valid payload', async () => {
    const { errors } = await validateCreate(valid);
    expect(errors).toHaveLength(0);
  });

  it('rejects missing required fields', async () => {
    const { errors } = await validateCreate({});
    const properties = errors.map((error) => error.property);
    expect(properties).toEqual(
      expect.arrayContaining([
        'employeeNumber',
        'firstName',
        'lastName',
        'workEmail',
        'departmentId',
        'jobTitle',
        'employmentType',
        'hireDate',
      ]),
    );
  });

  it('rejects invalid email and employment type', async () => {
    const { errors } = await validateCreate({
      ...valid,
      workEmail: 'not-an-email',
      employmentType: 'CONTRACTOR',
    });

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['workEmail', 'employmentType']),
    );
  });

  it('transforms hireDate to Date', async () => {
    const { dto, errors } = await validateCreate(valid);
    expect(errors).toHaveLength(0);
    expect(dto.hireDate).toBeInstanceOf(Date);
  });
});

describe('UpdateEmployeeDto', () => {
  it('does not require fields and accepts nullables', async () => {
    const dto = plainToInstance(UpdateEmployeeDto, {
      preferredName: null,
      phone: null,
      managerId: null,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid work email', async () => {
    const dto = plainToInstance(UpdateEmployeeDto, {
      workEmail: 'bad',
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'workEmail')).toBe(true);
  });
});

describe('ListEmployeesQueryDto', () => {
  it('inherits pagination defaults and accepts filters', async () => {
    const dto = plainToInstance(ListEmployeesQueryDto, {
      search: 'Ada',
      status: EmploymentStatus.ACTIVE,
      employmentType: EmploymentType.FULL_TIME,
      departmentId: '11111111-1111-4111-8111-111111111111',
      managerId: '22222222-2222-4222-8222-222222222222',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.size).toBe(20);
  });

  it('rejects invalid enum filters and oversized pages', async () => {
    const dto = plainToInstance(ListEmployeesQueryDto, {
      status: 'UNKNOWN',
      size: 101,
    });
    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['status', 'size']),
    );
  });
});

describe('ChangeEmployeeStatusDto', () => {
  it('requires a valid status', async () => {
    const dto = plainToInstance(ChangeEmployeeStatusDto, {});
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'status')).toBe(true);
  });

  it('accepts termination metadata', async () => {
    const dto = plainToInstance(ChangeEmployeeStatusDto, {
      status: EmploymentStatus.TERMINATED,
      terminationDate: '2026-06-01T00:00:00.000Z',
      reason: 'Contract ended',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.terminationDate).toBeInstanceOf(Date);
  });
});
