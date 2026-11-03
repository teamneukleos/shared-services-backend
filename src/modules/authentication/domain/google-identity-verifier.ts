import { GoogleVerifiedIdentity } from './google-verified-identity.interface';

export const GOOGLE_IDENTITY_VERIFIER = Symbol('GOOGLE_IDENTITY_VERIFIER');

export interface GoogleIdentityVerifier {
  verifyIdToken(idToken: string): Promise<GoogleVerifiedIdentity>;
}
