import { EmploymentStatus } from '../../../../generated/prisma/client';
import { canTransitionEmploymentStatus } from './employment-status.transitions';

describe('canTransitionEmploymentStatus', () => {
  it('allows pending to active or terminated', () => {
    expect(
      canTransitionEmploymentStatus(
        EmploymentStatus.PENDING,
        EmploymentStatus.ACTIVE,
      ),
    ).toBe(true);
    expect(
      canTransitionEmploymentStatus(
        EmploymentStatus.PENDING,
        EmploymentStatus.TERMINATED,
      ),
    ).toBe(true);
    expect(
      canTransitionEmploymentStatus(
        EmploymentStatus.PENDING,
        EmploymentStatus.SUSPENDED,
      ),
    ).toBe(false);
  });

  it('allows active to suspended or terminated', () => {
    expect(
      canTransitionEmploymentStatus(
        EmploymentStatus.ACTIVE,
        EmploymentStatus.SUSPENDED,
      ),
    ).toBe(true);
    expect(
      canTransitionEmploymentStatus(
        EmploymentStatus.ACTIVE,
        EmploymentStatus.TERMINATED,
      ),
    ).toBe(true);
    expect(
      canTransitionEmploymentStatus(
        EmploymentStatus.ACTIVE,
        EmploymentStatus.PENDING,
      ),
    ).toBe(false);
  });

  it('rejects transitions from terminated', () => {
    expect(
      canTransitionEmploymentStatus(
        EmploymentStatus.TERMINATED,
        EmploymentStatus.ACTIVE,
      ),
    ).toBe(false);
  });

  it('rejects no-op transitions', () => {
    expect(
      canTransitionEmploymentStatus(
        EmploymentStatus.ACTIVE,
        EmploymentStatus.ACTIVE,
      ),
    ).toBe(false);
  });
});
