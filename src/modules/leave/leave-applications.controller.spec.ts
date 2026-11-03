import { UnauthorizedException } from '@nestjs/common';
import { PERMISSIONS_KEY } from '../authorization/authorization.constants';
import { LeaveService } from './application/leave.service';
import { LEAVE_PERMISSIONS } from './domain/leave-permissions';
import { LeaveApplicationsController } from './leave-applications.controller';

describe('LeaveApplicationsController', () => {
  const service = {
    submitApplication: jest.fn(),
    listApplications: jest.fn(),
    getApplication: jest.fn(),
    approveApplication: jest.fn(),
    rejectApplication: jest.fn(),
    withdrawApplication: jest.fn(),
  } as unknown as LeaveService;

  let controller: LeaveApplicationsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new LeaveApplicationsController(service);
  });

  it('requires authentication', async () => {
    await expect(
      controller.list(undefined, { page: 1, size: 20 }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('declares expected permissions', () => {
    const route = (methodName: string): object => {
      const handler = Object.getOwnPropertyDescriptor(
        LeaveApplicationsController.prototype,
        methodName,
      )?.value;
      if (typeof handler !== 'function') {
        throw new Error(`Missing route handler: ${methodName}`);
      }
      return handler as object;
    };

    expect(Reflect.getMetadata(PERMISSIONS_KEY, route('create'))).toEqual([
      LEAVE_PERMISSIONS.APPLICATION_SUBMIT,
    ]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, route('approve'))).toEqual([
      LEAVE_PERMISSIONS.APPLICATION_REVIEW,
    ]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, route('reject'))).toEqual([
      LEAVE_PERMISSIONS.APPLICATION_REVIEW,
    ]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, route('withdraw'))).toEqual([
      LEAVE_PERMISSIONS.APPLICATION_WITHDRAW,
    ]);
  });
});
