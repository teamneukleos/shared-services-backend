import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
} from '@prisma/client/runtime/client';
import { RequestContextService } from '../request-context/request-context.service';
import { GlobalExceptionFilter } from './global-exception.filter';

describe('GlobalExceptionFilter', () => {
  const requestContextService = {
    getRequestId: jest.fn(),
  } as unknown as RequestContextService;

  const filter = new GlobalExceptionFilter(requestContextService);

  beforeEach(() => {
    jest.clearAllMocks();
    (requestContextService.getRequestId as jest.Mock).mockReturnValue(
      'req-error-1',
    );
  });

  const createHost = (
    url = '/api/v1/example',
    headers: Record<string, string | undefined> = {},
  ) => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const response = { status };
    const request = {
      method: 'GET',
      originalUrl: url,
      header: (name: string) => headers[name.toLowerCase()],
    };

    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as ArgumentsHost;

    return { host, status, json };
  };

  it('handles a standard HttpException and includes request ID', () => {
    const { host, status, json } = createHost();

    filter.catch(new NotFoundException('Resource missing'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Resource missing',
        errors: [],
        path: '/api/v1/example',
        requestId: 'req-error-1',
      }),
    );
  });

  it('handles a validation error response', () => {
    const { host, status, json } = createHost();

    filter.catch(
      new BadRequestException({
        message: ['email must be an email', 'name should not be empty'],
        error: 'Bad Request',
        statusCode: 400,
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Validation failed',
        errors: ['email must be an email', 'name should not be empty'],
        path: '/api/v1/example',
        requestId: 'req-error-1',
      }),
    );
  });

  it('handles an unexpected error safely', () => {
    const { host, status, json } = createHost();
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    filter.catch(new Error('boom with secret DATABASE_URL=postgres://x'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        errors: [],
        requestId: 'req-error-1',
      }),
    );
    expect(errorSpy).toHaveBeenCalled();
    const loggedMessage = String(errorSpy.mock.calls[0]?.[0] ?? '');
    expect(loggedMessage).toContain('Unhandled exception');
    expect(loggedMessage).not.toContain('postgres://');
    expect(loggedMessage).not.toContain('DATABASE_URL');
    expect(json.mock.calls[0]?.[0]).not.toHaveProperty('stack');
    expect(json.mock.calls[0]?.[0].message).toBe('Internal server error');
    errorSpy.mockRestore();
  });

  it('falls back to the request header when no request context exists', () => {
    (requestContextService.getRequestId as jest.Mock).mockReturnValue(
      undefined,
    );
    const { host, json } = createHost('/api/v1/example', {
      'x-request-id': 'header-fallback-id',
    });

    filter.catch(new NotFoundException('Missing'), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'header-fallback-id',
      }),
    );
  });

  it('remains safe when neither context nor header exists', () => {
    (requestContextService.getRequestId as jest.Mock).mockReturnValue(
      undefined,
    );
    const { host, json } = createHost();

    filter.catch(new NotFoundException('Missing'), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: undefined,
      }),
    );
  });

  it('maps Prisma P2002 to HTTP 409', () => {
    const { host, status, json } = createHost();
    const exception = new PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`email`)',
      {
        code: 'P2002',
        clientVersion: '7.9.0',
        meta: { target: ['email'] },
      },
    );

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: HttpStatus.CONFLICT,
        message: 'A record with this value already exists',
        errors: [{ field: 'email', message: 'Value must be unique' }],
        requestId: 'req-error-1',
      }),
    );
  });

  it('maps Prisma P2025 to HTTP 404', () => {
    const { host, status, json } = createHost();
    const exception = new PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '7.9.0',
    });

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Record not found',
        errors: [],
        requestId: 'req-error-1',
      }),
    );
  });

  it('maps Prisma P2003 to HTTP 409', () => {
    const { host, status, json } = createHost();
    const exception = new PrismaClientKnownRequestError(
      'Foreign key constraint failed',
      {
        code: 'P2003',
        clientVersion: '7.9.0',
        meta: { field_name: 'organisationId' },
      },
    );

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.CONFLICT,
        message: 'Related record conflict',
        errors: [
          {
            field: 'organisationId',
            message: 'Related record is invalid or missing',
          },
        ],
        requestId: 'req-error-1',
      }),
    );
  });

  it('maps Prisma validation errors to HTTP 400', () => {
    const { host, status, json } = createHost();
    const exception = new PrismaClientValidationError(
      'Invalid `prisma.user.create()` invocation',
      { clientVersion: '7.9.0' },
    );

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid data provided',
        errors: [],
        requestId: 'req-error-1',
      }),
    );
  });

  it('handles string HttpException responses', () => {
    const { host, status, json } = createHost();

    filter.catch(new HttpException('Blocked', HttpStatus.FORBIDDEN), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Blocked',
        errors: [],
        requestId: 'req-error-1',
      }),
    );
  });
});
