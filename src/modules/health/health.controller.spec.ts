import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { HealthController } from './health.controller';
import { HealthCheckResult, HealthService } from './health.service';

describe('HealthController', () => {
  const healthResult: HealthCheckResult = {
    status: 'healthy',
    services: {
      api: { status: 'up' },
      database: { status: 'up' },
    },
    environment: 'development',
    uptimeSeconds: 12.34,
    timestamp: '2026-08-04T00:00:00.000Z',
  };

  const checkMock = jest.fn().mockResolvedValue(healthResult);
  const healthService = {
    check: checkMock,
  } as unknown as HealthService;

  const controller = new HealthController(healthService);

  beforeEach(() => {
    jest.clearAllMocks();
    checkMock.mockResolvedValue(healthResult);
  });

  it('delegates to the health service', async () => {
    await controller.check();
    expect(checkMock).toHaveBeenCalledTimes(1);
  });

  it('returns the service result unchanged', async () => {
    await expect(controller.check()).resolves.toBe(healthResult);
  });

  it('exposes GET /health', () => {
    const controllerPath = Reflect.getMetadata(PATH_METADATA, HealthController);
    const routeHandler = Object.getOwnPropertyDescriptor(
      HealthController.prototype,
      'check',
    )?.value;

    expect(typeof routeHandler).toBe('function');

    const methodPath = Reflect.getMetadata(
      PATH_METADATA,
      routeHandler as object,
    );
    const requestMethod = Reflect.getMetadata(
      METHOD_METADATA,
      routeHandler as object,
    );

    expect(controllerPath).toBe('health');
    expect(methodPath).toBe('/');
    expect(requestMethod).toBe(RequestMethod.GET);
  });
});
