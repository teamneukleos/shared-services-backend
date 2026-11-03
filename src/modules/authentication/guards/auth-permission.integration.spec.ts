import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { Permissions } from '../../authorization/decorators/permissions.decorator';
import { Public } from '../../authorization/decorators/public.decorator';
import { AuthenticatedUser } from '../../authorization/domain/authenticated-user.interface';
import { PermissionsGuard } from '../../authorization/guards/permissions.guard';
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

describe('JWT + permissions guard integration', () => {
  const reflector = new Reflector();
  const setUserContext = jest.fn();
  const requestContextService = {
    setUserContext,
  } as unknown as RequestContextService;

  const jwtGuard = new JwtAuthGuard(reflector, requestContextService);
  const permissionsGuard = new PermissionsGuard(reflector);

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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows a public route without authentication', () => {
    class PublicController {
      @Public()
      @Permissions('employee.read')
      route() {
        return true;
      }
    }

    const context = createContext(
      getRouteHandler(PublicController, 'route'),
      PublicController,
    );

    expect(jwtGuard.canActivate(context)).toBe(true);
    expect(permissionsGuard.canActivate(context)).toBe(true);
  });

  it('rejects an unauthenticated protected route', () => {
    class ProtectedController {
      @Permissions('employee.read')
      route() {
        return true;
      }
    }

    const context = createContext(
      getRouteHandler(ProtectedController, 'route'),
      ProtectedController,
    );

    expect(() =>
      jwtGuard.handleRequest(null, false, undefined, context),
    ).toThrow(UnauthorizedException);
  });

  it('allows a valid user with required permissions', () => {
    class ProtectedController {
      @Permissions('employee.read')
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

    jwtGuard.handleRequest(null, user, undefined, context);
    expect(permissionsGuard.canActivate(context)).toBe(true);
  });

  it('forbids a valid user missing a required permission', () => {
    class ProtectedController {
      @Permissions('employee.update')
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

    jwtGuard.handleRequest(null, user, undefined, context);
    expect(() => permissionsGuard.canActivate(context)).toThrow(
      ForbiddenException,
    );
  });
});
