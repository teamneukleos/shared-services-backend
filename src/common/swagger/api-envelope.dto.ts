import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({
    type: 'array',
    items: { type: 'object' },
    example: [{ field: 'workEmail', message: 'workEmail must be an email' }],
  })
  errors!: unknown[];

  @ApiProperty({ example: '/api/v1/hr/employees' })
  path!: string;

  @ApiProperty({ example: '2026-10-26T13:00:00.000Z' })
  timestamp!: string;

  @ApiPropertyOptional({ example: 'req_01HXYZ' })
  requestId?: string;
}

export class PaginationMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  size!: number;

  @ApiProperty({ example: 42 })
  totalItems!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;

  @ApiProperty({ example: true })
  hasNextPage!: boolean;

  @ApiProperty({ example: false })
  hasPreviousPage!: boolean;
}
