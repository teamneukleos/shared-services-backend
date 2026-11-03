import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ApiErrorResponseDto, PaginationMetaDto } from './api-envelope.dto';

const SWAGGER_PATH = 'api/docs';

export function setupSwagger(app: INestApplication): void {
  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('nodeEnv');

  if (nodeEnv === 'production') {
    return;
  }

  const config = new DocumentBuilder()
    .setTitle('Neukleos ERP API')
    .setDescription(
      [
        'Modular NestJS ERP API for Neukleos and related organisations.',
        '',
        'All successful responses are wrapped as:',
        '`{ success, message, data, meta, timestamp, requestId? }`.',
        '',
        'Errors use:',
        '`{ success: false, statusCode, message, errors, path, timestamp, requestId? }`.',
        '',
        'Protected routes require a Bearer access token from Google login.',
        'Organisation scope is taken from the authenticated principal — never from the request body.',
      ].join('\n'),
    )
    .setVersion('0.1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token from POST /api/v1/authentication/google',
      },
      'access-token',
    )
    .addTag('Health', 'Liveness and dependency checks')
    .addTag('Authentication', 'Google Workspace login and session management')
    .addTag('Identity / Permissions', 'Permission catalogue and sync')
    .addTag('Identity / Roles', 'Organisation-scoped roles and permissions')
    .addTag('Identity / Users', 'User account provisioning and Google identity linking')
    .addTag('Identity / User Roles', 'Assign and remove roles on users')
    .addTag('Organisation / Business Units', 'Top-level org structure units')
    .addTag('Organisation / Departments', 'Departments under business units')
    .addTag('Organisation / Teams', 'Teams under departments')
    .addTag('Organisation / Positions', 'Positions under departments')
    .addTag('HR / Employees', 'Organisation-scoped employee records')
    .addTag('HR / Onboarding', 'Employee onboarding plans and tasks')
    .addTag('HR / Leave Types', 'Organisation leave type catalogue')
    .addTag('HR / Leave Balances', 'Employee leave balances')
    .addTag('HR / Leave Applications', 'Leave applications and review')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    extraModels: [ApiErrorResponseDto, PaginationMetaDto],
  });

  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'Neukleos ERP API Docs',
  });

  const port = configService.get<number>('port') ?? 3000;
  Logger.log(
    `Swagger UI available at http://localhost:${port}/${SWAGGER_PATH}`,
    'Swagger',
  );
}
