import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import {
  ConnectEmailAccountRequest,
  EmailMessage,
  EmailThread,
  LinkEmailThreadRequest,
  SendEmailRequest,
} from '../models/communication.models';
import { API_BASE_URL } from './api-base-url.token';

/** PRD Module 11 — email (`comm.email.read`/`comm.email.manage`). OAuth wiring is real but unverified against a live Gmail/Graph account. */
@Injectable({ providedIn: 'root' })
export class CommEmailService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  /** Returns a real OAuth consent URL to redirect the user to. */
  connectAccount(request: ConnectEmailAccountRequest) {
    return this.http
      .post<ApiSuccessEnvelope<string>>(`${this.baseUrl}/comm/email/accounts/connect`, request)
      .pipe(map((envelope) => envelope.data));
  }

  /** Real token exchange server-side; returns the new mailbox's id — there is no listing endpoint to recover it later (see `MailboxRegistryService`). */
  connectAccountCallback(request: { provider: string; code: string; redirectUri: string }) {
    return this.http
      .post<ApiSuccessEnvelope<string>>(`${this.baseUrl}/comm/email/accounts/callback`, request)
      .pipe(map((envelope) => envelope.data));
  }

  listThreads(matterId?: string, clientId?: string) {
    const params: Record<string, string> = {};
    if (matterId) params['matterId'] = matterId;
    if (clientId) params['clientId'] = clientId;
    return this.http
      .get<ApiSuccessEnvelope<EmailThread[]>>(`${this.baseUrl}/comm/email/threads`, { params })
      .pipe(map((envelope) => envelope.data));
  }

  /** AC-CM3: threads with no matched matter/client, awaiting manual confirmation. */
  triageQueue() {
    return this.http
      .get<ApiSuccessEnvelope<EmailThread[]>>(`${this.baseUrl}/comm/email/threads/triage`)
      .pipe(map((envelope) => envelope.data));
  }

  listMessages(threadId: string) {
    return this.http
      .get<ApiSuccessEnvelope<EmailMessage[]>>(
        `${this.baseUrl}/comm/email/threads/${threadId}/messages`,
      )
      .pipe(map((envelope) => envelope.data));
  }

  linkThread(threadId: string, request: LinkEmailThreadRequest) {
    return this.http
      .post<ApiSuccessEnvelope<EmailThread>>(
        `${this.baseUrl}/comm/email/threads/${threadId}/link`,
        request,
      )
      .pipe(map((envelope) => envelope.data));
  }

  send(request: SendEmailRequest) {
    return this.http
      .post<ApiSuccessEnvelope<EmailThread>>(`${this.baseUrl}/comm/email/send`, request)
      .pipe(map((envelope) => envelope.data));
  }
}
