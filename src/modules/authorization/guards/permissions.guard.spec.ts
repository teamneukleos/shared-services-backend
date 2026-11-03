import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY } from '../authorization.constants';
import { Permissions } from '../decorators/permissions.decorator';
import { Public } from '../decorators/public.decorator';
import { AuthenticatedUser } from '../domain/authenticated-user.interface';
import { PermissionsGuard } from './permissions.guard';

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

describe('PermissionsGuard', () => {
  const reflector = new Reflector();
  const guard = new PermissionsGuard(reflector);

  const createUser = (permissions: string[] = []): AuthenticatedUser => ({
    id: 'user-1',
    organisationId: 'org-1',
    email: 'user@example.com',
    employeeId: null,
    permissions,
  });

  const createContext = (
    handler: object,
    controllerClass: object,
    user?: AuthenticatedUser,
  ): ExecutionContext =>
    ({
      getHandler: () => handler,
      getClass: () => controllerClass,
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as ExecutionContext;

  it('allows a public route with no user', () => {
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
  });

  it('allows a route with no permissions', () => {
    class OpenController {
      route() {
        return true;
      }
    }

    const context = createContext(
      getRouteHandler(OpenController, 'route'),
      OpenController,
      undefined,
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws UnauthorizedException when permissions are required and no user exists', () => {
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

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('allows a user with all required permissions', () => {
    class ProtectedController {
      @Permissions('employee.read', 'employee.update')
      route() {
        return true;
      }
    }

    const context = createContext(
      getRouteHandler(ProtectedController, 'route'),
      ProtectedController,
      createUser(['employee.read', 'employee.update', 'audit.read']),
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws ForbiddenException when the user is missing one permission', () => {
    class ProtectedController {
      @Permissions('employee.read', 'employee.update')
      route() {
        return true;
      }
    }

    const context = createContext(
      getRouteHandler(ProtectedController, 'route'),
      ProtectedController,
      createUser(['employee.read']),
    );

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('matches permissions exactly', () => {
    class ProtectedController {
      @Permissions('employee.read')
      route() {
        return true;
      }
    }

    const context = createContext(
      getRouteHandler(ProtectedController, 'route'),
      ProtectedController,
      createUser(['employee.read.all', 'employee']),
    );

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('ignores duplicate required permissions when evaluating access', () => {
    class ProtectedController {
      @Permissions('employee.read', 'employee.read', 'employee.update')
      route() {
        return true;
      }
    }

    const context = createContext(
      getRouteHandler(ProtectedController, 'route'),
      ProtectedController,
      createUser(['employee.read', 'employee.update']),
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  it('enforces controller-level permissions', () => {
    @Permissions('employee.read')
    class ControllerProtected {
      route() {
        return true;
      }
    }

    const context = createContext(
      getRouteHandler(ControllerProtected, 'route'),
      ControllerProtected,
      createUser([]),
    );

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('enforces method-level permissions', () => {
    class MethodProtected {
      @Permissions('leave.approve')
      route() {
        return true;
      }
    }

    const context = createContext(
      getRouteHandler(MethodProtected, 'route'),
      MethodProtected,
      createUser(['leave.submit']),
    );

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('combines controller and method permissions', () => {
    @Permissions('employee.read')
    class CombinedController {
      @Permissions('employee.update')
      route() {
        return true;
      }
    }

    const missingUpdate = createContext(
      getRouteHandler(CombinedController, 'route'),
      CombinedController,
      createUser(['employee.read']),
    );
    expect(() => guard.canActivate(missingUpdate)).toThrow(ForbiddenException);

    const allowed = createContext(
      getRouteHandler(CombinedController, 'route'),
      CombinedController,
      createUser(['employee.read', 'employee.update']),
    );
    expect(guard.canActivate(allowed)).toBe(true);
  });

  it('fails when the user has an empty permissions list', () => {
    class ProtectedController {
      @Permissions('audit.read')
      route() {
        return true;
      }
    }

    const context = createContext(
      getRouteHandler(ProtectedController, 'route'),
      ProtectedController,
      createUser([]),
    );

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows a public method to override a protected controller', () => {
    @Permissions('employee.read')
    class MixedController {
      @Public()
      route() {
        return true;
      }
    }

    const context = createContext(
      getRouteHandler(MixedController, 'route'),
      MixedController,
    );

    expect(guard.canActivate(context)).toBe(true);
  });
});

describe('authorization decorators', () => {
  it('sets @Public() metadata correctly', () => {
    class Demo {
      @Public()
      route() {
        return true;
      }
    }

    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, getRouteHandler(Demo, 'route')),
    ).toBe(true);
  });

  it('rejects empty permission strings', () => {
    expect(() => Permissions('employee.read', '   ')).toThrow(
      'Permission must not be empty',
    );
  });

  it('removes duplicate permission values', () => {
    class Demo {
      @Permissions('employee.read', ' employee.read ', 'employee.update')
      route() {
        return true;
      }
    }

    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, getRouteHandler(Demo, 'route')),
    ).toEqual(['employee.read', 'employee.update']);
  });
});
