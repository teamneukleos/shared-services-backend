import catalogueData from './permission-catalogue.data.json';

export type PermissionCatalogueEntry = {
  readonly code: string;
  readonly description: string;
};

/**
 * Canonical permission catalogue shared by Nest services and the auth seed.
 * Domain modules re-export their permission constant groups from here.
 */
export const PERMISSION_CATALOGUE: readonly PermissionCatalogueEntry[] =
  catalogueData;

export const EMPLOYEE_PERMISSIONS = {
  CREATE: 'employee.create',
  READ: 'employee.read',
  UPDATE: 'employee.update',
  STATUS_CHANGE: 'employee.status.change',
} as const;

export const ONBOARDING_PERMISSIONS = {
  CREATE: 'onboarding.create',
  READ: 'onboarding.read',
  UPDATE: 'onboarding.update',
  TASK_MANAGE: 'onboarding.task.manage',
  STATUS_CHANGE: 'onboarding.status.change',
} as const;

export const LEAVE_PERMISSIONS = {
  TYPE_CREATE: 'leave.type.create',
  TYPE_READ: 'leave.type.read',
  TYPE_UPDATE: 'leave.type.update',
  BALANCE_CREATE: 'leave.balance.create',
  BALANCE_READ: 'leave.balance.read',
  APPLICATION_SUBMIT: 'leave.application.submit',
  APPLICATION_READ: 'leave.application.read',
  APPLICATION_REVIEW: 'leave.application.review',
  APPLICATION_WITHDRAW: 'leave.application.withdraw',
} as const;

export const ORGANISATION_PERMISSIONS = {
  READ: 'organisation.read',
  STRUCTURE_READ: 'organisation.structure.read',
  STRUCTURE_MANAGE: 'organisation.structure.manage',
} as const;

export const IDENTITY_PERMISSIONS = {
  USER_MANAGE: 'identity.user.manage',
  USER_READ: 'identity.user.read',
  ROLE_MANAGE: 'identity.role.manage',
  ROLE_READ: 'identity.role.read',
} as const;

const catalogueCodes = new Set(
  PERMISSION_CATALOGUE.map((entry) => entry.code),
);

export function isCataloguePermissionCode(code: string): boolean {
  return catalogueCodes.has(code);
}

export function listCataloguePermissionCodes(): string[] {
  return PERMISSION_CATALOGUE.map((entry) => entry.code);
}

/** All typed constant values must exist in the JSON catalogue. */
export function assertPermissionConstantsInCatalogue(): void {
  const constants = [
    ...Object.values(EMPLOYEE_PERMISSIONS),
    ...Object.values(ONBOARDING_PERMISSIONS),
    ...Object.values(LEAVE_PERMISSIONS),
    ...Object.values(ORGANISATION_PERMISSIONS),
    ...Object.values(IDENTITY_PERMISSIONS),
  ];

  for (const code of constants) {
    if (!catalogueCodes.has(code)) {
      throw new Error(
        `Permission constant "${code}" is missing from permission-catalogue.data.json`,
      );
    }
  }

  if (constants.length !== new Set(constants).size) {
    throw new Error('Duplicate permission codes in typed constant groups');
  }

  if (constants.length !== PERMISSION_CATALOGUE.length) {
    throw new Error(
      'permission-catalogue.data.json entries do not match typed constant groups',
    );
  }
}
