import { Injectable, inject, signal } from '@angular/core';
import { HearingOutcomeAddedEvent, PaymentReceivedEvent } from '../models/dashboard.models';
import { RealtimeHubService } from './realtime-hub.service';

/**
 * Dashboard's slice of `/hubs/notifications` (PRD Module 1: "auto-refresh via
 * SignalR push (hearing outcomes, payments) + 5-min polling fallback"). There's
 * no dedicated `/hubs/dashboard` and `NotificationsHub` on the server is
 * currently an empty stub with no broadcaster wired to it (mirrors the same gap
 * already documented on `TimerService`/`NotificationsService`), so this
 * degrades gracefully: `refreshTick` only changes when an event actually
 * arrives, and every dashboard widget also re-polls independently, so the page
 * stays correct — just not "within 5s" (AC-D3) — until the backend broadcasts
 * these events. `liveUpdatesPaused` flips true the first time the underlying
 * hub connection fails, so the dashboard page can show the PRD's required
 * "Live updates paused" banner.
 */
@Injectable({ providedIn: 'root' })
export class DashboardRealtimeService {
  private readonly realtimeHub = inject(RealtimeHubService);

  private readonly refreshTickSignal = signal(0);
  readonly refreshTick = this.refreshTickSignal.asReadonly();

  readonly liveUpdatesPaused = signal(false);

  private connected = false;

  /** Idempotent — safe to call from every dashboard page instance. */
  connect(): void {
    if (this.connected) {
      return;
    }
    this.connected = true;

    this.realtimeHub.on<HearingOutcomeAddedEvent>('hearingOutcomeAdded').subscribe({
      next: () => this.bump(),
      error: () => this.liveUpdatesPaused.set(true),
    });

    this.realtimeHub.on<PaymentReceivedEvent>('paymentReceived').subscribe({
      next: () => this.bump(),
      error: () => this.liveUpdatesPaused.set(true),
    });
  }

  private bump(): void {
    this.liveUpdatesPaused.set(false);
    this.refreshTickSignal.update((n) => n + 1);
  }
}
