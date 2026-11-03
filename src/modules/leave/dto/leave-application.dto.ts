import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { LeaveRequestStatus } from '../../../generated/prisma/client';
import { LeaveApplicationRecord } from '../domain/leave.types';

export class CreateLeaveApplicationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  leaveTypeId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  startDate!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  endDate!: Date;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class RejectLeaveApplicationDto {
  @ApiProperty({ maxLength: 1000, example: 'Insufficient coverage' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}

export class ListLeaveApplicationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  leaveTypeId?: string;

  @ApiPropertyOptional({ enum: LeaveRequestStatus })
  @IsOptional()
  @IsEnum(LeaveRequestStatus)
  status?: LeaveRequestStatus;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDateFrom?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDateTo?: Date;
}

export class LeaveApplicationResponseDto {
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

  @ApiProperty({ type: String, format: 'date-time' })
  startDate!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  endDate!: string;

  @ApiProperty({
    description: 'Inclusive calendar days (weekends/holidays included)',
  })
  quantity!: number;

  @ApiPropertyOptional({ nullable: true })
  reason!: string | null;

  @ApiProperty({ enum: LeaveRequestStatus })
  status!: LeaveRequestStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  submittedAt!: string;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  reviewedAt!: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  reviewedByUserId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  reviewComment!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export function toLeaveApplicationResponse(
  record: LeaveApplicationRecord,
): LeaveApplicationResponseDto {
  return {
    id: record.id,
    organisationId: record.organisationId,
    employeeId: record.employeeId,
    employeeNumber: record.employeeNumber,
    employeeName: record.employeeName,
    leaveTypeId: record.leaveTypeId,
    leaveTypeCode: record.leaveTypeCode,
    leaveTypeName: record.leaveTypeName,
    startDate: record.startDate.toISOString(),
    endDate: record.endDate.toISOString(),
    quantity: record.quantity,
    reason: record.reason,
    status: record.status,
    submittedAt: record.submittedAt.toISOString(),
    reviewedAt: record.reviewedAt?.toISOString() ?? null,
    reviewedByUserId: record.reviewedByUserId,
    reviewComment: record.reviewComment,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
