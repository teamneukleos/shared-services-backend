import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiStandardErrors,
  ApiWrappedOkResponse,
} from '../../common/swagger/api-wrapped-response.decorator';
import { Public } from '../authorization/decorators/public.decorator';
import { HealthCheckResponseDto } from './dto/health-check-response.dto';
import { HealthCheckResult, HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'API and database health check' })
  @ApiWrappedOkResponse(HealthCheckResponseDto)
  @ApiStandardErrors()
  check(): Promise<HealthCheckResult> {
    return this.healthService.check();
  }
}
