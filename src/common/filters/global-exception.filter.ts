import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
} from '@prisma/client/runtime/client';
import { ApiErrorResponse } from '../interfaces/api-response.interface';
import { RequestContextService } from '../request-context/request-context.service';

interface MappedException {
  statusCode: number;
  message: string;
  errors: unknown[];
  isUnexpected: boolean;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly requestContextService: RequestContextService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const mapped = this.mapException(exception);

    if (mapped.isUnexpected) {
      const errorName =
        exception instanceof Error ? exception.name : 'UnknownError';
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.originalUrl} (${errorName})`,
      );
    }

    const body: ApiErrorResponse = {
      success: false,
      statusCode: mapped.statusCode,
      message: mapped.message,
      errors: mapped.errors,
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
      requestId: this.resolveRequestId(request),
    };

    response.status(mapped.statusCode).json(body);
  }

  private resolveRequestId(request: Request): string | undefined {
    return (
      this.requestContextService.getRequestId() ??
      this.readRequestIdHeader(request)
    );
  }

  private readRequestIdHeader(request: Request): string | undefined {
    const header = request.header('x-request-id');
    if (typeof header !== 'string') {
      return undefined;
    }

    const trimmed = header.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private mapException(exception: unknown): MappedException {
    const prismaMapped = this.mapPrismaException(exception);
    if (prismaMapped) {
      return prismaMapped;
    }

    if (exception instanceof HttpException) {
      return this.mapHttpException(exception);
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      errors: [],
      isUnexpected: true,
    };
  }

  private mapHttpException(exception: HttpException): MappedException {
    const statusCode = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    if (typeof exceptionResponse === 'string') {
      return {
        statusCode,
        message: exceptionResponse,
        errors: [],
        isUnexpected: false,
      };
    }

    if (Array.isArray(exceptionResponse)) {
      return {
        statusCode,
        message: 'Request failed',
        errors: exceptionResponse,
        isUnexpected: false,
      };
    }

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const payload = exceptionResponse as Record<string, unknown>;
      const rawMessage = payload.message;
      const rawErrors = payload.errors;

      if (Array.isArray(rawMessage)) {
        return {
          statusCode,
          message: 'Validation failed',
          errors: rawMessage,
          isUnexpected: false,
        };
      }

      const errors = Array.isArray(rawErrors) ? rawErrors : [];
      const message =
        typeof rawMessage === 'string'
          ? rawMessage
          : typeof payload.error === 'string'
            ? payload.error
            : 'Request failed';

      return {
        statusCode,
        message,
        errors,
        isUnexpected: false,
      };
    }

    return {
      statusCode,
      message: 'Request failed',
      errors: [],
      isUnexpected: false,
    };
  }

  private mapPrismaException(exception: unknown): MappedException | null {
    if (exception instanceof PrismaClientValidationError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid data provided',
        errors: [],
        isUnexpected: false,
      };
    }

    if (!(exception instanceof PrismaClientKnownRequestError)) {
      return null;
    }

    switch (exception.code) {
      case 'P2002': {
        const fields = this.extractPrismaFields(exception.meta);
        return {
          statusCode: HttpStatus.CONFLICT,
          message: 'A record with this value already exists',
          errors: fields.map((field) => ({
            field,
            message: 'Value must be unique',
          })),
          isUnexpected: false,
        };
      }
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Record not found',
          errors: [],
          isUnexpected: false,
        };
      case 'P2003': {
        const fields = this.extractPrismaFields(exception.meta);
        return {
          statusCode: HttpStatus.CONFLICT,
          message: 'Related record conflict',
          errors: fields.map((field) => ({
            field,
            message: 'Related record is invalid or missing',
          })),
          isUnexpected: false,
        };
      }
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'A database error occurred',
          errors: [],
          isUnexpected: false,
        };
    }
  }

  private extractPrismaFields(meta: unknown): string[] {
    if (typeof meta !== 'object' || meta === null) {
      return [];
    }

    const record = meta as Record<string, unknown>;
    const candidates = [record.target, record.field_name, record.constraint];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.length > 0) {
        return [candidate];
      }

      if (Array.isArray(candidate)) {
        return candidate.filter(
          (value): value is string =>
            typeof value === 'string' && value.length > 0,
        );
      }
    }

    return [];
  }
}
