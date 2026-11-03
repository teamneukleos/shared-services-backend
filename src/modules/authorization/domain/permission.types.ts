export type Permission = string;

export function assertPermission(permission: string): Permission {
  if (typeof permission !== 'string') {
    throw new Error('Permission must be a string');
  }

  const trimmed = permission.trim();
  if (trimmed.length === 0) {
    throw new Error('Permission must not be empty');
  }

  return trimmed;
}
