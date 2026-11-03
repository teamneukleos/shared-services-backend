import { AuthenticatedPrincipal } from './authenticated-principal.interface';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  refreshExpiresIn: string;
  user: AuthenticatedPrincipal;
}
