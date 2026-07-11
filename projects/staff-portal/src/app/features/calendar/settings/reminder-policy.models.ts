import { ReminderChannel } from 'shared';

/** Matches `CalendarItemKind`'s non-native kinds plus native ones — every type-kind the PRD's reminder-policy editor covers (Module 6 User Flow §4). */
export const REMINDER_POLICY_KINDS = [
  'Hearing',
  'Task',
  'Deadline',
  'Meeting',
  'Personal',
] as const;
export type ReminderPolicyKind = (typeof REMINDER_POLICY_KINDS)[number];

/**
 * One reminder rule within a type's policy. `offsetDays` counts days before
 * the event; `fixedTime` (HH:mm), when set, fires at that local time on the
 * offset day regardless of the event's own start time — this is how the
 * PRD's "same-day 07:00 court-local" hearing default is represented
 * (`offsetDays: 0, fixedTime: '07:00'`). When `fixedTime` is null the
 * reminder fires `offsetDays` before the event at the event's own time.
 */
export interface ReminderRule {
  id: string;
  offsetDays: number;
  fixedTime: string | null;
  channels: ReminderChannel[];
}

export type ReminderPolicy = Record<ReminderPolicyKind, ReminderRule[]>;
