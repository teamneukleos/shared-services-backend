import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { EmploymentStatus } from '../../../../generated/prisma/client';

export class ChangeEmployeeStatusDto {
  @ApiProperty({
    enum: EmploymentStatus,
    example: EmploymentStatus.ACTIVE,
    description:
      'Allowed transitions: PENDING→ACTIVE|TERMINATED, ACTIVE→SUSPENDED|TERMINATED, SUSPENDED→ACTIVE|TERMINATED',
  })
  @IsEnum(EmploymentStatus)
  status!: EmploymentStatus;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    format: 'date-time',
    description: 'Only valid when status is TERMINATED',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Date)
  @IsDate()
  terminationDate?: Date | null;

  @ApiPropertyOptional({ maxLength: 500, example: 'Onboarding complete' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
