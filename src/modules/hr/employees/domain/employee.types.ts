import {
  EmploymentStatus,
  EmploymentType,
} from '../../../../generated/prisma/client';

export interface EmployeeRecord {
  id: string;
  organisationId: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  workEmail: string;
  phone: string | null;
  departmentId: string;
  departmentName: string;
  jobTitle: string;
  positionId: string | null;
  employmentType: EmploymentType;
  status: EmploymentStatus;
  hireDate: Date;
  terminationDate: Date | null;
  managerId: string | null;
  managerName: string | null;
  userAccountId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEmployeeInput {
  organisationId: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  preferredName?: string;
  workEmail: string;
  phone?: string;
  departmentId: string;
  jobTitle: string;
  positionId?: string;
  teamId?: string;
  employmentType: EmploymentType;
  status?: EmploymentStatus;
  hireDate: Date;
  terminationDate?: Date;
  managerId?: string;
  userAccountId?: string;
}

export interface UpdateEmployeeInput {
  organisationId: string;
  employeeId: string;
  firstName?: string;
  lastName?: string;
  preferredName?: string | null;
  workEmail?: string;
  phone?: string | null;
  departmentId?: string;
  jobTitle?: string;
  positionId?: string | null;
  teamId?: string | null;
  employmentType?: EmploymentType;
  hireDate?: Date;
  terminationDate?: Date | null;
  managerId?: string | null;
  userAccountId?: string | null;
}

export interface ChangeEmployeeStatusInput {
  organisationId: string;
  employeeId: string;
  status: EmploymentStatus;
  terminationDate?: Date | null;
  reason?: string;
}

export interface ListEmployeesQuery {
  organisationId: string;
  page: number;
  size: number;
  search?: string;
  departmentId?: string;
  status?: EmploymentStatus;
  employmentType?: EmploymentType;
  managerId?: string;
}
