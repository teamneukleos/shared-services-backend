import { AuthenticatedPrincipal } from './authenticated-principal.interface';
import {
  CreateRefreshTokenInput,
  RefreshTokenLogoutResult,
  RefreshTokenRotationResult,
} from './refresh-token.types';

export const AUTHENTICATION_REPOSITORY = Symbol('AUTHENTICATION_REPOSITORY');

export interface AuthenticationRepository {
  findActivePrincipalById(
    userId: string,
    organisationId: string,
  ): Promise<AuthenticatedPrincipal | null>;

  /**
   * Resolves an active ERP principal linked to a Google Workspace subject.
   * Returns null when the identity is missing, unlinked, or the user/organisation is inactive.
   */
  findActivePrincipalByGoogleSubject(
    subject: string,
  ): Promise<AuthenticatedPrincipal | null>;

  /**
   * First Google sign-in after an email-only invite: match verified Workspace email to
   * an invited/active account with no Google link, create ExternalIdentity, activate if needed.
   * Returns null when no unique eligible account exists.
   */
  linkInvitedPrincipalByGoogleIdentity(input: {
    subject: string;
    email: string;
    hostedDomain: string;
  }): Promise<AuthenticatedPrincipal | null>;

  createRefreshToken(input: CreateRefreshTokenInput): Promise<{ id: string }>;

  /**
   * Atomically rotates a presented refresh token.
   * On confirmed reuse of an already-rotated token, revokes the token family.
   */
  rotateRefreshToken(input: {
    presentedTokenHash: string;
    replacementTokenHash: string;
    replacementExpiresAt: Date;
  }): Promise<RefreshTokenRotationResult>;

  /**
   * Revokes the token family for the presented hash.
   * Idempotent for unknown or already-revoked tokens.
   */
  revokeRefreshTokenFamilyByHash(
    tokenHash: string,
  ): Promise<RefreshTokenLogoutResult>;
}
