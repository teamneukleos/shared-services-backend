import { UnauthorizedException } from '@nestjs/common';
import { AuthenticationService } from './application/authentication.service';
import { AuthenticationController } from './authentication.controller';

describe('AuthenticationController', () => {
  const loginWithGoogle = jest.fn();
  const refreshSession = jest.fn();
  const logout = jest.fn();
  const authenticationService = {
    loginWithGoogle,
    refreshSession,
    logout,
  } as unknown as AuthenticationService;

  let controller: AuthenticationController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AuthenticationController(authenticationService);
  });

  it('delegates Google login to the authentication service', async () => {
    const session = {
      accessToken: 'token',
      refreshToken: 'refresh',
      tokenType: 'Bearer' as const,
      expiresIn: '15m',
      refreshExpiresIn: '7d',
      user: {
        id: 'user-1',
        organisationId: 'org-1',
        email: 'alice@neukleos.com',
        employeeId: null,
        permissions: [],
      },
    };
    loginWithGoogle.mockResolvedValue(session);

    await expect(
      controller.loginWithGoogle({ idToken: 'google-id-token' }),
    ).resolves.toEqual(session);
    expect(loginWithGoogle).toHaveBeenCalledWith('google-id-token');
  });

  it('delegates refresh to the authentication service', async () => {
    const session = {
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      tokenType: 'Bearer' as const,
      expiresIn: '15m',
      refreshExpiresIn: '7d',
      user: {
        id: 'user-1',
        organisationId: 'org-1',
        email: 'alice@neukleos.com',
        employeeId: null,
        permissions: [],
      },
    };
    refreshSession.mockResolvedValue(session);

    await expect(
      controller.refresh({ refreshToken: 'old-refresh' }),
    ).resolves.toEqual(session);
    expect(refreshSession).toHaveBeenCalledWith('old-refresh');
  });

  it('delegates logout to the authentication service', async () => {
    logout.mockResolvedValue({ success: true });

    await expect(
      controller.logout({ refreshToken: 'refresh-to-revoke' }),
    ).resolves.toEqual({ success: true });
    expect(logout).toHaveBeenCalledWith('refresh-to-revoke');
  });

  it('returns the current authenticated user', () => {
    expect(
      controller.me({
        id: 'user-1',
        organisationId: 'org-1',
        email: 'alice@neukleos.com',
        employeeId: null,
        permissions: ['employee.read'],
      }),
    ).toEqual({
      id: 'user-1',
      organisationId: 'org-1',
      email: 'alice@neukleos.com',
      employeeId: null,
      permissions: ['employee.read'],
    });
  });

  it('requires authentication for me', () => {
    expect(() => controller.me(undefined)).toThrow(UnauthorizedException);
  });
});
