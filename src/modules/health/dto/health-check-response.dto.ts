import { ApiProperty } from '@nestjs/swagger';

class HealthServiceStatusDto {
  @ApiProperty({ enum: ['up', 'down'], example: 'up' })
  status!: 'up' | 'down';
}

class HealthServicesDto {
  @ApiProperty({ type: HealthServiceStatusDto })
  api!: HealthServiceStatusDto;

  @ApiProperty({ type: HealthServiceStatusDto })
  database!: HealthServiceStatusDto;
}

export class HealthCheckResponseDto {
  @ApiProperty({ enum: ['healthy'], example: 'healthy' })
  status!: 'healthy';

  @ApiProperty({ type: HealthServicesDto })
  services!: HealthServicesDto;

  @ApiProperty({
    enum: ['development', 'test', 'production'],
    example: 'development',
  })
  environment!: string;

  @ApiProperty({ example: 12.345 })
  uptimeSeconds!: number;

  @ApiProperty({ example: '2026-10-26T13:00:00.000Z' })
  timestamp!: string;
}
