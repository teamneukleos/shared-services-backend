import {
  OnboardingStatus,
  OnboardingTaskStatus,
} from '../../../../generated/prisma/client';
import {
  canSkipOnboardingTask,
  canTransitionOnboardingStatus,
  canTransitionOnboardingTaskStatus,
  isRequiredTaskSatisfied,
} from './onboarding-status.transitions';

describe('onboarding status transitions', () => {
  it('allows not started to in progress or cancelled', () => {
    expect(
      canTransitionOnboardingStatus(
        OnboardingStatus.NOT_STARTED,
        OnboardingStatus.IN_PROGRESS,
      ),
    ).toBe(true);
    expect(
      canTransitionOnboardingStatus(
        OnboardingStatus.NOT_STARTED,
        OnboardingStatus.CANCELLED,
      ),
    ).toBe(true);
    expect(
      canTransitionOnboardingStatus(
        OnboardingStatus.NOT_STARTED,
        OnboardingStatus.COMPLETED,
      ),
    ).toBe(false);
  });

  it('allows in progress to completed or cancelled only', () => {
    expect(
      canTransitionOnboardingStatus(
        OnboardingStatus.IN_PROGRESS,
        OnboardingStatus.COMPLETED,
      ),
    ).toBe(true);
    expect(
      canTransitionOnboardingStatus(
        OnboardingStatus.IN_PROGRESS,
        OnboardingStatus.CANCELLED,
      ),
    ).toBe(true);
    expect(
      canTransitionOnboardingStatus(
        OnboardingStatus.IN_PROGRESS,
        OnboardingStatus.NOT_STARTED,
      ),
    ).toBe(false);
  });

  it('treats completed and cancelled as terminal', () => {
    expect(
      canTransitionOnboardingStatus(
        OnboardingStatus.COMPLETED,
        OnboardingStatus.IN_PROGRESS,
      ),
    ).toBe(false);
    expect(
      canTransitionOnboardingStatus(
        OnboardingStatus.CANCELLED,
        OnboardingStatus.IN_PROGRESS,
      ),
    ).toBe(false);
  });
});

describe('onboarding task status transitions', () => {
  it('allows pending to in progress, completed, or skipped', () => {
    expect(
      canTransitionOnboardingTaskStatus(
        OnboardingTaskStatus.PENDING,
        OnboardingTaskStatus.IN_PROGRESS,
      ),
    ).toBe(true);
    expect(
      canTransitionOnboardingTaskStatus(
        OnboardingTaskStatus.PENDING,
        OnboardingTaskStatus.COMPLETED,
      ),
    ).toBe(true);
    expect(
      canTransitionOnboardingTaskStatus(
        OnboardingTaskStatus.PENDING,
        OnboardingTaskStatus.SKIPPED,
      ),
    ).toBe(true);
  });

  it('rejects skipping required tasks', () => {
    expect(canSkipOnboardingTask(true)).toBe(false);
    expect(canSkipOnboardingTask(false)).toBe(true);
  });

  it('only treats COMPLETED as satisfying a required task', () => {
    expect(isRequiredTaskSatisfied(true, OnboardingTaskStatus.COMPLETED)).toBe(
      true,
    );
    expect(isRequiredTaskSatisfied(true, OnboardingTaskStatus.SKIPPED)).toBe(
      false,
    );
    expect(isRequiredTaskSatisfied(true, OnboardingTaskStatus.PENDING)).toBe(
      false,
    );
    expect(isRequiredTaskSatisfied(false, OnboardingTaskStatus.SKIPPED)).toBe(
      true,
    );
  });
});
