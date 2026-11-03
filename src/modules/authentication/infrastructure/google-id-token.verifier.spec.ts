import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { GoogleIdTokenVerifier } from './google-id-token.verifier';

describe('GoogleIdTokenVerifier', () => {
  const clientId = 'neukleos-google-client.apps.googleusercontent.com';
  const allowedDomains = ['neukleos.com', 'imageandtime.com', 'kucheza.com'];

  const getOrThrow = jest.fn((key: string) => {
    if (key === 'google.clientId') {
      return clientId;
    }
    if (key === 'google.allowedDomains') {
      return allowedDomains;
    }
    throw new Error(`Unexpected config key: ${key}`);
  });

  const configService = {
    getOrThrow,
  } as unknown as ConfigService;

  const verifyIdToken = jest.fn();
  const oauthClient = {
    verifyIdToken,
  } as unknown as OAuth2Client;

  let verifier: GoogleIdTokenVerifier;

  const basePayload = (
    overrides: Partial<TokenPayload> = {},
  ): TokenPayload => ({
    iss: 'https://accounts.google.com',
    aud: clientId,
    sub: 'google-subject-123',
    email: 'user@neukleos.com',
    email_verified: true,
    hd: 'neukleos.com',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    ...overrides,
  });

  const mockTicket = (payload: TokenPayload | undefined) => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => payload,
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    verifier = new GoogleIdTokenVerifier(configService, oauthClient);
  });

  it.each([
    ['neukleos.com', 'alice@neukleos.com', 'sub-neukleos'],
    ['imageandtime.com', 'bob@imageandtime.com', 'sub-imageandtime'],
    ['kucheza.com', 'cara@kucheza.com', 'sub-kucheza'],
  ])(
    'accepts a valid Google Workspace identity for %s',
    async (domain, email, subject) => {
      mockTicket(
        basePayload({
          hd: domain,
          email,
          sub: subject,
        }),
      );

      await expect(
        verifier.verifyIdToken('valid-google-id-token'),
      ).resolves.toEqual({
        subject,
        email,
        hostedDomain: domain,
        emailVerified: true,
      });

      expect(verifyIdToken).toHaveBeenCalledWith({
        idToken: 'valid-google-id-token',
        audience: clientId,
      });
    },
  );

  it('rejects an empty token', async () => {
    await expect(verifier.verifyIdToken('   ')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('rejects invalid signatures from Google verification failure', async () => {
    verifyIdToken.mockRejectedValue(new Error('Invalid token signature'));

    await expect(verifier.verifyIdToken('bad-signature-token')).rejects.toThrow(
      'Invalid Google identity token',
    );
  });

  it('rejects an invalid audience', async () => {
    mockTicket(
      basePayload({ aud: 'other-client-id.apps.googleusercontent.com' }),
    );

    await expect(verifier.verifyIdToken('token')).rejects.toThrow(
      'Invalid Google identity token audience',
    );
  });

  it('rejects an invalid issuer', async () => {
    mockTicket(basePayload({ iss: 'https://evil.example.com' }));

    await expect(verifier.verifyIdToken('token')).rejects.toThrow(
      'Invalid Google identity token issuer',
    );
  });

  it('rejects an expired token', async () => {
    mockTicket(
      basePayload({
        exp: Math.floor(Date.now() / 1000) - 60,
      }),
    );

    await expect(verifier.verifyIdToken('token')).rejects.toThrow(
      'Google identity token has expired',
    );
  });

  it('rejects an unverified email', async () => {
    mockTicket(basePayload({ email_verified: false }));

    await expect(verifier.verifyIdToken('token')).rejects.toThrow(
      'Google email is not verified',
    );
  });

  it('rejects a missing hosted-domain claim', async () => {
    mockTicket(basePayload({ hd: undefined }));

    await expect(verifier.verifyIdToken('token')).rejects.toThrow(
      'Google hosted-domain claim is required',
    );
  });

  it('rejects a mismatched hosted-domain claim and email domain', async () => {
    mockTicket(
      basePayload({
        hd: 'neukleos.com',
        email: 'user@imageandtime.com',
      }),
    );

    await expect(verifier.verifyIdToken('token')).rejects.toThrow(
      'Google identity email domain does not match hosted domain',
    );
  });

  it('rejects an unapproved hosted domain', async () => {
    mockTicket(
      basePayload({
        hd: 'gmail.com',
        email: 'user@gmail.com',
      }),
    );

    await expect(verifier.verifyIdToken('token')).rejects.toThrow(
      'Google Workspace domain is not allowed',
    );
  });

  it('never returns the raw ID token', async () => {
    mockTicket(basePayload());

    const identity = await verifier.verifyIdToken('raw-secret-id-token');

    expect(identity).not.toHaveProperty('idToken');
    expect(JSON.stringify(identity)).not.toContain('raw-secret-id-token');
  });
});
