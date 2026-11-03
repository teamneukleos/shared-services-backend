import { Request, Response } from 'express';
import { RequestContextMiddleware } from './request-context.middleware';
import { RequestContextService } from './request-context.service';

describe('RequestContextMiddleware', () => {
  let service: RequestContextService;
  let middleware: RequestContextMiddleware;

  beforeEach(() => {
    service = new RequestContextService();
    middleware = new RequestContextMiddleware(service);
  });

  const createRequest = (
    headers: Record<string, string | undefined> = {},
  ): Request => {
    return {
      ip: '203.0.113.10',
      header: (name: string) => headers[name.toLowerCase()],
      get: (name: string) => headers[name.toLowerCase()],
    } as unknown as Request;
  };

  const createResponse = () => {
    const headers: Record<string, string> = {};
    return {
      headers,
      setHeader: (name: string, value: string) => {
        headers[name] = value;
      },
    } as unknown as Response & { headers: Record<string, string> };
  };

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  it('reuses a valid incoming request ID', () => {
    const req = createRequest({
      'x-request-id': ' test-request-123 ',
      'user-agent': 'NeukleosAgent/1.0',
    });
    const res = createResponse();
    const next = jest.fn(() => {
      expect(service.getRequestId()).toBe('test-request-123');
      expect(service.getContext()?.ipAddress).toBe('203.0.113.10');
      expect(service.getContext()?.userAgent).toBe('NeukleosAgent/1.0');
    });

    middleware.use(req, res, next);

    expect(res.headers['X-Request-Id']).toBe('test-request-123');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('generates a UUID when the request ID is missing', () => {
    const req = createRequest();
    const res = createResponse();
    let capturedRequestId: string | undefined;
    const next = jest.fn(() => {
      capturedRequestId = service.getRequestId();
      expect(capturedRequestId).toMatch(uuidPattern);
    });

    middleware.use(req, res, next);

    expect(res.headers['X-Request-Id']).toBe(capturedRequestId);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('generates a UUID when the request ID is empty', () => {
    expect(middleware.resolveRequestId('   ')).toMatch(uuidPattern);
  });

  it('generates a UUID when the request ID is overlong', () => {
    expect(middleware.resolveRequestId('a'.repeat(129))).toMatch(uuidPattern);
  });

  it('generates a UUID when the request ID contains control characters', () => {
    expect(middleware.resolveRequestId('bad\nid')).toMatch(uuidPattern);
  });

  it('stores IP and user agent and calls next exactly once', () => {
    const req = createRequest({
      'x-request-id': 'ip-ua-check',
      'user-agent': 'curl/8.0',
    });
    const res = createResponse();
    const next = jest.fn(() => {
      expect(service.getContext()).toEqual({
        requestId: 'ip-ua-check',
        ipAddress: '203.0.113.10',
        userAgent: 'curl/8.0',
      });
    });

    middleware.use(req, res, next);

    expect(res.headers['X-Request-Id']).toBe('ip-ua-check');
    expect(next).toHaveBeenCalledTimes(1);
    expect(service.getContext()).toBeUndefined();
  });
});
