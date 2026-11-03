import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { IS_PUBLIC_KEY } from '../../authorization/authorization.constants';
import { AuthenticatedUser } from '../../authorization/domain/authenticated-user.interface';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly requestContextService: RequestContextService,
  ) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = AuthenticatedUser>(
    err: unknown,
    user: TUser | false,
    info: unknown,
    context: ExecutionContext,
  ): TUser {
    if (err || !user) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }

      const request = context.switchToHttp().getRequest<{
        headers?: { authorization?: string };
      }>();
      const authorizationHeader = request.headers?.authorization;
      const passportMessage = this.describePassportFailure(info, err);

      if (process.env.NODE_ENV === 'development') {
        throw new UnauthorizedException(
          [
            'Authentication is required',
            passportMessage ? `(${passportMessage})` : undefined,
            authorizationHeader
              ? undefined
              : '(Authorization header missing)',
          ]
            .filter(Boolean)
            .join(' '),
        );
      }

      throw new UnauthorizedException('Authentication is required');
    }

    const authenticatedUser = user as unknown as AuthenticatedUser;
    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    request.user = authenticatedUser;
    this.requestContextService.setUserContext(
      authenticatedUser.id,
      authenticatedUser.organisationId,
    );

    return user;
  }

  private describePassportFailure(info: unknown, err: unknown): string | undefined {
    if (typeof info === 'string' && info.trim().length > 0) {
      return info.trim();
    }

    if (info instanceof Error && info.message.trim().length > 0) {
      return info.message.trim();
    }

    if (
      info &&
      typeof info === 'object' &&
      'message' in info &&
      typeof (info as { message: unknown }).message === 'string' &&
      (info as { message: string }).message.trim().length > 0
    ) {
      return (info as { message: string }).message.trim();
    }

    if (err instanceof Error && err.message.trim().length > 0) {
      return err.message.trim();
    }

    return undefined;
  }
}
