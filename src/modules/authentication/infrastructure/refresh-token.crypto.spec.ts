import {
  expiresAtFromDuration,
  generateOpaqueRefreshToken,
  hashRefreshToken,
  parseExpiresInToMs,
} from './refresh-token.crypto';

describe('refresh-token.crypto', () => {
  it('generates high-entropy opaque tokens', () => {
    const first = generateOpaqueRefreshToken();
    const second = generateOpaqueRefreshToken();

    expect(first).not.toEqual(second);
    expect(first.length).toBeGreaterThanOrEqual(40);
    expect(second.length).toBeGreaterThanOrEqual(40);
  });

  it('hashes refresh tokens with HMAC-SHA-256', () => {
    const secret = 'test-refresh-secret-at-least-32-characters';
    const hash = hashRefreshToken('opaque-refresh-token', secret);

    expect(hash).toHaveLength(64);
    expect(hash).toEqual(hashRefreshToken('opaque-refresh-token', secret));
    expect(hash).not.toEqual(
      hashRefreshToken('opaque-refresh-token', 'other-secret'),
    );
    expect(hash).not.toContain('opaque-refresh-token');
  });

  it('parses configured refresh durations', () => {
    expect(parseExpiresInToMs('7d')).toBe(7 * 24 * 60 * 60 * 1000);
    expect(parseExpiresInToMs('15m')).toBe(15 * 60 * 1000);

    const from = new Date('2026-01-01T00:00:00.000Z');
    expect(expiresAtFromDuration('1h', from).toISOString()).toBe(
      '2026-01-01T01:00:00.000Z',
    );
  });
});
