import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { resolvePgSchema } from './resolve-pg-schema';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(configService: ConfigService) {
    const databaseUrl = configService.getOrThrow<string>('database.url');
    const schema = resolvePgSchema(databaseUrl);
    super({
      adapter: new PrismaPg({ connectionString: databaseUrl }, { schema }),
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      // PrismaPg $connect can succeed before a live round-trip; verify with a ping.
      await this.$queryRaw`SELECT 1`;
      this.logger.log('Database connection established');
    } catch (error) {
      this.logger.error(
        `Database connection failed (${this.classifyConnectionError(error)})`,
      );
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  private classifyConnectionError(error: unknown): string {
    const message =
      error instanceof Error ? error.message.toLowerCase() : 'unknown error';
    const code =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as { code?: unknown }).code === 'string'
        ? (error as { code: string }).code
        : undefined;

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
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'connection_timeout';
    }

    return 'connection_error';
  }
}
