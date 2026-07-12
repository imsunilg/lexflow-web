import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import {
  ChatChannel,
  ChatMessage,
  ConvertChatMessageToTaskRequest,
  CreateChatChannelRequest,
} from '../models/communication.models';
import { API_BASE_URL } from './api-base-url.token';

/**
 * PRD Module 11 — internal chat (`comm.chat.read`/`comm.chat.manage`). No
 * server-side unread/last-read tracking exists — callers must track "last
 * seen `seq`" themselves (see `ChatHubService`/`ChatDockComponent`).
 */
@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  listChannels() {
    return this.http
      .get<ApiSuccessEnvelope<ChatChannel[]>>(`${this.baseUrl}/chat/channels`)
      .pipe(map((envelope) => envelope.data));
  }

  createChannel(request: CreateChatChannelRequest) {
    return this.http
      .post<ApiSuccessEnvelope<ChatChannel>>(`${this.baseUrl}/chat/channels`, request)
      .pipe(map((envelope) => envelope.data));
  }

  /** `afterSeq` fetches only messages newer than a given sequence number — use it for incremental catch-up. */
  listMessages(channelId: string, afterSeq?: number, limit = 50) {
    let params = new HttpParams().set('limit', String(limit));
    if (afterSeq !== undefined) params = params.set('afterSeq', String(afterSeq));
    return this.http
      .get<ApiSuccessEnvelope<ChatMessage[]>>(
        `${this.baseUrl}/chat/channels/${channelId}/messages`,
        {
          params,
        },
      )
      .pipe(map((envelope) => envelope.data));
  }

  postMessage(channelId: string, body: string) {
    return this.http
      .post<ApiSuccessEnvelope<ChatMessage>>(
        `${this.baseUrl}/chat/channels/${channelId}/messages`,
        {
          body,
        },
      )
      .pipe(map((envelope) => envelope.data));
  }

  convertToTask(messageId: string, request: ConvertChatMessageToTaskRequest) {
    return this.http
      .post<ApiSuccessEnvelope<string>>(
        `${this.baseUrl}/chat/messages/${messageId}/convert-to-task`,
        request,
      )
      .pipe(map((envelope) => envelope.data));
  }
}
