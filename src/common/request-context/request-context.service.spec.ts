import { RequestContextService } from './request-context.service';

describe('RequestContextService', () => {
  let service: RequestContextService;

  beforeEach(() => {
    service = new RequestContextService();
  });

  it('exposes context inside run', () => {
    service.run(
      {
        requestId: 'req-1',
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
      },
      () => {
        expect(service.getContext()).toEqual({
          requestId: 'req-1',
          ipAddress: '127.0.0.1',
          userAgent: 'jest',
        });
        expect(service.getRequestId()).toBe('req-1');
      },
    );
  });

  it('does not expose context outside run', () => {
    expect(service.getContext()).toBeUndefined();
    expect(service.getRequestId()).toBeUndefined();
    expect(service.getUserId()).toBeUndefined();
    expect(service.getOrganisationId()).toBeUndefined();
  });

  it('retains context across nested async operations', async () => {
    await service.run({ requestId: 'async-req' }, async () => {
      await Promise.resolve();
      expect(service.getRequestId()).toBe('async-req');

      await new Promise<void>((resolve) => {
        setImmediate(() => {
          expect(service.getRequestId()).toBe('async-req');
          resolve();
        });
      });
    });
  });

  it('does not leak context between concurrent requests', async () => {
    const seen = await Promise.all([
      service.run({ requestId: 'concurrent-a' }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return service.getRequestId();
      }),
      service.run({ requestId: 'concurrent-b' }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return service.getRequestId();
      }),
    ]);

    expect(seen).toEqual(['concurrent-a', 'concurrent-b']);
    expect(service.getRequestId()).toBeUndefined();
  });

  it('returns expected getter values', () => {
    service.run(
      {
        requestId: 'req-getters',
        userId: 'user-1',
        organisationId: 'org-1',
      },
      () => {
        expect(service.getRequestId()).toBe('req-getters');
        expect(service.getUserId()).toBe('user-1');
        expect(service.getOrganisationId()).toBe('org-1');
      },
    );
  });

  it('updates only the active context via setUserContext', () => {
    service.run({ requestId: 'req-user' }, () => {
      service.setUserContext('user-22', 'org-22');
      expect(service.getUserId()).toBe('user-22');
      expect(service.getOrganisationId()).toBe('org-22');
      expect(service.getContext()).toEqual({
        requestId: 'req-user',
        userId: 'user-22',
        organisationId: 'org-22',
      });
    });

    expect(service.getUserId()).toBeUndefined();
  });

  it('fails setUserContext outside an active context', () => {
    expect(() => service.setUserContext('user-1', 'org-1')).toThrow(
      'Cannot set user context outside an active request context',
    );
  });
});
