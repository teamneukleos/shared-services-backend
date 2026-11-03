import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { AuthenticatedUser } from '../../authorization/domain/authenticated-user.interface';
import { CurrentUser } from './current-user.decorator';

describe('CurrentUser decorator', () => {
  const user: AuthenticatedUser = {
    id: 'user-1',
    organisationId: 'org-1',
    email: 'user@example.com',
    employeeId: null,
    permissions: ['employee.read'],
  };

  const getParamDecoratorFactory = () => {
    class TestController {
      handler(
        @CurrentUser() full: AuthenticatedUser,
        @CurrentUser('id') id: string,
        @CurrentUser('organisationId') organisationId: string,
      ) {
        return { full, id, organisationId };
      }
    }

    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      TestController,
      'handler',
    ) as Record<
      string,
      { factory: (...args: unknown[]) => unknown; data?: unknown }
    >;

    return Object.values(metadata).map((item) => item);
  };

  const createContext = (requestUser?: AuthenticatedUser): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user: requestUser }),
      }),
    }) as ExecutionContext;

  it('returns the complete user', () => {
    const factories = getParamDecoratorFactory();
    const fullFactory = factories.find((item) => item.data === undefined);
    expect(fullFactory?.factory(undefined, createContext(user))).toEqual(user);
  });

  it('returns selected user properties', () => {
    const factories = getParamDecoratorFactory();
    const idFactory = factories.find((item) => item.data === 'id');
    const orgFactory = factories.find((item) => item.data === 'organisationId');

    expect(idFactory?.factory('id', createContext(user))).toBe('user-1');
    expect(orgFactory?.factory('organisationId', createContext(user))).toBe(
      'org-1',
    );
  });

  it('returns undefined when no user exists', () => {
    const factories = getParamDecoratorFactory();
    const fullFactory = factories.find((item) => item.data === undefined);
    const idFactory = factories.find((item) => item.data === 'id');

    expect(fullFactory?.factory(undefined, createContext())).toBeUndefined();
    expect(idFactory?.factory('id', createContext())).toBeUndefined();
  });
});
