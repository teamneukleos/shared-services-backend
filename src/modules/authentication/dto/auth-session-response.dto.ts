import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthenticatedPrincipalDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  organisationId!: string;

  @ApiProperty({ example: 'ada@neukleos.com' })
  email!: string;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  employeeId!: string | null;

  @ApiProperty({
    type: [String],
    example: ['employee.read', 'employee.create'],
  })
  permissions!: string[];
}

export class AuthSessionResponseDto {
  @ApiProperty({
    description: 'JWT access token for Authorization: Bearer',
  })
  accessToken!: string;

  @ApiProperty({
    description: 'Opaque refresh token for session rotation',
  })
  refreshToken!: string;

  @ApiProperty({ enum: ['Bearer'], example: 'Bearer' })
  tokenType!: 'Bearer';

  @ApiProperty({ example: '15m', description: 'Access token lifetime' })
  expiresIn!: string;

  @ApiProperty({ example: '7d', description: 'Refresh token lifetime' })
  refreshExpiresIn!: string;

  @ApiProperty({ type: AuthenticatedPrincipalDto })
  user!: AuthenticatedPrincipalDto;
}

export class CurrentUserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  organisationId!: string;

  @ApiProperty({ example: 'ada@neukleos.com' })
  email!: string;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  employeeId!: string | null;

  @ApiProperty({ type: [String] })
  permissions!: string[];
}

export class LogoutResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;
}
