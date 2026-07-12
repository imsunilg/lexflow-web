import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import { CallLog, ClickToCallRequest, LogCallRequest } from '../models/communication.models';
import { API_BASE_URL } from './api-base-url.token';

/** PRD Module 11 — calls (`comm.calls.read`/`comm.calls.manage`). Click-to-call is a real Twilio Voice REST integration. */
@Injectable({ providedIn: 'root' })
export class CommCallsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  log(request: LogCallRequest) {
    return this.http
      .post<ApiSuccessEnvelope<CallLog>>(`${this.baseUrl}/comm/calls`, request)
      .pipe(map((envelope) => envelope.data));
  }

  /** Recording (if any) is populated later, asynchronously, from the provider's status callback — never present on this response. */
  clickToCall(request: ClickToCallRequest) {
    return this.http
      .post<ApiSuccessEnvelope<CallLog>>(`${this.baseUrl}/comm/calls/click-to-call`, request)
      .pipe(map((envelope) => envelope.data));
  }

  listForClient(clientId: string) {
    return this.http
      .get<ApiSuccessEnvelope<CallLog[]>>(`${this.baseUrl}/comm/calls/clients/${clientId}`)
      .pipe(map((envelope) => envelope.data));
  }
}
