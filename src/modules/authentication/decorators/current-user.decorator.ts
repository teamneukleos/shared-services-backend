import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../../authorization/domain/authenticated-user.interface';

type CurrentUserProperty = keyof AuthenticatedUser;

export const CurrentUser = createParamDecorator(
  (
    property: CurrentUserProperty | undefined,
    context: ExecutionContext,
  ): AuthenticatedUser | AuthenticatedUser[CurrentUserProperty] | undefined => {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      return undefined;
    }

    if (!property) {
      return user;
    }

    return user[property];
  },
);
