import { CallHandler, ExecutionContext, StreamableFile } from '@nestjs/common';
import { of } from 'rxjs';
import { Readable } from 'stream';
import { RequestContextService } from '../request-context/request-context.service';
import { ApiResponseInterceptor } from './api-response.interceptor';

describe('ApiResponseInterceptor', () => {
  const requestContextService = {
    getRequestId: jest.fn(),
  } as unknown as RequestContextService;

  const interceptor = new ApiResponseInterceptor(requestContextService);
  const context = {} as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    (requestContextService.getRequestId as jest.Mock).mockReturnValue(
      'req-success-1',
    );
  });

  const intercept = <T>(body: T) => {
    const next: CallHandler = {
      handle: () => of(body),
    };
    return interceptor.intercept(context, next);
  };

  it('wraps a normal object response and includes request ID', (done) => {
    intercept({ id: 1, name: 'Neukleos' }).subscribe((result) => {
      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          message: 'Request completed successfully',
          data: { id: 1, name: 'Neukleos' },
          meta: null,
          requestId: 'req-success-1',
        }),
      );
      expect((result as { timestamp: string }).timestamp).toEqual(
        expect.any(String),
      );
      done();
    });
  });

  it('supports custom message and metadata', (done) => {
    intercept({
      data: { id: 2 },
      message: 'Created successfully',
      meta: { page: 1 },
    }).subscribe((result) => {
      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          message: 'Created successfully',
          data: { id: 2 },
          meta: { page: 1 },
          requestId: 'req-success-1',
        }),
      );
      done();
    });
  });

  it('wraps an array response', (done) => {
    intercept([{ id: 1 }, { id: 2 }]).subscribe((result) => {
      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          data: [{ id: 1 }, { id: 2 }],
          meta: null,
          requestId: 'req-success-1',
        }),
      );
      done();
    });
  });

  it('wraps a primitive response', (done) => {
    intercept('ok').subscribe((result) => {
      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          data: 'ok',
          meta: null,
          requestId: 'req-success-1',
        }),
      );
      done();
    });
  });

  it('does not double-wrap an already-wrapped response with requestId', (done) => {
    const wrapped = {
      success: true as const,
      message: 'Already wrapped',
      data: { id: 9 },
      meta: null,
      timestamp: '2026-08-04T00:00:00.000Z',
      requestId: 'existing-id',
    };

    intercept(wrapped).subscribe((result) => {
      expect(result).toBe(wrapped);
      done();
    });
  });

  it('adds requestId to an already-wrapped response when absent', (done) => {
    const wrapped = {
      success: true as const,
      message: 'Already wrapped',
      data: { id: 9 },
      meta: null,
      timestamp: '2026-08-04T00:00:00.000Z',
    };

    intercept(wrapped).subscribe((result) => {
      expect(result).toEqual({
        ...wrapped,
        requestId: 'req-success-1',
      });
      done();
    });
  });

  it('remains safe when no request context exists', (done) => {
    (requestContextService.getRequestId as jest.Mock).mockReturnValue(
      undefined,
    );

    intercept({ ok: true }).subscribe((result) => {
      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          data: { ok: true },
          requestId: undefined,
        }),
      );
      done();
    });
  });

  it('passes through StreamableFile responses', (done) => {
    const file = new StreamableFile(Readable.from(['file-content']));

    intercept(file).subscribe((result) => {
      expect(result).toBe(file);
      done();
    });
  });
});
