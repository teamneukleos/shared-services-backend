import {
  LeaveRequestStatus,
  RecordStatus,
} from '../../../generated/prisma/client';

export interface LeaveTypeRecord {
  id: string;
  organisationId: string;
  name: string;
  code: string;
  description: string | null;
  unit: string;
  paid: boolean;
  status: RecordStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeaveBalanceRecord {
  id: string;
  organisationId: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  leaveTypeId: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  entitled: number;
  available: number;
  reserved: number;
  used: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeaveApplicationRecord {
  id: string;
  organisationId: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  leaveTypeId: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  startDate: Date;
  endDate: Date;
  quantity: number;
  reason: string | null;
  status: LeaveRequestStatus;
  submittedAt: Date;
  reviewedAt: Date | null;
  reviewedByUserId: string | null;
  reviewComment: string | null;
  createdAt: Date;
  updatedAt: Date;
}
