export interface StartTimerRequest {
  matterId?: string | null;
  activityCodeId?: string | null;
  contextRef?: string | null;
}

/**
 * `POST /timers/stop` — the server, not the client, computes elapsed duration
 * and rounding (a hardcoded 6-minute increment, `TimeTrackingService.
 * RoundingIncrementMinutes` — not configurable, not exposed via any
 * endpoint). The client only supplies billing metadata; there is no
 * `duration`/`roundedMinutes` field to send here.
 */
export interface StopTimerRequest {
  billable: boolean;
  narrative?: string | null;
  internalNote?: string | null;
  activityCodeId?: string | null;
}

/** `GET /timers/current` response shape (`RunningTimerDto`, PRD Module 9/§18 `running_timers`). `null` when no timer is running. */
export interface RunningTimer {
  userId: string;
  matterId: string | null;
  startedAt: string;
  isPaused: boolean;
  /** .NET `TimeSpan` serializes as `"[d.]hh:mm:ss[.fffffff]"` — parsed to seconds by `parseTimeSpanToSeconds` in `timer.service.ts`. */
  elapsed: string;
  contextJson: string;
}

/**
 * Push payload for a `timerChanged` event, delivered over the same `/hubs/notifications`
 * connection `NotificationsService` already opens (no dedicated timer hub exists
 * server-side — `NotificationsHub` is currently an empty stub with no broadcasts wired
 * up at all, see its own doc comment in lexflow-api). `TimerService` treats this as a
 * best-effort "re-poll now" nudge, not a trusted source of truth — it always
 * re-fetches `GET /timers/current` on receipt rather than applying this payload
 * directly, so it degrades to polling-only if/when the server never sends it.
 */
export interface TimerPushEvent {
  userId: string;
}
