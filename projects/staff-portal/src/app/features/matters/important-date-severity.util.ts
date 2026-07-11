import { MatterImportantDate } from 'shared';

export type ImportantDateSeverity = 'normal' | 'watch' | 'warn' | 'critical';

/**
 * BR-2 escalation chain (PRD, verbatim): "owner (T-30), owner+manager (T-7),
 * owner+manager+Owner-role (T-1), all-red banner (T-0)." Used here purely to
 * drive the important-dates side panel's severity badge, not the actual
 * notification escalation (that's server-side).
 */
export function importantDateSeverity(date: MatterImportantDate): ImportantDateSeverity {
  if (date.satisfiedAt) {
    return 'normal';
  }
  const daysUntilDue = (new Date(date.dueAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (daysUntilDue <= 1) {
    return 'critical';
  }
  if (daysUntilDue <= 7) {
    return 'warn';
  }
  if (daysUntilDue <= 30) {
    return 'watch';
  }
  return 'normal';
}
