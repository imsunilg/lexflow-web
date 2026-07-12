import { Injectable, inject } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Observable } from 'rxjs';
import { ChatMessage } from '../models/communication.models';
import { AuthTokenService } from './auth-token.service';
import { HUB_BASE_URL } from './hub-base-url.token';

/**
 * Lazily-opened connection to `/hubs/chat`, separate from `RealtimeHubService`
 * (which is hardcoded to `/hubs/notifications`) since chat needs its own
 * client-invokable `JoinChannel`/`LeaveChannel` group-membership calls. The
 * server only ever emits one event, `"messageReceived"` — no typing
 * indicators, no presence, no read-receipts, no "channel created" push (all
 * confirmed absent server-side).
 */
@Injectable({ providedIn: 'root' })
export class ChatHubService {
  private readonly authTokenService = inject(AuthTokenService);
  private readonly hubBaseUrl = inject(HUB_BASE_URL, { optional: true }) ?? '';

  private connection: signalR.HubConnection | null = null;
  private startPromise: Promise<void> | null = null;

  onMessageReceived(): Observable<ChatMessage> {
    return new Observable<ChatMessage>((subscriber) => {
      let disposed = false;
      const handler = (payload: ChatMessage) => subscriber.next(payload);

      this.ensureStarted()
        .then(() => {
          if (disposed) return;
          this.connection!.on('messageReceived', handler);
        })
        .catch((error: unknown) => subscriber.error(error));

      return () => {
        disposed = true;
        this.connection?.off('messageReceived', handler);
      };
    });
  }

  async joinChannel(channelId: string): Promise<void> {
    await this.ensureStarted();
    await this.connection!.invoke('JoinChannel', channelId);
  }

  async leaveChannel(channelId: string): Promise<void> {
    await this.ensureStarted();
    await this.connection!.invoke('LeaveChannel', channelId);
  }

  private ensureStarted(): Promise<void> {
    this.connection ??= new signalR.HubConnectionBuilder()
      .withUrl(`${this.hubBaseUrl}/hubs/chat`, {
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
