import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { IS_PUBLIC_KEY } from '../../authorization/authorization.constants';
import { Public } from '../../authorization/decorators/public.decorator';
import { AuthenticatedUser } from '../../authorization/domain/authenticated-user.interface';
import { JwtAuthGuard } from './jwt-auth.guard';

function getRouteHandler(
  controllerClass: new () => unknown,
  methodName: string,
) {
  const handler = Object.getOwnPropertyDescriptor(
    controllerClass.prototype,
    methodName,
  )?.value;

  if (typeof handler !== 'function') {
    throw new Error(
      `Missing route handler: ${controllerClass.name}.${methodName}`,
    );
  }

  return handler as object;
}

describe('JwtAuthGuard', () => {
  const reflector = new Reflector();
  const setUserContext = jest.fn();
  const requestContextService = {
    setUserContext,
  } as unknown as RequestContextService;

  let guard: JwtAuthGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new JwtAuthGuard(reflector, requestContextService);
  });

  const createContext = (
    handler: object,
    controllerClass: object,
    request: { user?: AuthenticatedUser } = {},
  ): ExecutionContext =>
    ({
      getHandler: () => handler,
      getClass: () => controllerClass,
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as ExecutionContext;

  it('bypasses authentication for public routes', () => {
    class PublicController {
      @Public()
      route() {
        return true;
      }
    }

    const context = createContext(
      getRouteHandler(PublicController, 'route'),
      PublicController,
    );

    expect(guard.canActivate(context)).toBe(true);
    expect(
      Reflect.getMetadata(
        IS_PUBLIC_KEY,
        getRouteHandler(PublicController, 'route'),
      ),
    ).toBe(true);
  });

  it('assigns authenticated user to the request and updates request context', () => {
    class ProtectedController {
      route() {
        return true;
      }
    }

    const request: { user?: AuthenticatedUser } = {};
    const context = createContext(
      getRouteHandler(ProtectedController, 'route'),
      ProtectedController,
      request,
    );
    const user: AuthenticatedUser = {
      id: 'user-1',
      organisationId: 'org-1',
      email: 'user@example.com',
      employeeId: null,
      permissions: ['employee.read'],
    };

    const result = guard.handleRequest(null, user, undefined, context);

    expect(result).toEqual(user);
    expect(request.user).toEqual(user);
    expect(setUserContext).toHaveBeenCalledWith('user-1', 'org-1');
  });

  it('throws UnauthorizedException when no authenticated user is present', () => {
    class ProtectedController {
      route() {
        return true;
      }
    }

    const context = createContext(
      getRouteHandler(ProtectedController, 'route'),
      ProtectedController,
    );

    expect(() => guard.handleRequest(null, false, undefined, context)).toThrow(
      UnauthorizedException,
    );
    expect(setUserContext).not.toHaveBeenCalled();
  });

  it('maps Passport errors to UnauthorizedException without leaking details outside development', () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    class ProtectedController {
      route() {
        return true;
      }
    }

    const context = createContext(
      getRouteHandler(ProtectedController, 'route'),
      ProtectedController,
    );

    try {
      expect(() =>
        guard.handleRequest(
          new Error('jwt expired'),
          false,
          undefined,
          context,
        ),
      ).toThrow(UnauthorizedException);

      try {
        guard.handleRequest(
          new Error('jwt expired'),
          false,
          undefined,
          context,
        );
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect((error as UnauthorizedException).message).toBe(
          'Authentication is required',
        );
        expect((error as UnauthorizedException).message).not.toContain('jwt');
      }
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it('includes passport failure details in development', () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    class ProtectedController {
      route() {
        return true;
      }
    }

    const context = createContext(
      getRouteHandler(ProtectedController, 'route'),
      ProtectedController,
    );

    try {
      expect(() =>
        guard.handleRequest(
          new Error('jwt expired'),
          false,
          undefined,
          context,
        ),
      ).toThrow(/Authentication is required \(jwt expired\)/);
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });
});
