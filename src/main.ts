import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor';
import { RequestContextService } from './common/request-context/request-context.service';
import { setupSwagger } from './common/swagger/setup-swagger';

function parseCorsOrigins(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  const configService = app.get(ConfigService);
  const port = configService.getOrThrow<number>('port');
  const corsOrigins = parseCorsOrigins(
    configService.get<string>('CORS_ORIGINS'),
  );

  if (corsOrigins.length === 0) {
    throw new Error('No valid CORS origins configured');
  }

  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  app.use(json({ limit: '2mb' }));
  app.use(urlencoded({ extended: true, limit: '2mb' }));

  const requestContextService = app.get(RequestContextService);
  app.useGlobalFilters(new GlobalExceptionFilter(requestContextService));
  app.useGlobalInterceptors(new ApiResponseInterceptor(requestContextService));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
    }),
  );

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  });

  setupSwagger(app);

  await app.listen(port, '0.0.0.0');
  logger.log(`Application is running on http://0.0.0.0:${port}/api/v1`);
}

bootstrap().catch((error: unknown) => {
  const logger = new Logger('Bootstrap');
  const message =
    error instanceof Error ? error.message : 'Unknown bootstrap error';
  logger.error(`Fatal bootstrap error: ${message}`);
  process.exit(1);
});
