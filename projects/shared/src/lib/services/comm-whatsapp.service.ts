import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import {
  OptInWhatsAppRequest,
  SendWhatsAppRequest,
  WhatsAppOptin,
  WhatsappMessage,
} from '../models/communication.models';
import { API_BASE_URL } from './api-base-url.token';

/** PRD Module 11 — WhatsApp (`comm.whatsapp.read`/`comm.whatsapp.manage`). Opt-in and 24h session-window checks are real, server-side. */
@Injectable({ providedIn: 'root' })
export class CommWhatsAppService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  send(request: SendWhatsAppRequest) {
    return this.http
      .post<ApiSuccessEnvelope<WhatsappMessage>>(`${this.baseUrl}/comm/whatsapp/send`, request)
      .pipe(map((envelope) => envelope.data));
  }

  listForClient(clientId: string) {
    return this.http
      .get<ApiSuccessEnvelope<WhatsappMessage[]>>(
        `${this.baseUrl}/comm/whatsapp/clients/${clientId}`,
      )
      .pipe(map((envelope) => envelope.data));
  }

  optIn(clientId: string, request: OptInWhatsAppRequest) {
    return this.http
      .post<ApiSuccessEnvelope<WhatsAppOptin>>(
        `${this.baseUrl}/comm/whatsapp/clients/${clientId}/opt-in`,
        request,
      )
      .pipe(map((envelope) => envelope.data));
  }

  optOut(clientId: string) {
    return this.http.post<void>(`${this.baseUrl}/comm/whatsapp/clients/${clientId}/opt-out`, {});
  }
}
