export type RolePermissionSummary = {
  id: string;
  code: string;
  description: string | null;
};

export type RoleRecord = {
  id: string;
  organisationId: string;
  name: string;
  code: string;
  permissions: RolePermissionSummary[];
  assignmentCount: number;
};

export type RoleAssignmentRecord = {
  id: string;
  userId: string;
  roleId: string;
  roleCode: string;
  roleName: string;
  startsAt: Date;
  endsAt: Date | null;
};
