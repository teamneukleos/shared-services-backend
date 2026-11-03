import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { OnboardingStatus } from '../../../../generated/prisma/client';

export class ListOnboardingQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiPropertyOptional({ enum: OnboardingStatus })
  @IsOptional()
  @IsEnum(OnboardingStatus)
  status?: OnboardingStatus;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Inclusive lower bound for startDate',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDateFrom?: Date;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Inclusive upper bound for startDate',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDateTo?: Date;
}
