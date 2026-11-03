import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma/prisma.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  const queryRaw = jest.fn();
  const getOrThrow = jest.fn();

  const prisma = {
    $queryRaw: queryRaw,
  } as unknown as PrismaService;

  const configService = {
    getOrThrow,
  } as unknown as ConfigService;

  let service: HealthService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    getOrThrow.mockReturnValue('development');
    service = new HealthService(prisma, configService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns healthy status when the database query succeeds', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const result = await service.check();

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('healthy');
    expect(result.services).toEqual({
      api: { status: 'up' },
      database: { status: 'up' },
    });
    expect(result.environment).toBe('development');
    expect(typeof result.uptimeSeconds).toBe('number');
    expect(Number.isFinite(result.uptimeSeconds)).toBe(true);
    expect(result.timestamp).toEqual(expect.any(String));
    expect(getOrThrow).toHaveBeenCalledWith('nodeEnv');
  });

  it('throws ServiceUnavailableException when the database query fails', async () => {
    queryRaw.mockRejectedValue(new Error('connection refused'));

    await expect(service.check()).rejects.toEqual(
      new ServiceUnavailableException('Database service is unavailable'),
    );
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('invokes the Prisma query exactly once per successful check', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    await service.check();

    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('times out slow database queries and cleans up the timer', async () => {
    jest.useFakeTimers();

    queryRaw.mockImplementation(
      () =>
        new Promise(() => {
          // Never resolves; timeout must win.
        }),
    );

    const checkPromise = service.check();
    const expectation = expect(checkPromise).rejects.toEqual(
      new ServiceUnavailableException('Database service is unavailable'),
    );

    await jest.advanceTimersByTimeAsync(3000);
    await expectation;
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('does not report timeout after a successful query', async () => {
    jest.useFakeTimers();

    queryRaw.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([{ '?column?': 1 }]), 50);
        }),
    );

    const checkPromise = service.check();
    await jest.advanceTimersByTimeAsync(50);
    await expect(checkPromise).resolves.toEqual(
      expect.objectContaining({
        status: 'healthy',
        services: {
          api: { status: 'up' },
          database: { status: 'up' },
        },
      }),
    );
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });
});
