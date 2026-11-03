import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResendMailService } from './resend-mail.service';

const send = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send },
  })),
}));

describe('ResendMailService', () => {
  const get = jest.fn();
  const getOrThrow = jest.fn();
  const configService = {
    get,
    getOrThrow,
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    getOrThrow.mockImplementation((key: string) => {
      if (key === 'email.from') {
        return 'Neukleos <onboarding@resend.dev>';
      }
      throw new Error(`Unexpected config key: ${key}`);
    });
  });

  it('skips sending when RESEND_API_KEY is not configured', async () => {
    get.mockReturnValue(undefined);
    const service = new ResendMailService(configService);

    await expect(
      service.sendUserInviteEmail({
        to: 'ada@neukleos.com',
        signInUrl: 'http://localhost:3001/sign-in',
      }),
    ).resolves.toEqual({
      status: 'skipped',
      reason: 'RESEND_API_KEY is not configured',
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('sends an invite email through Resend', async () => {
    get.mockReturnValue('re_test_key');
    send.mockResolvedValue({ data: { id: 'msg-1' }, error: null });
    const service = new ResendMailService(configService);

    await expect(
      service.sendUserInviteEmail({
        to: 'Ada@Neukleos.com',
        signInUrl: 'http://localhost:3001/sign-in',
        invitedByEmail: 'admin@neukleos.com',
      }),
    ).resolves.toEqual({ status: 'sent', id: 'msg-1' });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Neukleos <onboarding@resend.dev>',
        to: ['ada@neukleos.com'],
        subject: "You're invited to Neukleos People",
      }),
    );
  });

  it('maps Resend errors to BadGatewayException', async () => {
    get.mockReturnValue('re_test_key');
    send.mockResolvedValue({
      data: null,
      error: { message: 'invalid api key', name: 'validation_error' },
    });
    const service = new ResendMailService(configService);

    await expect(
      service.sendUserInviteEmail({
        to: 'ada@neukleos.com',
        signInUrl: 'http://localhost:3001/sign-in',
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
