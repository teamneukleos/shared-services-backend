/**
 * Leave duration for this slice is inclusive calendar days.
 * Weekends and public holidays are included — no holiday-calendar
 * adjustment is applied until a later policy-aware implementation.
 */
export function calculateLeaveDurationDays(
  startDate: Date,
  endDate: Date,
): number {
  const start = Date.UTC(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth(),
    startDate.getUTCDate(),
  );
  const end = Date.UTC(
    endDate.getUTCFullYear(),
    endDate.getUTCMonth(),
    endDate.getUTCDate(),
  );

  if (end < start) {
    throw new Error('endDate must be on or after startDate');
  }

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.floor((end - start) / MS_PER_DAY) + 1;
}
