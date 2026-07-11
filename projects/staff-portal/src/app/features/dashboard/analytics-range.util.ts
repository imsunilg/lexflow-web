import { AnalyticsRange, AnalyticsRangePreset } from 'shared';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Validation rule per PRD Module 1: "date ranges ≤ 366 days." */
export const MAX_ANALYTICS_RANGE_DAYS = 366;

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfWeek(now: Date): Date {
  const date = new Date(now);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday-start week
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function startOfQuarter(now: Date): Date {
  const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
  return new Date(now.getFullYear(), quarterMonth, 1);
}

/** Computes the `{start, end}` ISO-date bounds for a preset, anchored on today. */
export function rangeForPreset(
  preset: 'week' | 'month' | 'quarter',
  now = new Date(),
): AnalyticsRange {
  const start =
    preset === 'week'
      ? startOfWeek(now)
      : preset === 'month'
        ? startOfMonth(now)
        : startOfQuarter(now);
  return { preset, start: toIsoDate(start), end: toIsoDate(now) };
}

export function customRange(start: Date, end: Date): AnalyticsRange {
  return { preset: 'custom', start: toIsoDate(start), end: toIsoDate(end) };
}

export function isRangeWithinLimit(range: AnalyticsRange): boolean {
  const days = (new Date(range.end).getTime() - new Date(range.start).getTime()) / MS_PER_DAY;
  return days >= 0 && days <= MAX_ANALYTICS_RANGE_DAYS;
}

export const RANGE_PRESET_LABELS: Record<AnalyticsRangePreset, string> = {
  week: 'This week',
  month: 'This month',
  quarter: 'This quarter',
  custom: 'Custom',
};
