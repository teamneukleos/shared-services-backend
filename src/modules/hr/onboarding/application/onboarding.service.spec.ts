import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  OnboardingStatus,
  OnboardingTaskStatus,
} from '../../../../generated/prisma/client';
import { AuditService } from '../../../audit/application/audit.service';
import { AuditAction } from '../../../audit/domain/audit-action.enum';
import { AuthenticatedUser } from '../../../authorization/domain/authenticated-user.interface';
import { OnboardingRepository } from '../domain/onboarding.repository';
import {
  OnboardingRecord,
  OnboardingTaskRecord,
} from '../domain/onboarding.types';
import { OnboardingService } from './onboarding.service';

describe('OnboardingService', () => {
  const create = jest.fn();
  const findByIdInOrganisation = jest.fn();
  const list = jest.fn();
  const update = jest.fn();
  const changeStatus = jest.fn();
  const addTask = jest.fn();
  const updateTask = jest.fn();
  const changeTaskStatus = jest.fn();
  const record = jest.fn();

  const repository = {
    create,
    findByIdInOrganisation,
    list,
    update,
    changeStatus,
    addTask,
    updateTask,
    changeTaskStatus,
  } as unknown as OnboardingRepository;

  const auditService = { record } as unknown as AuditService;
  let service: OnboardingService;

  const actor: AuthenticatedUser = {
    id: 'user-1',
    organisationId: 'org-1',
    email: 'hr@neukleos.com',
    employeeId: null,
    permissions: ['onboarding.create'],
  };

  const task: OnboardingTaskRecord = {
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
  };

  const plan: OnboardingRecord = {
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
    status: OnboardingStatus.IN_PROGRESS,
    coordinatorUserId: null,
    tasks: [task],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    record.mockResolvedValue(undefined);
    service = new OnboardingService(repository, auditService);
  });

  it('creates an onboarding plan in the actor organisation and audits', async () => {
    create.mockResolvedValue({
      ...plan,
      status: OnboardingStatus.NOT_STARTED,
      tasks: [],
    });

    await expect(
      service.create(actor, {
        employeeId: 'emp-1',
        name: 'Standard onboarding',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ).resolves.toEqual(
      expect.objectContaining({ employeeId: 'emp-1', organisationId: 'org-1' }),
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ organisationId: 'org-1', employeeId: 'emp-1' }),
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CREATE,
        resourceType: 'OnboardingPlan',
      }),
    );
  });

  it('rejects access without organisation context', async () => {
    await expect(
      service.list({ ...actor, organisationId: '' }, { page: 1, size: 20 }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns not found outside organisation scope', async () => {
    findByIdInOrganisation.mockResolvedValue(null);
    await expect(service.findOne(actor, 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(findByIdInOrganisation).toHaveBeenCalledWith('org-1', 'missing');
  });

  it('rejects invalid plan status transitions', async () => {
    findByIdInOrganisation.mockResolvedValue({
      ...plan,
      status: OnboardingStatus.NOT_STARTED,
    });

    await expect(
      service.changeStatus(actor, 'plan-1', {
        status: OnboardingStatus.COMPLETED,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(changeStatus).not.toHaveBeenCalled();
  });

  it('blocks completing onboarding while required tasks are incomplete', async () => {
    findByIdInOrganisation.mockResolvedValue(plan);

    await expect(
      service.changeStatus(actor, 'plan-1', {
        status: OnboardingStatus.COMPLETED,
      }),
    ).rejects.toThrow(/required tasks remain incomplete/i);
    expect(changeStatus).not.toHaveBeenCalled();
  });

  it('blocks completing when a required task is only SKIPPED', async () => {
    findByIdInOrganisation.mockResolvedValue({
      ...plan,
      tasks: [{ ...task, status: OnboardingTaskStatus.SKIPPED }],
    });

    await expect(
      service.changeStatus(actor, 'plan-1', {
        status: OnboardingStatus.COMPLETED,
      }),
    ).rejects.toThrow(/SKIPPED does not satisfy required tasks/i);
  });

  it('completes onboarding when all required tasks are COMPLETED', async () => {
    findByIdInOrganisation.mockResolvedValue({
      ...plan,
      tasks: [{ ...task, status: OnboardingTaskStatus.COMPLETED }],
    });
    changeStatus.mockResolvedValue({
      ...plan,
      status: OnboardingStatus.COMPLETED,
      completedAt: new Date('2026-02-01T00:00:00.000Z'),
      tasks: [{ ...task, status: OnboardingTaskStatus.COMPLETED }],
    });

    await expect(
      service.changeStatus(actor, 'plan-1', {
        status: OnboardingStatus.COMPLETED,
      }),
    ).resolves.toEqual(
      expect.objectContaining({ status: OnboardingStatus.COMPLETED }),
    );
  });

  it('allows completion when optional tasks are skipped', async () => {
    findByIdInOrganisation.mockResolvedValue({
      ...plan,
      tasks: [
        { ...task, status: OnboardingTaskStatus.COMPLETED },
        {
          ...task,
          id: 'task-2',
          isRequired: false,
          status: OnboardingTaskStatus.SKIPPED,
        },
      ],
    });
    changeStatus.mockResolvedValue({
      ...plan,
      status: OnboardingStatus.COMPLETED,
    });

    await expect(
      service.changeStatus(actor, 'plan-1', {
        status: OnboardingStatus.COMPLETED,
      }),
    ).resolves.toEqual(
      expect.objectContaining({ status: OnboardingStatus.COMPLETED }),
    );
  });

  it('rejects skipping a required task', async () => {
    findByIdInOrganisation.mockResolvedValue(plan);

    await expect(
      service.changeTaskStatus(actor, 'plan-1', 'task-1', {
        status: OnboardingTaskStatus.SKIPPED,
      }),
    ).rejects.toThrow(/cannot be skipped/i);
    expect(changeTaskStatus).not.toHaveBeenCalled();
  });

  it('allows skipping an optional task and audits', async () => {
    findByIdInOrganisation.mockResolvedValue({
      ...plan,
      tasks: [{ ...task, isRequired: false }],
    });
    changeTaskStatus.mockResolvedValue({
      ...task,
      isRequired: false,
      status: OnboardingTaskStatus.SKIPPED,
    });

    await expect(
      service.changeTaskStatus(actor, 'plan-1', 'task-1', {
        status: OnboardingTaskStatus.SKIPPED,
        reason: 'Not applicable',
      }),
    ).resolves.toEqual(
      expect.objectContaining({ status: OnboardingTaskStatus.SKIPPED }),
    );

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.UPDATE,
        resourceType: 'OnboardingTask',
        reason: 'Not applicable',
      }),
    );
  });

  it('rejects targetCompletionDate before startDate', async () => {
    await expect(
      service.create(actor, {
        employeeId: 'emp-1',
        name: 'Plan',
        startDate: new Date('2026-06-01T00:00:00.000Z'),
        targetCompletionDate: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('lists with organisation scoping and filters', async () => {
    list.mockResolvedValue({
      data: [plan],
      meta: {
        page: 1,
        size: 20,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });

    await service.list(actor, {
      page: 1,
      size: 20,
      employeeId: 'emp-1',
      status: OnboardingStatus.IN_PROGRESS,
    });

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: 'org-1',
        employeeId: 'emp-1',
        status: OnboardingStatus.IN_PROGRESS,
      }),
    );
  });
});
