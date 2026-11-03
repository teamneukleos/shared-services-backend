import {
  OnboardingStatus,
  OnboardingTaskStatus,
} from '../../../../generated/prisma/client';

export interface OnboardingTaskRecord {
  id: string;
  planId: string;
  title: string;
  description: string | null;
  category: string | null;
  isRequired: boolean;
  status: OnboardingTaskStatus;
  dueDate: Date | null;
  assigneeUserId: string | null;
  completedAt: Date | null;
  completedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OnboardingRecord {
  id: string;
  organisationId: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  name: string;
  notes: string | null;
  startDate: Date;
  targetCompletionDate: Date | null;
  completedAt: Date | null;
  status: OnboardingStatus;
  coordinatorUserId: string | null;
  tasks: OnboardingTaskRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOnboardingInput {
  organisationId: string;
  employeeId: string;
  name: string;
  notes?: string;
  startDate: Date;
  targetCompletionDate?: Date;
  coordinatorUserId?: string;
}

export interface UpdateOnboardingInput {
  organisationId: string;
  onboardingId: string;
  name?: string;
  notes?: string | null;
  startDate?: Date;
  targetCompletionDate?: Date | null;
  coordinatorUserId?: string | null;
}

export interface ChangeOnboardingStatusInput {
  organisationId: string;
  onboardingId: string;
  status: OnboardingStatus;
  reason?: string;
}

export interface CreateOnboardingTaskInput {
  organisationId: string;
  onboardingId: string;
  title: string;
  description?: string;
  category?: string;
  isRequired?: boolean;
  dueDate?: Date;
  assigneeUserId?: string;
}

export interface UpdateOnboardingTaskInput {
  organisationId: string;
  onboardingId: string;
  taskId: string;
  title?: string;
  description?: string | null;
  category?: string | null;
  isRequired?: boolean;
  dueDate?: Date | null;
  assigneeUserId?: string | null;
}

export interface ChangeOnboardingTaskStatusInput {
  organisationId: string;
  onboardingId: string;
  taskId: string;
  status: OnboardingTaskStatus;
  actorUserId: string;
  reason?: string;
}

export interface ListOnboardingQuery {
  organisationId: string;
  page: number;
  size: number;
  employeeId?: string;
  status?: OnboardingStatus;
  startDateFrom?: Date;
  startDateTo?: Date;
}
