import { calculateLeaveDurationDays } from './leave-duration';

describe('calculateLeaveDurationDays', () => {
  it('counts inclusive calendar days including weekends', () => {
    expect(
      calculateLeaveDurationDays(
        new Date('2026-01-01T00:00:00.000Z'),
        new Date('2026-01-01T00:00:00.000Z'),
      ),
    ).toBe(1);

    // Thursday–Monday includes Sat/Sun
    expect(
      calculateLeaveDurationDays(
        new Date('2026-01-01T00:00:00.000Z'),
        new Date('2026-01-05T00:00:00.000Z'),
      ),
    ).toBe(5);
  });

  it('rejects inverted ranges', () => {
    expect(() =>
      calculateLeaveDurationDays(
        new Date('2026-01-05T00:00:00.000Z'),
        new Date('2026-01-01T00:00:00.000Z'),
      ),
    ).toThrow(/endDate must be on or after startDate/);
  });
});
