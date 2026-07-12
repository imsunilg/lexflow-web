/**
 * PRD Module 9 — Time Tracking. Status/source values are taken from the PRD's
 * own `time_entries` column definitions (`status[Draft|Submitted|Approved|
 * Rejected|Billed|WrittenOff]`, `source[timer|manual|suggested]`) since the
 * backend confirms these as plain `string` fields with no enum-listing
 * endpoint — kept as loose string types with these as the known values.
 */
export const TIME_ENTRY_STATUSES = [
  'Draft',
  'Submitted',
  'Approved',
  'Rejected',
  'Billed',
  'WrittenOff',
] as const;
export type TimeEntryStatus = (typeof TIME_ENTRY_STATUSES)[number];

export const TIME_ENTRY_SOURCES = ['timer', 'manual', 'suggested'] as const;
export type TimeEntrySource = (typeof TIME_ENTRY_SOURCES)[number];

/**
 * There is no `activity-codes` lookup endpoint at all (confirmed — the
 * entity/FK exist but nothing exposes a list). `activityCodeId` is therefore
 * always sent as `null`/omitted from this UI until such an endpoint ships;
 * these labels (from the PRD's own example list) are shown as a plain
 * non-submitting reference/tag on manual entries only, not backed by real ids.
 */
export const ACTIVITY_CODE_EXAMPLES = [
  'Drafting',
  'Court Appearance',
  'Research',
  'Client Call',
  'Review',
] as const;

/** Server-hardcoded in `TimeTrackingService` (`RoundingIncrementMinutes = 6`) — not configurable, not exposed via any endpoint. Mirrored here only for the stop-dialog's rounding *preview*; the server always computes the authoritative value. */
export const ROUNDING_INCREMENT_MINUTES = 6;

export interface TimeEntry {
  id: string;
  userId: string;
  matterId: string;
  activityCodeId: string | null;
  entryDate: string;
  startedAt: string | null;
  durationMin: number;
  roundedMin: number;
  billable: boolean;
  narrative: string | null;
  internalNote: string | null;
  status: TimeEntryStatus;
  rateSnapshot: number | null;
  amountSnapshot: number | null;
  invoiceLineId: string | null;
  source: TimeEntrySource;
  approvedBy: string | null;
  approvedAt: string | null;
}

export interface TimeEntryFilter {
  userId?: string;
  matterId?: string;
  status?: string;
  from?: string;
  to?: string;
}

export interface CreateTimeEntryRequest {
  matterId: string;
  activityCodeId?: string | null;
  entryDate: string;
  durationMin: number;
  billable: boolean;
  narrative?: string | null;
  internalNote?: string | null;
}

export type UpdateTimeEntryRequest = CreateTimeEntryRequest;

export interface RejectTimeEntriesRequest {
  ids: string[];
  comment?: string | null;
}

export interface ApproveTimeEntriesRequest {
  ids: string[];
  manualRateOverride?: number | null;
}
