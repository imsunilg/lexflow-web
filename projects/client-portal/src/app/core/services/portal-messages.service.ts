import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL, ApiSuccessEnvelope } from 'shared';
import {
  PortalMessage,
  PortalMessageThread,
  PortalPostMessageRequest,
} from '../models/portal.models';

/**
 * `PortalMessagesController` (`api/portal/v1/threads*`). Body-only — the
 * backend has no attachment support for portal messages (`PortalMessage` has
 * no attachment column, `PortalPostMessageRequest` has no file field). Length
 * is capped server-side at 10k chars via a DB CHECK (`PortalMessage.MaxBodyLength`).
 */
@Injectable({ providedIn: 'root' })
export class PortalMessagesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/portal/v1';

  listThreads(): Observable<PortalMessageThread[]> {
    return this.http
      .get<ApiSuccessEnvelope<PortalMessageThread[]>>(`${this.baseUrl}/threads`)
      .pipe(map((envelope) => envelope.data));
  }

  listMessages(threadId: string): Observable<PortalMessage[]> {
    return this.http
      .get<ApiSuccessEnvelope<PortalMessage[]>>(`${this.baseUrl}/threads/${threadId}/messages`)
      .pipe(map((envelope) => envelope.data));
  }

  postMessage(threadId: string, request: PortalPostMessageRequest): Observable<PortalMessage> {
    return this.http
      .post<ApiSuccessEnvelope<PortalMessage>>(
        `${this.baseUrl}/threads/${threadId}/messages`,
        request,
      )
      .pipe(map((envelope) => envelope.data));
  }
}
