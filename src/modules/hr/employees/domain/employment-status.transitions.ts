import { EmploymentStatus } from '../../../../generated/prisma/client';

const ALLOWED_TRANSITIONS: Record<EmploymentStatus, EmploymentStatus[]> = {
  [EmploymentStatus.PENDING]: [
    EmploymentStatus.ACTIVE,
    EmploymentStatus.TERMINATED,
  ],
  [EmploymentStatus.ACTIVE]: [
    EmploymentStatus.SUSPENDED,
    EmploymentStatus.TERMINATED,
  ],
  [EmploymentStatus.SUSPENDED]: [
    EmploymentStatus.ACTIVE,
    EmploymentStatus.TERMINATED,
  ],
  [EmploymentStatus.TERMINATED]: [],
};

export function canTransitionEmploymentStatus(
  from: EmploymentStatus,
  to: EmploymentStatus,
): boolean {
  if (from === to) {
    return false;
  }

  return ALLOWED_TRANSITIONS[from].includes(to);
}
