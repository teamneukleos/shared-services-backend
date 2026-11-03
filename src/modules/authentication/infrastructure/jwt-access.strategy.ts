import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../../authorization/domain/authenticated-user.interface';
import { AuthenticationService } from '../application/authentication.service';
import { AccessTokenPayload } from '../domain/access-token-payload.interface';

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly authenticationService: AuthenticationService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwt.accessSecret'),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const principal =
      await this.authenticationService.validateAccessTokenPayload(payload);

    return {
      id: principal.id,
      organisationId: principal.organisationId,
      email: principal.email,
      employeeId: principal.employeeId,
      permissions: principal.permissions,
    };
  }
}
