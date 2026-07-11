import { RecurrenceRule, RruleWeekday, RRULE_WEEKDAYS } from 'shared';

/** Builds an RFC5545 RRULE string from the builder-UI's structured shape. */
export function buildRrule(rule: RecurrenceRule): string {
  const parts = [`FREQ=${rule.freq}`];
  if (rule.interval > 1) {
    parts.push(`INTERVAL=${rule.interval}`);
  }
  if (rule.freq === 'WEEKLY' && rule.byDay.length > 0) {
    parts.push(`BYDAY=${rule.byDay.join(',')}`);
  }
  if (rule.count) {
    parts.push(`COUNT=${rule.count}`);
  } else if (rule.until) {
    parts.push(`UNTIL=${rule.until.replace(/[-:]/g, '').slice(0, 8)}T000000Z`);
  }
  return parts.join(';');
}

/** Parses an RRULE string back into the builder-UI's structured shape, defaulting unknown/missing parts. */
export function parseRrule(rrule: string): RecurrenceRule {
  const fields = new Map<string, string>();
  for (const segment of rrule.split(';')) {
    const [key, value] = segment.split('=');
    if (key && value) {
      fields.set(key, value);
    }
  }
  const byDay = (fields.get('BYDAY')?.split(',') ?? []).filter((d): d is RruleWeekday =>
    (RRULE_WEEKDAYS as readonly string[]).includes(d),
  );
  const until = fields.get('UNTIL');
  return {
    freq: (fields.get('FREQ') as RecurrenceRule['freq']) ?? 'WEEKLY',
    interval: Number(fields.get('INTERVAL') ?? '1'),
    byDay,
    until: until ? `${until.slice(0, 4)}-${until.slice(4, 6)}-${until.slice(6, 8)}` : null,
    count: fields.get('COUNT') ? Number(fields.get('COUNT')) : null,
  };
}

const WEEKDAY_INDEX: Record<RruleWeekday, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

/**
 * Expands an RRULE into concrete occurrence start times within [rangeFrom, rangeTo),
 * clipped to a 24-month materialization horizon (PRD: "recurrence horizon materialized
 * 24 months rolling"). Stepping is done via local-time Date component mutation
 * (setDate/setMonth/setFullYear) rather than millisecond arithmetic, so occurrences
 * keep the same wall-clock time across a DST transition in the browser's local TZ —
 * there is no per-event timezone field in the backend DTO to expand against instead.
 */
export function expandOccurrences(
  startsAt: string,
  rrule: string | null,
  rangeFrom: Date,
  rangeTo: Date,
  exceptionDates: string[] = [],
): Date[] {
  const start = new Date(startsAt);
  if (!rrule) {
    return start >= rangeFrom && start < rangeTo ? [start] : [];
  }

  const rule = parseRrule(rrule);
  const horizon = new Date(start);
  horizon.setMonth(horizon.getMonth() + 24);
  const until = rule.until ? new Date(rule.until) : null;
  const excluded = new Set(exceptionDates.map((d) => d.slice(0, 10)));

  const occurrences: Date[] = [];
  let cursor = new Date(start);
  let count = 0;
  const maxIterations = 5000;
  let iterations = 0;

  while (cursor < rangeTo && cursor <= horizon && iterations < maxIterations) {
    iterations++;
    if (until && cursor > until) break;
    if (rule.count && count >= rule.count) break;

    const matchesByDay =
      rule.freq !== 'WEEKLY' ||
      rule.byDay.length === 0 ||
      rule.byDay.some((day) => WEEKDAY_INDEX[day] === cursor.getDay());

    if (matchesByDay) {
      count++;
      if (
        cursor >= rangeFrom &&
        cursor < rangeTo &&
        !excluded.has(cursor.toISOString().slice(0, 10))
      ) {
        occurrences.push(new Date(cursor));
      }
    }

    cursor = stepOnce(cursor, rule, matchesByDay);
  }

  return occurrences;
}

/**
 * Simplification: WEEKLY+BYDAY steps one day at a time regardless of `interval`
 * (i.e. INTERVAL is only honored for plain WEEKLY without BYDAY) — the PRD's
 * RRULE requirements list interval/byday/until/count independently and don't
 * specify their combined semantics, so the simpler, more common case (every
 * week on the given days) is what's implemented here.
 */
function stepOnce(date: Date, rule: RecurrenceRule, wasWeeklyByDayMatch: boolean): Date {
  const next = new Date(date);
  switch (rule.freq) {
    case 'DAILY':
      next.setDate(next.getDate() + rule.interval);
      return next;
    case 'WEEKLY':
      if (rule.byDay.length > 0) {
        next.setDate(next.getDate() + 1);
        return next;
      }
      next.setDate(next.getDate() + 7 * rule.interval);
      return next;
    case 'MONTHLY':
      next.setMonth(next.getMonth() + rule.interval);
      return next;
    case 'YEARLY':
      next.setFullYear(next.getFullYear() + rule.interval);
      return next;
    default:
      void wasWeeklyByDayMatch;
      next.setDate(next.getDate() + 1);
      return next;
  }
}
