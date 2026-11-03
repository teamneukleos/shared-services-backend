import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../../audit/application/audit.service';
import { AuditAction } from '../../audit/domain/audit-action.enum';
import { AccessTokenPayload } from '../domain/access-token-payload.interface';
import { AuthSession } from '../domain/auth-session.interface';
import { AuthenticatedPrincipal } from '../domain/authenticated-principal.interface';
import {
  AUTHENTICATION_REPOSITORY,
  AuthenticationRepository,
} from '../domain/authentication.repository';
import {
  GOOGLE_IDENTITY_VERIFIER,
  GoogleIdentityVerifier,
} from '../domain/google-identity-verifier';
import { GoogleVerifiedIdentity } from '../domain/google-verified-identity.interface';
import {
  expiresAtFromDuration,
  generateOpaqueRefreshToken,
  generateRefreshTokenFamilyId,
  hashRefreshToken,
} from '../infrastructure/refresh-token.crypto';

const AUTHENTICATION_FAILED = 'Authentication failed';

@Injectable()
export class AuthenticationService {
  constructor(
    @Inject(AUTHENTICATION_REPOSITORY)
    private readonly authenticationRepository: AuthenticationRepository,
    @Inject(GOOGLE_IDENTITY_VERIFIER)
    private readonly googleIdentityVerifier: GoogleIdentityVerifier,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async validateAccessTokenPayload(
    payload: AccessTokenPayload,
  ): Promise<AuthenticatedPrincipal> {
    const sub = typeof payload.sub === 'string' ? payload.sub.trim() : '';
    const organisationId =
      typeof payload.organisationId === 'string'
        ? payload.organisationId.trim()
        : '';
    const email = typeof payload.email === 'string' ? payload.email.trim() : '';

    if (!sub || !organisationId || !email) {
      throw new UnauthorizedException('Invalid access token payload');
    }

    const principal =
      await this.authenticationRepository.findActivePrincipalById(
        sub,
        organisationId,
      );

    if (!principal) {
      throw new UnauthorizedException('Invalid or inactive account');
    }

    if (principal.organisationId !== organisationId) {
      throw new UnauthorizedException('Organisation mismatch');
    }

    if (principal.email.toLowerCase() !== email.toLowerCase()) {
      throw new UnauthorizedException('Invalid access token payload');
    }

    return principal;
  }

  async loginWithGoogle(idToken: string): Promise<AuthSession> {
    let identity: GoogleVerifiedIdentity;
    try {
      identity = await this.googleIdentityVerifier.verifyIdToken(idToken);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw new UnauthorizedException(AUTHENTICATION_FAILED);
      }
      throw error;
    }

    const principal = await this.resolveLinkedPrincipal(identity);
    const session = await this.issueSession(principal);

    await this.auditService.record({
      action: AuditAction.LOGIN,
      resourceType: 'Session',
      resourceId: principal.id,
      actorId: principal.id,
      organisationId: principal.organisationId,
      metadata: {
        provider: 'GOOGLE_WORKSPACE',
        hostedDomain: identity.hostedDomain,
      },
    });

    return session;
  }

  async refreshSession(refreshToken: string): Promise<AuthSession> {
    const presented = this.requireRefreshToken(refreshToken);
    const presentedHash = this.hashPresentedRefreshToken(presented);
    const replacementRaw = generateOpaqueRefreshToken();
    const replacementHash = this.hashPresentedRefreshToken(replacementRaw);
    const refreshExpiresIn = this.configService.getOrThrow<string>(
      'jwt.refreshExpiresIn',
    );

    const rotation = await this.authenticationRepository.rotateRefreshToken({
      presentedTokenHash: presentedHash,
      replacementTokenHash: replacementHash,
      replacementExpiresAt: expiresAtFromDuration(refreshExpiresIn),
    });

    if (rotation.outcome === 'reuse_detected') {
      throw new UnauthorizedException(AUTHENTICATION_FAILED);
    }

    if (
      rotation.outcome === 'invalid' ||
      rotation.outcome === 'concurrent_conflict'
    ) {
      throw new UnauthorizedException(AUTHENTICATION_FAILED);
    }

    const principal =
      await this.authenticationRepository.findActivePrincipalById(
        rotation.userId,
        rotation.organisationId,
      );

    if (!principal) {
      await this.authenticationRepository.revokeRefreshTokenFamilyByHash(
        replacementHash,
      );
      throw new UnauthorizedException(AUTHENTICATION_FAILED);
    }

    const accessToken = await this.issueAccessToken(principal);
    const expiresIn = this.configService.getOrThrow<string>(
      'jwt.accessExpiresIn',
    );

    return {
      accessToken,
      refreshToken: replacementRaw,
      tokenType: 'Bearer',
      expiresIn,
      refreshExpiresIn,
      user: principal,
    };
  }

