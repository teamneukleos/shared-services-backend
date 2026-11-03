import { SetMetadata } from '@nestjs/common';
import { PERMISSIONS_KEY } from '../authorization.constants';
import { assertPermission, Permission } from '../domain/permission.types';

export const Permissions = (...permissions: Permission[]) => {
  const normalized = [
    ...new Set(permissions.map((permission) => assertPermission(permission))),
  ];

  return SetMetadata(PERMISSIONS_KEY, normalized);
};
