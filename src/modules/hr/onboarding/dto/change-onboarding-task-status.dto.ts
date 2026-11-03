import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { OnboardingTaskStatus } from '../../../../generated/prisma/client';

export class ChangeOnboardingTaskStatusDto {
  @ApiProperty({
    enum: OnboardingTaskStatus,
    example: OnboardingTaskStatus.COMPLETED,
    description:
      'Required tasks cannot transition to SKIPPED. SKIPPED is allowed only for optional tasks.',
  })
  @IsEnum(OnboardingTaskStatus)
  status!: OnboardingTaskStatus;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
