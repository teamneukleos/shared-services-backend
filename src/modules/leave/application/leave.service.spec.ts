import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  LeaveRequestStatus,
  RecordStatus,
} from '../../../generated/prisma/client';
import { AuditService } from '../../audit/application/audit.service';
import { AuditAction } from '../../audit/domain/audit-action.enum';
import { AuthenticatedUser } from '../../authorization/domain/authenticated-user.interface';
import { LeaveApplicationRecord } from '../domain/leave.types';
import { PrismaLeaveRepository } from '../infrastructure/prisma-leave.repository';
import { LeaveService } from './leave.service';

describe('LeaveService', () => {
  const createLeaveType = jest.fn();
  const listLeaveTypes = jest.fn();
  const findLeaveType = jest.fn();
  const updateLeaveType = jest.fn();
  const createLeaveBalance = jest.fn();
  const listLeaveBalances = jest.fn();
  const findLeaveBalance = jest.fn();
  const resolveLinkedEmployeeId = jest.fn();
  const submitApplication = jest.fn();
  const listApplications = jest.fn();
  const findApplication = jest.fn();
  const approveApplication = jest.fn();
  const rejectApplication = jest.fn();
  const withdrawApplication = jest.fn();
  const record = jest.fn();

  const repository = {
    createLeaveType,
    listLeaveTypes,
    findLeaveType,
    updateLeaveType,
    createLeaveBalance,
    listLeaveBalances,
    findLeaveBalance,
    resolveLinkedEmployeeId,
    submitApplication,
    listApplications,
    findApplication,
    approveApplication,
    rejectApplication,
    withdrawApplication,
  } as unknown as PrismaLeaveRepository;

  const auditService = { record } as unknown as AuditService;
  let service: LeaveService;

  const actor: AuthenticatedUser = {
    id: 'user-1',
    organisationId: 'org-1',
    email: 'ada@neukleos.com',
    employeeId: null,
    permissions: [],
  };

  const application: LeaveApplicationRecord = {
    id: 'app-1',
    organisationId: 'org-1',
    employeeId: 'emp-1',
    employeeNumber: 'E-001',
    employeeName: 'Ada Lovelace',
    leaveTypeId: 'type-1',
    leaveTypeCode: 'ANNUAL',
    leaveTypeName: 'Annual Leave',
    startDate: new Date('2026-03-01T00:00:00.000Z'),
    endDate: new Date('2026-03-03T00:00:00.000Z'),
    quantity: 3,
    reason: 'Holiday',
    status: LeaveRequestStatus.PENDING,
    submittedAt: new Date('2026-02-01T00:00:00.000Z'),
    reviewedAt: null,
    reviewedByUserId: null,
    reviewComment: null,
    createdAt: new Date('2026-02-01T00:00:00.000Z'),
    updatedAt: new Date('2026-02-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    record.mockResolvedValue(undefined);
    service = new LeaveService(repository, auditService);
  });

  it('rejects operations without organisation context', async () => {
    await expect(
      service.listLeaveTypes(
        { ...actor, organisationId: '' },
        { page: 1, size: 20 },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('creates a leave type and audits', async () => {
    createLeaveType.mockResolvedValue({
      id: 'type-1',
      organisationId: 'org-1',
      name: 'Annual Leave',
      code: 'ANNUAL',
      description: null,
      unit: 'DAYS',
      paid: true,
      status: RecordStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await service.createLeaveType(actor, {
      name: 'Annual Leave',
      code: 'ANNUAL',
    });

    expect(createLeaveType).toHaveBeenCalledWith(
      expect.objectContaining({ organisationId: 'org-1', code: 'ANNUAL' }),
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CREATE,
        resourceType: 'LeaveType',
      }),
    );
  });

  it('submits an application for the linked employee and audits', async () => {
    resolveLinkedEmployeeId.mockResolvedValue('emp-1');
    submitApplication.mockResolvedValue(application);

    await expect(
      service.submitApplication(actor, {
        leaveTypeId: 'type-1',
        startDate: application.startDate,
        endDate: application.endDate,
        reason: 'Holiday',
      }),
    ).resolves.toEqual(application);

    expect(resolveLinkedEmployeeId).toHaveBeenCalledWith('org-1', 'user-1');
    expect(submitApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: 'org-1',
        employeeId: 'emp-1',
        leaveTypeId: 'type-1',
      }),
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.SUBMIT,
        resourceType: 'LeaveRequest',
      }),
    );
  });

  it('returns not found for cross-organisation leave types', async () => {
    findLeaveType.mockResolvedValue(null);
    await expect(service.getLeaveType(actor, 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('approves and audits', async () => {
    approveApplication.mockResolvedValue({
      ...application,
      status: LeaveRequestStatus.APPROVED,
      reviewedByUserId: 'user-2',
    });

    await service.approveApplication({ ...actor, id: 'user-2' }, 'app-1');

    expect(approveApplication).toHaveBeenCalledWith({
      organisationId: 'org-1',
      applicationId: 'app-1',
      reviewerUserId: 'user-2',
    });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.APPROVE }),
    );
  });

  it('rejects with reason and audits', async () => {
    rejectApplication.mockResolvedValue({
      ...application,
      status: LeaveRequestStatus.REJECTED,
      reviewComment: 'Coverage',
    });

    await service.rejectApplication(actor, 'app-1', { reason: 'Coverage' });

    expect(rejectApplication).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'Coverage' }),
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.REJECT,
        reason: 'Coverage',
      }),
    );
  });

  it('withdraws own pending application', async () => {
    resolveLinkedEmployeeId.mockResolvedValue('emp-1');
    withdrawApplication.mockResolvedValue({
      ...application,
      status: LeaveRequestStatus.CANCELLED,
    });

    await service.withdrawApplication(actor, 'app-1');

    expect(withdrawApplication).toHaveBeenCalledWith({
      organisationId: 'org-1',
      applicationId: 'app-1',
      employeeId: 'emp-1',
    });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.CANCEL }),
    );
  });

  it('rejects inverted list date filters', async () => {
    await expect(
      service.listApplications(actor, {
        page: 1,
        size: 20,
        startDateFrom: new Date('2026-03-10T00:00:00.000Z'),
        startDateTo: new Date('2026-03-01T00:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a leave balance and audits', async () => {
    createLeaveBalance.mockResolvedValue({
      id: 'bal-1',
      organisationId: 'org-1',
      employeeId: 'emp-1',
      employeeNumber: 'E-001',
      employeeName: 'Ada Lovelace',
      leaveTypeId: 'type-1',
      leaveTypeCode: 'ANNUAL',
      leaveTypeName: 'Annual Leave',
      entitled: 20,
      available: 20,
      reserved: 0,
      used: 0,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await service.createLeaveBalance(actor, {
      employeeId: 'emp-1',
      leaveTypeId: 'type-1',
      entitled: 20,
    });

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CREATE,
        resourceType: 'LeaveBalance',
      }),
    );
  });
});
