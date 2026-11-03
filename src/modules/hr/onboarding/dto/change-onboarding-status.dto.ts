import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { OnboardingStatus } from '../../../../generated/prisma/client';

export class ChangeOnboardingStatusDto {
  @ApiProperty({
    enum: OnboardingStatus,
    example: OnboardingStatus.IN_PROGRESS,
    description:
      'Allowed: NOT_STARTED→IN_PROGRESS|CANCELLED, IN_PROGRESS→COMPLETED|CANCELLED. COMPLETED requires all required tasks COMPLETED (SKIPPED does not satisfy required tasks).',
  })
  @IsEnum(OnboardingStatus)
  status!: OnboardingStatus;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
