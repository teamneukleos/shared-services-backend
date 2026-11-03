export type RefreshTokenRotationResult =
  | {
      outcome: 'rotated';
      userId: string;
      organisationId: string;
      familyId: string;
      previousTokenId: string;
      replacementTokenId: string;
    }
  | {
      outcome: 'reuse_detected';
      familyId: string;
    }
  | {
      outcome: 'invalid';
    }
  | {
      outcome: 'concurrent_conflict';
    };

export type RefreshTokenLogoutResult =
  | 'revoked'
  | 'already_inactive'
  | 'not_found';

export interface CreateRefreshTokenInput {
  userId: string;
  organisationId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
}
