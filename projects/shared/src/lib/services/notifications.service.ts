import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { map, tap } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import { NotificationItem, NotificationPushEvent } from '../models/notification.models';
import { API_BASE_URL } from './api-base-url.token';
import { RealtimeHubService } from './realtime-hub.service';

/**
 * Notification bell state: `GET /notifications` for the initial list, `PATCH`
 * (`POST .../read` — the only mark-read route the API actually exposes) per item,
 * plus a `/hubs/notifications` `notificationCreated` push that prepends new items
 * live without waiting for the next poll (PRD §22/§16, Build Playbook D-1).
 */
@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';
  private readonly realtimeHub = inject(RealtimeHubService);

  private readonly notificationsSignal = signal<NotificationItem[]>([]);
  readonly notifications = this.notificationsSignal.asReadonly();
  readonly unreadCount = computed(
    () => this.notificationsSignal().filter((n) => n.readAt === null).length,
  );

  private realtimeConnected = false;

  load(unreadOnly = false) {
    return this.http
      .get<ApiSuccessEnvelope<NotificationItem[]>>(`${this.baseUrl}/notifications`, {
        params: { unreadOnly },
      })
      .pipe(
        map((envelope) => envelope.data),
        tap((items) => this.notificationsSignal.set(items)),
      );
  }

  markAsRead(id: string) {
    return this.http
      .post<void>(`${this.baseUrl}/notifications/${id}/read`, {})
      .pipe(
        tap(() =>
          this.notificationsSignal.update((items) =>
            items.map((item) =>
              item.id === id ? { ...item, readAt: new Date().toISOString() } : item,
            ),
          ),
        ),
      );
  }

  /** Idempotent — safe to call from every shell instance; only opens the hub subscription once. */
  connectRealtime(): void {
    if (this.realtimeConnected) {
      return;
    }
    this.realtimeConnected = true;

    this.realtimeHub.on<NotificationPushEvent>('notificationCreated').subscribe((event) => {
      this.notificationsSignal.update((items) =>
        items.some((item) => item.id === event.id) ? items : [event, ...items],
      );
    });
  }

  clear(): void {
    this.notificationsSignal.set([]);
  }
}
