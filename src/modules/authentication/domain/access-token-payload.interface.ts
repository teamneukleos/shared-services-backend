export interface AccessTokenPayload {
  sub: string;
  organisationId: string;
  email: string;
  tokenVersion?: number;
}
