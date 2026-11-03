import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import {
  BusinessUnitRecord,
  DepartmentRecord,
  PositionRecord,
  TeamRecord,
} from '../domain/organisation-structure.types';

const CODE_PATTERN = /^[A-Z0-9_-]+$/;
const CODE_MESSAGE =
  'code must be uppercase letters, digits, underscore, or hyphen';

export class CreateBusinessUnitDto {
  @ApiProperty({ example: 'Technology', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiProperty({ example: 'TECH', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(CODE_PATTERN, { message: CODE_MESSAGE })
  code!: string;
}

export class UpdateBusinessUnitDto {
  @ApiPropertyOptional({ maxLength: 150 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(CODE_PATTERN, { message: CODE_MESSAGE })
  code?: string;
}

export class ListBusinessUnitsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

export class CreateDepartmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  businessUnitId!: string;

  @ApiProperty({ example: 'Engineering', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiProperty({ example: 'ENG', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(CODE_PATTERN, { message: CODE_MESSAGE })
  code!: string;
}

export class UpdateDepartmentDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  businessUnitId?: string;

  @ApiPropertyOptional({ maxLength: 150 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(CODE_PATTERN, { message: CODE_MESSAGE })
  code?: string;
}

export class ListDepartmentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  businessUnitId?: string;
}

export class CreateTeamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  departmentId!: string;

  @ApiProperty({ example: 'Platform', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiProperty({ example: 'PLATFORM', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(CODE_PATTERN, { message: CODE_MESSAGE })
  code!: string;
}

export class UpdateTeamDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ maxLength: 150 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(CODE_PATTERN, { message: CODE_MESSAGE })
  code?: string;
}

export class ListTeamsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;
}

export class CreatePositionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  departmentId!: string;

  @ApiProperty({ example: 'Software Engineer', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title!: string;

  @ApiProperty({ example: 'SWE', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(CODE_PATTERN, { message: CODE_MESSAGE })
  code!: string;
}

export class UpdatePositionDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ maxLength: 150 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title?: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(CODE_PATTERN, { message: CODE_MESSAGE })
  code?: string;
}

export class ListPositionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;
}

export class BusinessUnitResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  organisationId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  departmentCount!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export class DepartmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  organisationId!: string;

  @ApiProperty({ format: 'uuid' })
  businessUnitId!: string;

  @ApiProperty()
  businessUnitCode!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  teamCount!: number;

  @ApiProperty()
  positionCount!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export class TeamResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  organisationId!: string;

  @ApiProperty({ format: 'uuid' })
  businessUnitId!: string;

  @ApiProperty({ format: 'uuid' })
  departmentId!: string;

  @ApiProperty()
  departmentCode!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  code!: string;
}

export class PositionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  organisationId!: string;

  @ApiProperty({ format: 'uuid' })
  businessUnitId!: string;

  @ApiProperty({ format: 'uuid' })
  departmentId!: string;

  @ApiProperty()
  departmentCode!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  code!: string;
}

export function toBusinessUnitResponse(
  record: BusinessUnitRecord,
): BusinessUnitResponseDto {
  return {
    id: record.id,
    organisationId: record.organisationId,
    name: record.name,
    code: record.code,
    departmentCount: record.departmentCount,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toDepartmentResponse(
  record: DepartmentRecord,
): DepartmentResponseDto {
  return {
    id: record.id,
    organisationId: record.organisationId,
    businessUnitId: record.businessUnitId,
    businessUnitCode: record.businessUnitCode,
    name: record.name,
    code: record.code,
    teamCount: record.teamCount,
    positionCount: record.positionCount,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toTeamResponse(record: TeamRecord): TeamResponseDto {
  return {
    id: record.id,
    organisationId: record.organisationId,
    businessUnitId: record.businessUnitId,
    departmentId: record.departmentId,
    departmentCode: record.departmentCode,
    name: record.name,
    code: record.code,
  };
}

export function toPositionResponse(
  record: PositionRecord,
): PositionResponseDto {
  return {
    id: record.id,
    organisationId: record.organisationId,
    businessUnitId: record.businessUnitId,
    departmentId: record.departmentId,
    departmentCode: record.departmentCode,
    title: record.title,
    code: record.code,
  };
}
