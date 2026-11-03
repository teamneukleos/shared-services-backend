import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  EmploymentStatus,
  EmploymentType,
} from '../../../../generated/prisma/client';
import { EmployeeRecord } from '../domain/employee.types';

export class EmployeeResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  organisationId!: string;

  @ApiProperty({ example: 'NK-0042' })
  employeeNumber!: string;

  @ApiProperty({ example: 'Ada' })
  firstName!: string;

  @ApiProperty({ example: 'Lovelace' })
  lastName!: string;

  @ApiPropertyOptional({ nullable: true, example: 'Ada' })
  preferredName!: string | null;

  @ApiProperty({ example: 'ada@neukleos.com' })
  workEmail!: string;

  @ApiPropertyOptional({ nullable: true, example: '+447700900123' })
  phone!: string | null;

  @ApiProperty({ format: 'uuid' })
  departmentId!: string;

  @ApiProperty({ example: 'Engineering' })
  departmentName!: string;

  @ApiProperty({ example: 'Software Engineer' })
  jobTitle!: string;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  positionId!: string | null;

  @ApiProperty({ enum: EmploymentType })
  employmentType!: EmploymentType;

  @ApiProperty({ enum: EmploymentStatus })
  status!: EmploymentStatus;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-01-15T00:00:00.000Z',
  })
  hireDate!: string;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    format: 'date-time',
  })
  terminationDate!: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  managerId!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Grace Hopper' })
  managerName!: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  userAccountId!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export function toEmployeeResponse(
  record: EmployeeRecord,
): EmployeeResponseDto {
  return {
    id: record.id,
    organisationId: record.organisationId,
    employeeNumber: record.employeeNumber,
    firstName: record.firstName,
    lastName: record.lastName,
    preferredName: record.preferredName,
    workEmail: record.workEmail,
    phone: record.phone,
    departmentId: record.departmentId,
    departmentName: record.departmentName,
    jobTitle: record.jobTitle,
    positionId: record.positionId,
    employmentType: record.employmentType,
    status: record.status,
    hireDate: record.hireDate.toISOString(),
    terminationDate: record.terminationDate
      ? record.terminationDate.toISOString()
      : null,
    managerId: record.managerId,
    managerName: record.managerName,
    userAccountId: record.userAccountId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