  async logout(refreshToken: string): Promise<{ success: true }> {
    const presented = this.requireRefreshToken(refreshToken);
    const tokenHash = this.hashPresentedRefreshToken(presented);

    await this.authenticationRepository.revokeRefreshTokenFamilyByHash(
      tokenHash,
    );

    await this.auditService.record({
      action: AuditAction.LOGOUT,
      resourceType: 'Session',
      metadata: {
        provider: 'REFRESH_TOKEN',
      },
    });

    return { success: true };
  }

  private async issueSession(
    principal: AuthenticatedPrincipal,
  ): Promise<AuthSession> {
    const accessToken = await this.issueAccessToken(principal);
    const rawRefreshToken = generateOpaqueRefreshToken();
    const refreshSecret =
      this.configService.getOrThrow<string>('jwt.refreshSecret');
    const refreshExpiresIn = this.configService.getOrThrow<string>(
      'jwt.refreshExpiresIn',
    );
    const expiresIn = this.configService.getOrThrow<string>(
      'jwt.accessExpiresIn',
    );

    await this.authenticationRepository.createRefreshToken({
      userId: principal.id,
      organisationId: principal.organisationId,
      tokenHash: hashRefreshToken(rawRefreshToken, refreshSecret),
      familyId: generateRefreshTokenFamilyId(),
      expiresAt: expiresAtFromDuration(refreshExpiresIn),
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      tokenType: 'Bearer',
      expiresIn,
      refreshExpiresIn,
      user: principal,
    };
  }

  private async resolveLinkedPrincipal(
    identity: GoogleVerifiedIdentity,
  ): Promise<AuthenticatedPrincipal> {
    const linked =
      await this.authenticationRepository.findActivePrincipalByGoogleSubject(
        identity.subject,
      );

    const principal =
      linked ??
      (await this.authenticationRepository.linkInvitedPrincipalByGoogleIdentity(
        {
          subject: identity.subject,
          email: identity.email,
          hostedDomain: identity.hostedDomain,
        },
      ));

    if (!principal) {
      throw new UnauthorizedException(AUTHENTICATION_FAILED);
    }

    const emailDomain = this.emailDomain(principal.email);
    if (!emailDomain || emailDomain !== identity.hostedDomain) {
      throw new UnauthorizedException(AUTHENTICATION_FAILED);
    }

    return principal;
  }

  private async issueAccessToken(
    principal: AuthenticatedPrincipal,
  ): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: principal.id,
      organisationId: principal.organisationId,
      email: principal.email,
    };

    return this.jwtService.signAsync(payload);
  }

  private requireRefreshToken(refreshToken: string): string {
    if (typeof refreshToken !== 'string' || refreshToken.trim().length === 0) {
      throw new UnauthorizedException(AUTHENTICATION_FAILED);
    }

    return refreshToken.trim();
  }

  private hashPresentedRefreshToken(rawToken: string): string {
    const refreshSecret =
      this.configService.getOrThrow<string>('jwt.refreshSecret');
    return hashRefreshToken(rawToken, refreshSecret);
  }

  private emailDomain(email: string): string | undefined {
    const at = email.lastIndexOf('@');
    if (at < 0 || at === email.length - 1) {
      return undefined;
    }

    return email.slice(at + 1).toLowerCase();
  }
}
