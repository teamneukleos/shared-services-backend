import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma/prisma.service';
import { NodeEnv } from '../../config/configuration';

export interface HealthServiceStatus {
  status: 'up' | 'down';
}

export interface HealthCheckResult {
  status: 'healthy';
  services: {
    api: HealthServiceStatus;
    database: HealthServiceStatus;
  };
  environment: NodeEnv;
  uptimeSeconds: number;
  timestamp: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly databaseTimeoutMs = 3000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async check(): Promise<HealthCheckResult> {
    await this.checkDatabase();

    return {
      status: 'healthy',
      services: {
        api: { status: 'up' },
        database: { status: 'up' },
      },
      environment: this.configService.getOrThrow<NodeEnv>('nodeEnv'),
      uptimeSeconds: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<void> {
    try {
      await this.withTimeout(
        () => this.prisma.$queryRaw`SELECT 1`,
        this.databaseTimeoutMs,
      );
    } catch (error) {
      this.logger.error(
        `Database health check failed (${this.classifyHealthError(error)})`,
      );
      throw new ServiceUnavailableException('Database service is unavailable');
    }
  }

  private async withTimeout<T>(
    operation: () => Promise<T>,
    ms: number,
  ): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      return await new Promise<T>((resolve, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Database health check timed out'));
        }, ms);
        timeoutId.unref();

        operation().then(resolve, reject);
      });
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }

  private classifyHealthError(error: unknown): string {
    const message =
      error instanceof Error ? error.message.toLowerCase() : 'unknown error';
    const code =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as { code?: unknown }).code === 'string'
        ? (error as { code: string }).code
        : undefined;

    if (message.includes('timed out')) {
      return 'connection_timeout';
    }
    if (code === 'P1000' || message.includes('authentication')) {
      return 'authentication_failure';
    }
    if (
      code === 'P1001' ||
      message.includes('econnrefused') ||
      message.includes("can't reach database server")
    ) {
      return 'connection_refused';
    }
    if (code === 'P1003' || message.includes('does not exist')) {
      return 'database_not_found';
    }
    if (
      code === 'P1011' ||
      message.includes('ssl') ||
      message.includes('certificate')
    ) {
      return 'ssl_mismatch';
    }
    if (message.includes('timeout')) {
      return 'connection_timeout';
    }

    return 'query_failure';
  }
}
