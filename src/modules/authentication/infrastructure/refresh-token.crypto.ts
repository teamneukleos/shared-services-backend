import { createHmac, randomBytes, randomUUID } from 'node:crypto';

const DURATION_PATTERN = /^(\d+)([smhd])$/i;

const UNIT_TO_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

export function generateOpaqueRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function generateRefreshTokenFamilyId(): string {
  return randomUUID();
}

export function hashRefreshToken(rawToken: string, secret: string): string {
  return createHmac('sha256', secret).update(rawToken, 'utf8').digest('hex');
}

export function parseExpiresInToMs(expiresIn: string): number {
  const trimmed = expiresIn.trim();
  const match = DURATION_PATTERN.exec(trimmed);
  if (!match) {
    throw new Error(`Unsupported duration format: ${expiresIn}`);
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multiplier = UNIT_TO_MS[unit];
  if (!multiplier || !Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Unsupported duration format: ${expiresIn}`);
  }

  return amount * multiplier;
}

export function expiresAtFromDuration(
  expiresIn: string,
  from: Date = new Date(),
): Date {
  return new Date(from.getTime() + parseExpiresInToMs(expiresIn));
}
