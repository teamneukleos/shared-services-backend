import { PaginatedResult } from '../../../../common/interfaces/pagination.interface';
import {
  ChangeEmployeeStatusInput,
  CreateEmployeeInput,
  EmployeeRecord,
  ListEmployeesQuery,
  UpdateEmployeeInput,
} from './employee.types';

export const EMPLOYEE_REPOSITORY = Symbol('EMPLOYEE_REPOSITORY');

export interface EmployeeRepository {
  create(input: CreateEmployeeInput): Promise<EmployeeRecord>;
  findByIdInOrganisation(
    organisationId: string,
    employeeId: string,
  ): Promise<EmployeeRecord | null>;
  list(query: ListEmployeesQuery): Promise<PaginatedResult<EmployeeRecord>>;
  update(input: UpdateEmployeeInput): Promise<EmployeeRecord>;
  changeStatus(input: ChangeEmployeeStatusInput): Promise<EmployeeRecord>;
}
