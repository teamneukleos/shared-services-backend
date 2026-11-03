import { UnauthorizedException } from '@nestjs/common';
import {
  OnboardingStatus,
  OnboardingTaskStatus,
} from '../../../generated/prisma/client';
import { PERMISSIONS_KEY } from '../../authorization/authorization.constants';
import { OnboardingService } from './application/onboarding.service';
import { ONBOARDING_PERMISSIONS } from './domain/onboarding-permissions';
import { OnboardingController } from './onboarding.controller';

describe('OnboardingController', () => {
  const create = jest.fn();
  const list = jest.fn();
  const findOne = jest.fn();
  const update = jest.fn();
  const changeStatus = jest.fn();
  const addTask = jest.fn();
  const updateTask = jest.fn();
  const changeTaskStatus = jest.fn();

  const service = {
    create,
    list,
    findOne,
    update,
    changeStatus,
    addTask,
    updateTask,
    changeTaskStatus,
  } as unknown as OnboardingService;

  let controller: OnboardingController;

  const actor = {
    id: 'user-1',
    organisationId: 'org-1',
    email: 'hr@neukleos.com',
    employeeId: null,
    permissions: [ONBOARDING_PERMISSIONS.READ],
  };

  const plan = {
    id: 'plan-1',
    organisationId: 'org-1',
    employeeId: 'emp-1',
    employeeNumber: 'E-001',
    employeeName: 'Ada Lovelace',
    name: 'Standard onboarding',
    notes: null,
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    targetCompletionDate: null,
    completedAt: null,
    status: OnboardingStatus.NOT_STARTED,
    coordinatorUserId: null,
    tasks: [
      {
        id: 'task-1',
        planId: 'plan-1',
        title: 'Laptop setup',
        description: null,
        category: 'IT',
        isRequired: true,
        status: OnboardingTaskStatus.PENDING,
        dueDate: null,
        assigneeUserId: null,
        completedAt: null,
        completedByUserId: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new OnboardingController(service);
  });

  it('requires an authenticated user', async () => {
    await expect(
      controller.list(undefined, { page: 1, size: 20 }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('declares the expected permissions on each route', () => {
    const route = (methodName: string): object => {
      const handler = Object.getOwnPropertyDescriptor(
        OnboardingController.prototype,
        methodName,
      )?.value;
      if (typeof handler !== 'function') {
        throw new Error(`Missing route handler: ${methodName}`);
      }
      return handler as object;
    };

    expect(Reflect.getMetadata(PERMISSIONS_KEY, route('create'))).toEqual([
      ONBOARDING_PERMISSIONS.CREATE,
    ]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, route('list'))).toEqual([
      ONBOARDING_PERMISSIONS.READ,
    ]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, route('findOne'))).toEqual([
      ONBOARDING_PERMISSIONS.READ,
    ]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, route('update'))).toEqual([
      ONBOARDING_PERMISSIONS.UPDATE,
    ]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, route('addTask'))).toEqual([
      ONBOARDING_PERMISSIONS.TASK_MANAGE,
    ]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, route('updateTask'))).toEqual([
      ONBOARDING_PERMISSIONS.TASK_MANAGE,
    ]);
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, route('changeTaskStatus')),
    ).toEqual([ONBOARDING_PERMISSIONS.TASK_MANAGE]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, route('changeStatus'))).toEqual(
      [ONBOARDING_PERMISSIONS.STATUS_CHANGE],
    );
  });

  it('returns ISO dates and nested tasks', async () => {
    findOne.mockResolvedValue(plan);

    await expect(controller.findOne(actor, 'plan-1')).resolves.toEqual(
      expect.objectContaining({
        id: 'plan-1',
        startDate: '2026-01-01T00:00:00.000Z',
        tasks: [
          expect.objectContaining({
            id: 'task-1',
            title: 'Laptop setup',
            status: OnboardingTaskStatus.PENDING,
          }),
        ],
      }),
    );
  });
});
