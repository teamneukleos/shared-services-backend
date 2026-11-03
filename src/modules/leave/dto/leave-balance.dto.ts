import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { LeaveBalanceRecord } from '../domain/leave.types';

export class CreateLeaveBalanceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  employeeId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  leaveTypeId!: string;

  @ApiProperty({
    example: 20,
    description: 'Initial entitlement in leave units (calendar days for DAYS)',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  entitled!: number;
}

export class ListLeaveBalancesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  leaveTypeId?: string;
}

export class LeaveBalanceResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  organisationId!: string;

  @ApiProperty({ format: 'uuid' })
  employeeId!: string;

  @ApiProperty()
  employeeNumber!: string;

  @ApiProperty()
  employeeName!: string;

  @ApiProperty({ format: 'uuid' })
  leaveTypeId!: string;

  @ApiProperty()
  leaveTypeCode!: string;

  @ApiProperty()
  leaveTypeName!: string;

  @ApiProperty()
  entitled!: number;

  @ApiProperty()
  available!: number;

  @ApiProperty()
  reserved!: number;

  @ApiProperty()
  used!: number;

  @ApiProperty()
  version!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export function toLeaveBalanceResponse(
  record: LeaveBalanceRecord,
): LeaveBalanceResponseDto {
  return {
    id: record.id,
    organisationId: record.organisationId,
    employeeId: record.employeeId,
    employeeNumber: record.employeeNumber,
    employeeName: record.employeeName,
    leaveTypeId: record.leaveTypeId,
    leaveTypeCode: record.leaveTypeCode,
    leaveTypeName: record.leaveTypeName,
    entitled: record.entitled,
    available: record.available,
    reserved: record.reserved,
    used: record.used,
    version: record.version,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
