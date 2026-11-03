import {
  OnboardingStatus,
  OnboardingTaskStatus,
} from '../../../../generated/prisma/client';

const PLAN_TRANSITIONS: Record<OnboardingStatus, OnboardingStatus[]> = {
  [OnboardingStatus.NOT_STARTED]: [
    OnboardingStatus.IN_PROGRESS,
    OnboardingStatus.CANCELLED,
  ],
  [OnboardingStatus.IN_PROGRESS]: [
    OnboardingStatus.COMPLETED,
    OnboardingStatus.CANCELLED,
  ],
  [OnboardingStatus.COMPLETED]: [],
  [OnboardingStatus.CANCELLED]: [],
};

const TASK_TRANSITIONS: Record<OnboardingTaskStatus, OnboardingTaskStatus[]> = {
  [OnboardingTaskStatus.PENDING]: [
    OnboardingTaskStatus.IN_PROGRESS,
    OnboardingTaskStatus.COMPLETED,
    OnboardingTaskStatus.SKIPPED,
  ],
  [OnboardingTaskStatus.IN_PROGRESS]: [
    OnboardingTaskStatus.PENDING,
    OnboardingTaskStatus.COMPLETED,
    OnboardingTaskStatus.SKIPPED,
  ],
  [OnboardingTaskStatus.COMPLETED]: [OnboardingTaskStatus.IN_PROGRESS],
  [OnboardingTaskStatus.SKIPPED]: [
    OnboardingTaskStatus.PENDING,
    OnboardingTaskStatus.IN_PROGRESS,
  ],
};

export function canTransitionOnboardingStatus(
  from: OnboardingStatus,
  to: OnboardingStatus,
): boolean {
  if (from === to) {
    return false;
  }
  return PLAN_TRANSITIONS[from].includes(to);
}

export function canTransitionOnboardingTaskStatus(
  from: OnboardingTaskStatus,
  to: OnboardingTaskStatus,
): boolean {
  if (from === to) {
    return false;
  }
  return TASK_TRANSITIONS[from].includes(to);
}

/**
 * Required tasks cannot be SKIPPED. SKIPPED is only valid for optional tasks.
 * Completing an onboarding plan requires every required task to be COMPLETED
 * (SKIPPED required tasks are therefore impossible and would block completion
 * if they somehow existed).
 */
export function canSkipOnboardingTask(isRequired: boolean): boolean {
  return !isRequired;
}

export function isRequiredTaskSatisfied(
  isRequired: boolean,
  status: OnboardingTaskStatus,
): boolean {
  if (!isRequired) {
    return true;
  }
  return status === OnboardingTaskStatus.COMPLETED;
}
