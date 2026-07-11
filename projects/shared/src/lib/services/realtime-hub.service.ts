import { Injectable, inject } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Observable } from 'rxjs';
import { AuthTokenService } from './auth-token.service';
import { HUB_BASE_URL } from './hub-base-url.token';

/**
 * Lazily-opened connection to `/hubs/notifications`, shared by every consumer that
 * needs a real-time push from it (`NotificationsService` for `notificationCreated`,
 * `TimerService` for `timerChanged`) rather than each opening its own connection.
 * The connection only opens once something actually subscribes via `on()`, and the
 * JWT is supplied per-connection-attempt (not just at construction) so a token
 * minted after this service was first injected is still picked up.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeHubService {
  private readonly authTokenService = inject(AuthTokenService);
  private readonly hubBaseUrl = inject(HUB_BASE_URL, { optional: true }) ?? '';

  private connection: signalR.HubConnection | null = null;
  private startPromise: Promise<void> | null = null;

  /** Subscribes to a named hub method; connects (once, shared) on first subscriber. */
  on<T>(methodName: string): Observable<T> {
    return new Observable<T>((subscriber) => {
      let disposed = false;
      const handler = (payload: T) => subscriber.next(payload);

      this.ensureStarted()
        .then(() => {
          if (disposed) {
            return;
          }
          this.connection!.on(methodName, handler);
        })
        .catch((error: unknown) => subscriber.error(error));

      return () => {
        disposed = true;
        this.connection?.off(methodName, handler);
      };
    });
  }

  private ensureStarted(): Promise<void> {
    this.connection ??= new signalR.HubConnectionBuilder()
      .withUrl(`${this.hubBaseUrl}/hubs/notifications`, {
        accessTokenFactory: () => this.authTokenService.accessToken() ?? '',
      })
      .withAutomaticReconnect()
      .build();

    if (this.connection.state === signalR.HubConnectionState.Connected) {
      return Promise.resolve();
    }

    this.startPromise ??= this.connection.start().finally(() => {
      this.startPromise = null;
    });

    return this.startPromise;
  }
}
