import {
  Injectable,
  Logger,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { GoogleIdentityVerifier } from '../domain/google-identity-verifier';
import { GoogleVerifiedIdentity } from '../domain/google-verified-identity.interface';

const GOOGLE_ISSUERS = new Set([
  'https://accounts.google.com',
  'accounts.google.com',
]);

@Injectable()
export class GoogleIdTokenVerifier implements GoogleIdentityVerifier {
  private readonly logger = new Logger(GoogleIdTokenVerifier.name);
  private readonly oauthClient: OAuth2Client;
  private readonly clientId: string;
  private readonly allowedDomains: Set<string>;

  constructor(
    configService: ConfigService,
    @Optional() oauthClient?: OAuth2Client,
  ) {
    this.clientId = configService.getOrThrow<string>('google.clientId');
    this.allowedDomains = new Set(
      configService
        .getOrThrow<string[]>('google.allowedDomains')
        .map((domain) => domain.toLowerCase()),
    );
    this.oauthClient = oauthClient ?? new OAuth2Client(this.clientId);
  }

  async verifyIdToken(idToken: string): Promise<GoogleVerifiedIdentity> {
    if (typeof idToken !== 'string' || idToken.trim().length === 0) {
      throw new UnauthorizedException('Google identity token is required');
    }

    let payload: TokenPayload | undefined;

    try {
      const ticket = await this.oauthClient.verifyIdToken({
        idToken: idToken.trim(),
        audience: this.clientId,
      });
      payload = ticket.getPayload();
    } catch {
      this.logger.warn('Google ID token verification failed');
      throw new UnauthorizedException('Invalid Google identity token');
    }

    if (!payload) {
      throw new UnauthorizedException('Invalid Google identity token');
    }

    this.assertIssuer(payload.iss);
    this.assertAudience(payload.aud);
    this.assertExpiry(payload.exp);

    if (payload.email_verified !== true) {
      throw new UnauthorizedException('Google email is not verified');
    }

    const email =
      typeof payload.email === 'string'
        ? payload.email.trim().toLowerCase()
        : '';
    if (!email) {
      throw new UnauthorizedException('Google identity is missing an email');
    }

    const subject = typeof payload.sub === 'string' ? payload.sub.trim() : '';
    if (!subject) {
      throw new UnauthorizedException('Google identity is missing a subject');
    }

    const hostedDomain = this.resolveHostedDomain(payload.hd, email);

    return {
      subject,
      email,
      hostedDomain,
      emailVerified: true,
    };
  }

  private assertIssuer(issuer: string | undefined): void {
    if (!issuer || !GOOGLE_ISSUERS.has(issuer)) {
      throw new UnauthorizedException('Invalid Google identity token issuer');
    }
  }

  private assertAudience(audience: string | string[] | undefined): void {
    const audiences = Array.isArray(audience) ? audience : [audience];
    if (!audiences.includes(this.clientId)) {
      throw new UnauthorizedException('Invalid Google identity token audience');
    }
  }

  private assertExpiry(expirySeconds: number | undefined): void {
    if (
      typeof expirySeconds !== 'number' ||
      expirySeconds * 1000 <= Date.now()
    ) {
      throw new UnauthorizedException('Google identity token has expired');
    }
  }

  private resolveHostedDomain(
    hostedDomainClaim: string | undefined,
    email: string,
  ): string {
    const hostedDomain =
      typeof hostedDomainClaim === 'string'
        ? hostedDomainClaim.trim().toLowerCase()
        : '';

    if (!hostedDomain) {
      throw new UnauthorizedException('Google hosted-domain claim is required');
    }

    if (!this.allowedDomains.has(hostedDomain)) {
      throw new UnauthorizedException('Google Workspace domain is not allowed');
    }

    const emailDomain = email.split('@')[1]?.toLowerCase();
    if (!emailDomain || emailDomain !== hostedDomain) {
      throw new UnauthorizedException(
        'Google identity email domain does not match hosted domain',
      );
    }

    return hostedDomain;
  }
}
