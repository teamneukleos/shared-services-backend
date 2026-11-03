import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Opaque refresh token issued at login',
    example: 'rt_01HXYZ...',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
