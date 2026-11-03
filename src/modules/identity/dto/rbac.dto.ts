import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import {
  RoleAssignmentRecord,
  RolePermissionSummary,
  RoleRecord,
} from '../domain/rbac.types';
import { PermissionRecord } from '../../authorization/domain/permission-record';

export class CreateRoleDto {
  @ApiProperty({ example: 'HR Manager', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiProperty({
    example: 'HR_MANAGER',
    maxLength: 50,
    description: 'Organisation-scoped unique code',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[A-Z0-9_-]+$/, {
    message: 'code must be uppercase letters, digits, underscore, or hyphen',
  })
  code!: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['employee.read', 'employee.update'],
    description: 'Optional permission codes to attach on create',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  permissionCodes?: string[];
}

export class UpdateRoleDto {
  @ApiPropertyOptional({ example: 'HR Manager', maxLength: 150 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;
}

export class ListRolesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    maxLength: 200,
    description: 'Search by role name or code',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

export class AssignPermissionsDto {
  @ApiProperty({
    type: [String],
    example: ['employee.read', 'leave.type.read'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  permissionCodes!: string[];
}

export class AssignRoleDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  roleId!: string;
}

export class ListUserRolesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    default: false,
    description: 'Include ended (historical) assignments',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (value === true || value === 'true' || value === '1') {
      return true;
    }
    if (value === false || value === 'false' || value === '0') {
      return false;
    }
    return value;
  })
  @IsBoolean()
  includeEnded?: boolean;
}

export class ListPermissionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    maxLength: 200,
    description: 'Search by permission code or description',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

export class PermissionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'identity.role.manage' })
  code!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;
}

export class PermissionSyncResponseDto {
  @ApiProperty()
  created!: number;

  @ApiProperty()
  updated!: number;

  @ApiProperty()
  total!: number;
}

export class RolePermissionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;
}

export class RoleResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  organisationId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty({ type: [RolePermissionResponseDto] })
  @Type(() => RolePermissionResponseDto)
  permissions!: RolePermissionResponseDto[];

  @ApiProperty({
    description: 'Number of role assignments (active and historical)',
  })
  assignmentCount!: number;
}

export class RoleAssignmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ format: 'uuid' })
  roleId!: string;

  @ApiProperty()
  roleCode!: string;

  @ApiProperty()
  roleName!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  startsAt!: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  endsAt!: string | null;
}

export function toPermissionResponse(
  record: PermissionRecord,
): PermissionResponseDto {
  return {
    id: record.id,
    code: record.code,
    description: record.description,
  };
}

export function toRolePermissionResponse(
  record: RolePermissionSummary,
): RolePermissionResponseDto {
  return {
    id: record.id,
    code: record.code,
    description: record.description,
  };
}

export function toRoleResponse(record: RoleRecord): RoleResponseDto {
  return {
    id: record.id,
    organisationId: record.organisationId,
    name: record.name,
    code: record.code,
    permissions: record.permissions.map(toRolePermissionResponse),
    assignmentCount: record.assignmentCount,
  };
}

export function toRoleAssignmentResponse(
  record: RoleAssignmentRecord,
): RoleAssignmentResponseDto {
  return {
    id: record.id,
    userId: record.userId,
    roleId: record.roleId,
    roleCode: record.roleCode,
    roleName: record.roleName,
    startsAt: record.startsAt.toISOString(),
    endsAt: record.endsAt?.toISOString() ?? null,
  };
}
