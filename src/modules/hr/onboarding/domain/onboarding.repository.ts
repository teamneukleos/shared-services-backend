import { PaginatedResult } from '../../../../common/interfaces/pagination.interface';
import {
  ChangeOnboardingStatusInput,
  ChangeOnboardingTaskStatusInput,
  CreateOnboardingInput,
  CreateOnboardingTaskInput,
  ListOnboardingQuery,
  OnboardingRecord,
  OnboardingTaskRecord,
  UpdateOnboardingInput,
  UpdateOnboardingTaskInput,
} from './onboarding.types';

export const ONBOARDING_REPOSITORY = Symbol('ONBOARDING_REPOSITORY');

export interface OnboardingRepository {
  create(input: CreateOnboardingInput): Promise<OnboardingRecord>;
  findByIdInOrganisation(
    organisationId: string,
    onboardingId: string,
  ): Promise<OnboardingRecord | null>;
  list(query: ListOnboardingQuery): Promise<PaginatedResult<OnboardingRecord>>;
  update(input: UpdateOnboardingInput): Promise<OnboardingRecord>;
  changeStatus(input: ChangeOnboardingStatusInput): Promise<OnboardingRecord>;
  addTask(input: CreateOnboardingTaskInput): Promise<OnboardingTaskRecord>;
  updateTask(input: UpdateOnboardingTaskInput): Promise<OnboardingTaskRecord>;
  changeTaskStatus(
    input: ChangeOnboardingTaskStatusInput,
  ): Promise<OnboardingTaskRecord>;
}
