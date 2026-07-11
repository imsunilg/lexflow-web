/** PRD Module 6 — Calendar. Native event kinds (creatable in-app); Hearing/Task/Deadline are read-linked projections from other modules. */
export const CALENDAR_EVENT_KINDS = ['Meeting', 'Personal'] as const;
export type CalendarEventKind = (typeof CALENDAR_EVENT_KINDS)[number];

/** `CalendarItemDto.itemKind` — union of native kinds plus the projected item kinds from `v_calendar_items`. */
export const CALENDAR_ITEM_KINDS = ['Meeting', 'Personal', 'Hearing', 'Task', 'Deadline'] as const;
export type CalendarItemKind = (typeof CALENDAR_ITEM_KINDS)[number];

export const CALENDAR_VIEW_MODES = ['day', 'week', 'month', 'agenda'] as const;
export type CalendarViewMode = (typeof CALENDAR_VIEW_MODES)[number];

/**
 * `scope` (My/Team/Firm) is a PRD-described filter (§ User Flow 1) gated by
 * `calendar.read.team|all`, but the backend `GET /calendar` endpoint only
 * accepts `from`/`to`/`types` — no `scope` query param exists yet
 * (confirmed against `CalendarController.cs`). It's sent anyway (harmless if
 * ignored) and the permission gate is still enforced client-side on the UI
 * toggle itself.
 */
export const CALENDAR_SCOPES = ['Me', 'Team', 'Firm'] as const;
export type CalendarScope = (typeof CALENDAR_SCOPES)[number];

export const REMINDER_CHANNELS = ['Email', 'SMS', 'WhatsApp', 'Push', 'InApp'] as const;
export type ReminderChannel = (typeof REMINDER_CHANNELS)[number];

export const RRULE_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const;
export type RruleFrequency = (typeof RRULE_FREQUENCIES)[number];

export const RRULE_WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;
export type RruleWeekday = (typeof RRULE_WEEKDAYS)[number];

/** Structured form-friendly shape the RRULE builder UI edits; converted to/from an RFC5545 RRULE string. */
export interface RecurrenceRule {
  freq: RruleFrequency;
  interval: number;
  byDay: RruleWeekday[];
  until: string | null;
  count: number | null;
}

/** Lean projection returned by the calendar-grid list endpoint — `GET /calendar`. No RRULE/attendees/reminders/color here; fetch the full event for that. */
export interface CalendarItem {
  id: string;
  itemKind: CalendarItemKind;
  title: string;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  matterId: string | null;
  location: string | null;
  status: string | null;
  /** Hearings/Deadlines are locked — drag-to-reschedule is disabled for them (Validation Rules: "drag-reschedule of hearings forbidden"). */
  isLocked: boolean;
}

export interface AttendeeInput {
  userId?: string | null;
  email?: string | null;
  name?: string | null;
}

export interface CreateCalendarEventRequest {
  kind: CalendarEventKind;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location?: string | null;
  videoLink?: string | null;
  matterId?: string | null;
  rrule?: string | null;
  organizerId?: string | null;
  attendees?: AttendeeInput[];
}

export interface UpdateCalendarEventRequest {
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location?: string | null;
  videoLink?: string | null;
  rrule?: string | null;
}

/** `scope` distinguishes editing/deleting "this occurrence" (with `occurrenceDate`) vs the whole series — AC-CAL3. */
export type CalendarEditScope = 'occurrence' | 'series';

export interface CalendarEvent {
  id: string;
  kind: CalendarEventKind;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location: string | null;
  videoLink: string | null;
  matterId: string | null;
  rrule: string | null;
  seriesId: string | null;
  organizerId: string | null;
}

export interface EventReminderInput {
  offsetMinutes: number;
  channel: ReminderChannel;
}

export interface EventReminder {
  id: string;
  eventRefKind: CalendarItemKind;
  eventRefId: string;
  offsetMinutes: number;
  channel: ReminderChannel;
  status: string;
}

export interface BusyBlock {
  startsAt: string;
  endsAt: string;
  source: string;
}

export interface FreeBusyResult {
  busyByUser: Record<string, BusyBlock[]>;
}

export const CALENDAR_SYNC_PROVIDERS = ['google', 'microsoft'] as const;
export type CalendarSyncProvider = (typeof CALENDAR_SYNC_PROVIDERS)[number];

/** Response of `POST /calendar/sync/{provider}/connect` — an OAuth redirect URL to open. */
export interface SyncConnectResult {
  redirectUrl: string;
}

/**
 * `GET /calendar/ics/token` — no dedicated create endpoint exists; per the
 * documented API, the GET is assumed idempotent-create (returns the existing
 * token or provisions one on first call). Confirmed to exist: GET + DELETE
 * (revoke) only.
 */
export interface IcsTokenResult {
  url: string;
  secret: string;
}
