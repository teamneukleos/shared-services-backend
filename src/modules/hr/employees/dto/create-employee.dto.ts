import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  EmploymentStatus,
  EmploymentType,
} from '../../../../generated/prisma/client';

export class CreateEmployeeDto {
  @ApiProperty({ example: 'NK-0042', maxLength: 64 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  employeeNumber!: string;

  @ApiProperty({ example: 'Ada', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({ example: 'Lovelace', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string;

  @ApiPropertyOptional({ example: 'Ada', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  preferredName?: string;

  @ApiProperty({ example: 'ada@neukleos.com', maxLength: 320 })
  @IsEmail()
  @MaxLength(320)
  workEmail!: string;

  @ApiPropertyOptional({ example: '+447700900123', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  departmentId!: string;

  @ApiProperty({ example: 'Software Engineer', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  jobTitle!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  positionId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  teamId?: string;

  @ApiProperty({ enum: EmploymentType, example: EmploymentType.FULL_TIME })
  @IsEnum(EmploymentType)
  employmentType!: EmploymentType;

  @ApiPropertyOptional({
    enum: EmploymentStatus,
    example: EmploymentStatus.PENDING,
    description: 'Defaults to PENDING when omitted',
  })
  @IsOptional()
  @IsEnum(EmploymentStatus)
  status?: EmploymentStatus;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-01-15T00:00:00.000Z',
  })
  @Type(() => Date)
  @IsDate()
  hireDate!: Date;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    example: '2026-12-31T00:00:00.000Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  terminationDate?: Date;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Must belong to the same organisation',
  })
  @IsOptional()
  @IsUUID()
  managerId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Optional link to an existing UserAccount in the same organisation. Does not create a login account.',
  })
  @IsOptional()
  @IsUUID()
  userAccountId?: string;
}
