import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import { SendSmsRequest, SmsMessage } from '../models/communication.models';
import { API_BASE_URL } from './api-base-url.token';

/** PRD Module 11 — SMS (`comm.sms.read`/`comm.sms.manage`). DLT enforcement is real, server-side. */
@Injectable({ providedIn: 'root' })
export class CommSmsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  send(request: SendSmsRequest) {
    return this.http
      .post<ApiSuccessEnvelope<SmsMessage>>(`${this.baseUrl}/comm/sms/send`, request)
      .pipe(map((envelope) => envelope.data));
  }

  listForClient(clientId: string) {
    return this.http
      .get<ApiSuccessEnvelope<SmsMessage[]>>(`${this.baseUrl}/comm/sms/clients/${clientId}`)
      .pipe(map((envelope) => envelope.data));
  }
}
