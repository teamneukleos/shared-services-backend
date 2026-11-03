import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { RecordStatus } from '../../../generated/prisma/client';
import {
  ExternalIdentitySummary,
  UserAccountRecord,
} from '../domain/user.types';

export class CreateUserDto {
  @ApiProperty({ example: 'ada@neukleos.com', maxLength: 320 })
  @IsEmail()
  @MaxLength(320)
  officialEmail!: string;

  @ApiPropertyOptional({ enum: RecordStatus, default: RecordStatus.ACTIVE })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Optional Employee to link (must be in the same organisation)',
  })
  @IsOptional()
  @IsUUID()
  employeeId?: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'ada@neukleos.com', maxLength: 320 })
  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  officialEmail?: string;

  @ApiPropertyOptional({ enum: RecordStatus })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Set to link an employee, or null to unlink',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  employeeId?: string | null;
}

export class ListUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    maxLength: 200,
    description: 'Search by official email',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: RecordStatus })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}

export class InviteUserDto {
  @ApiProperty({
    example: 'ada@neukleos.com',
    maxLength: 320,
    description: 'Official email for the UserAccount',
  })
  @IsEmail()
  @MaxLength(320)
  officialEmail!: string;

  @ApiPropertyOptional({
    example: '108234567890123456789',
    maxLength: 255,
    description:
      'Optional Google account `sub`. Prefer email-only invite: the `sub` is linked automatically on the user\'s first Google Workspace sign-in.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  googleSubject?: string;

  @ApiPropertyOptional({
    example: 'ada@neukleos.com',
    maxLength: 320,
    description:
      'Workspace email stored on ExternalIdentity when pre-linking a `sub` (defaults to officialEmail). Ignored for email-only invites.',
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  googleEmail?: string;

  @ApiPropertyOptional({
    enum: RecordStatus,
    description:
      'Defaults to INACTIVE for email-only invites (activated on first Google sign-in), or ACTIVE when a Google `sub` is pre-linked.',
  })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  employeeId?: string;
}

export class LinkGoogleIdentityDto {
  @ApiProperty({
    example: '108234567890123456789',
    maxLength: 255,
    description: 'Google account `sub`',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  subject!: string;

  @ApiPropertyOptional({
    example: 'ada@neukleos.com',
    maxLength: 320,
    description: 'Workspace email (defaults to the user officialEmail)',
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  email?: string;
}

export class ExternalIdentityResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'GOOGLE_WORKSPACE' })
  provider!: string;

  @ApiProperty()
  subject!: string;

  @ApiPropertyOptional({ nullable: true })
  email!: string | null;
}

export class UserAccountResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  organisationId!: string;

  @ApiProperty()
  officialEmail!: string;

  @ApiProperty({ enum: RecordStatus })
  status!: RecordStatus;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  employeeId!: string | null;

  @ApiProperty({ type: [ExternalIdentityResponseDto] })
  @Type(() => ExternalIdentityResponseDto)
  externalIdentities!: ExternalIdentityResponseDto[];

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export function toExternalIdentityResponse(
  record: ExternalIdentitySummary,
): ExternalIdentityResponseDto {
  return {
    id: record.id,
    provider: record.provider,
    subject: record.subject,
    email: record.email,
  };
}

export function toUserAccountResponse(
  record: UserAccountRecord,
): UserAccountResponseDto {
  return {
    id: record.id,
    organisationId: record.organisationId,
    officialEmail: record.officialEmail,
    status: record.status,
    employeeId: record.employeeId,
    externalIdentities: record.externalIdentities.map(
      toExternalIdentityResponse,
    ),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
