import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  OnboardingStatus,
  OnboardingTaskStatus,
} from '../../../../generated/prisma/client';
import {
  OnboardingRecord,
  OnboardingTaskRecord,
} from '../domain/onboarding.types';

export class OnboardingTaskResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  planId!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ nullable: true })
  category!: string | null;

  @ApiProperty()
  isRequired!: boolean;

  @ApiProperty({ enum: OnboardingTaskStatus })
  status!: OnboardingTaskStatus;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  dueDate!: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  assigneeUserId!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  completedAt!: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  completedByUserId!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export class OnboardingResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  organisationId!: string;

  @ApiProperty({ format: 'uuid' })
  employeeId!: string;

  @ApiProperty({ example: 'NK-0042' })
  employeeNumber!: string;

  @ApiProperty({ example: 'Ada Lovelace' })
  employeeName!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  notes!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  startDate!: string;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  targetCompletionDate!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  completedAt!: string | null;

  @ApiProperty({ enum: OnboardingStatus })
  status!: OnboardingStatus;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  coordinatorUserId!: string | null;

  @ApiProperty({ type: [OnboardingTaskResponseDto] })
  tasks!: OnboardingTaskResponseDto[];

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export function toOnboardingTaskResponse(
  task: OnboardingTaskRecord,
): OnboardingTaskResponseDto {
  return {
    id: task.id,
    planId: task.planId,
    title: task.title,
    description: task.description,
    category: task.category,
    isRequired: task.isRequired,
    status: task.status,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    assigneeUserId: task.assigneeUserId,
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    completedByUserId: task.completedByUserId,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

export function toOnboardingResponse(
  record: OnboardingRecord,
): OnboardingResponseDto {
  return {
    id: record.id,
    organisationId: record.organisationId,
    employeeId: record.employeeId,
    employeeNumber: record.employeeNumber,
    employeeName: record.employeeName,
    name: record.name,
    notes: record.notes,
    startDate: record.startDate.toISOString(),
    targetCompletionDate: record.targetCompletionDate
      ? record.targetCompletionDate.toISOString()
      : null,
    completedAt: record.completedAt ? record.completedAt.toISOString() : null,
    status: record.status,
    coordinatorUserId: record.coordinatorUserId,
    tasks: record.tasks.map(toOnboardingTaskResponse),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
