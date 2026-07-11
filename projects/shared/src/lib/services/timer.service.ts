import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { interval, map, switchMap, tap } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import { RunningTimer, TimerPushEvent } from '../models/timer.models';
import { API_BASE_URL } from './api-base-url.token';
import { RealtimeHubService } from './realtime-hub.service';

const POLL_INTERVAL_MS = 30_000;
const LOCAL_TICK_MS = 1_000;

/** Parses a .NET `TimeSpan` JSON string (`"[d.]hh:mm:ss[.fffffff]"`) to whole seconds. */
export function parseTimeSpanToSeconds(timeSpan: string): number {
  const match = /^(?:(\d+)\.)?(\d{2}):(\d{2}):(\d{2})/.exec(timeSpan);
  if (!match) {
    return 0;
  }

  const [, days, hours, minutes, seconds] = match;
  return (Number(days ?? 0) * 24 + Number(hours)) * 3600 + Number(minutes) * 60 + Number(seconds);
}

/**
 * Persistent timer chip state: polls `GET /timers/current` (no server-mandated
 * interval is documented — 30s balances staleness against load) as the source of
 * truth, ticks a local 1s display counter between polls so the chip doesn't look
 * frozen, and re-polls immediately on a `timerChanged` push from
 * `/hubs/notifications` (Build Playbook D-1: "polling ... + SignalR").
 */
@Injectable({ providedIn: 'root' })
export class TimerService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';
  private readonly realtimeHub = inject(RealtimeHubService);

  private readonly currentSignal = signal<RunningTimer | null>(null);
  readonly current = this.currentSignal.asReadonly();

  private readonly localTickSignal = signal(0);

  /** Elapsed seconds, smoothly ticking between polls while a timer is running and not paused. */
  readonly elapsedSeconds = computed(() => {
    const timer = this.currentSignal();
    if (!timer) {
      return 0;
    }

    const base = parseTimeSpanToSeconds(timer.elapsed);
    return timer.isPaused ? base : base + this.localTickSignal();
  });

  private started = false;

  /**
   * Idempotent — safe to call from every shell instance; only wires polling/
   * ticking/realtime once. Never explicitly torn down: this is a root-singleton
   * service with the same lifetime as the app itself, so these subscriptions are
   * meant to run for as long as the app does.
   */
  connect(): void {
    if (this.started) {
      return;
    }
    this.started = true;

    interval(POLL_INTERVAL_MS)
      .pipe(switchMap(() => this.refetch()))
      .subscribe();
    this.refetch().subscribe();

    interval(LOCAL_TICK_MS).subscribe(() => this.localTickSignal.update((n) => n + 1));

    this.realtimeHub
      .on<TimerPushEvent>('timerChanged')
      .pipe(switchMap(() => this.refetch()))
      .subscribe();
  }

  private refetch() {
    return this.http
      .get<ApiSuccessEnvelope<RunningTimer | null>>(`${this.baseUrl}/timers/current`)
      .pipe(
        map((envelope) => envelope.data),
        tap((timer) => {
          this.currentSignal.set(timer);
          this.localTickSignal.set(0);
        }),
      );
  }

  clear(): void {
    this.currentSignal.set(null);
    this.localTickSignal.set(0);
  }
}
