/**
 * Duration & maturity (RB-003/004/005):
 * - value + unit configurable per plan
 * - per-investment countdown from server activation time
 * - UTC storage; hours/days/weeks = elapsed arithmetic; months/years = calendar
 *   arithmetic with end-of-month clamping (Jan 31 + 1mo → Feb 28/29)
 */

export const DURATION_UNITS = ["HOURS", "DAYS", "WEEKS", "MONTHS", "YEARS"] as const;
export type DurationUnit = (typeof DURATION_UNITS)[number];

export interface DurationSpec {
  value: number;
  unit: DurationUnit;
}

export function assertDuration(spec: DurationSpec): void {
  if (!Number.isInteger(spec.value) || spec.value <= 0) {
    throw new Error(`invalid duration value: ${spec.value}`);
  }
  if (!(DURATION_UNITS as readonly string[]).includes(spec.unit)) {
    throw new Error(`invalid duration unit: ${spec.unit}`);
  }
}

const MS = { HOUR: 3_600_000, DAY: 86_400_000, WEEK: 604_800_000 };

/** days in a given UTC month (month is 0-indexed). */
function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function addUtcMonths(from: Date, months: number): Date {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  const targetMonthIndex = m + months;
  const targetYear = y + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  // end-of-month clamp: Jan 31 + 1mo → Feb 28/29
  const day = Math.min(from.getUTCDate(), daysInUtcMonth(targetYear, targetMonth));
  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      day,
      from.getUTCHours(),
      from.getUTCMinutes(),
      from.getUTCSeconds(),
      from.getUTCMilliseconds(),
    ),
  );
}

/** Add a configured duration to a UTC instant. */
export function addDuration(from: Date, spec: DurationSpec): Date {
  assertDuration(spec);
  switch (spec.unit) {
    case "HOURS":
      return new Date(from.getTime() + spec.value * MS.HOUR);
    case "DAYS":
      return new Date(from.getTime() + spec.value * MS.DAY);
    case "WEEKS":
      return new Date(from.getTime() + spec.value * MS.WEEK);
    case "MONTHS":
      return addUtcMonths(from, spec.value);
    case "YEARS":
      return addUtcMonths(from, spec.value * 12);
  }
}

/** Convenience: compute matures_at from activation time. */
export function computeMaturesAt(activatedAt: Date, spec: DurationSpec): Date {
  return addDuration(activatedAt, spec);
}
