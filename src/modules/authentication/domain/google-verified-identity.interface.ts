export interface GoogleVerifiedIdentity {
  /** Google subject — permanent external identity identifier (not email). */
  subject: string;
  email: string;
  hostedDomain: string;
  emailVerified: true;
}
