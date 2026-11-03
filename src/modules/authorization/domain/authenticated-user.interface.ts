export interface AuthenticatedUser {
  id: string;
  organisationId: string;
  email: string;
  /** Linked Employee id when the user account is attached to an HR record. */
  employeeId: string | null;
  permissions: string[];
}
