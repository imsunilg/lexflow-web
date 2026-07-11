import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import {
  ClientStatement,
  CreateCreditNoteRequest,
  CreatePaymentRequest,
  CreateRefundRequest,
  CreditNote,
  Payment,
  Refund,
} from '../models/billing.models';
import { API_BASE_URL } from './api-base-url.token';

/** `POST /payments`, `/credit-notes`, `/refunds`, `GET /clients/{id}/statement` (PRD Module 8 §APIs). */
@Injectable({ providedIn: 'root' })
export class PaymentsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  create(request: CreatePaymentRequest): Observable<Payment> {
    return this.http
      .post<ApiSuccessEnvelope<Payment>>(`${this.baseUrl}/payments`, request, {
        headers: request.idempotencyKey ? { 'Idempotency-Key': request.idempotencyKey } : undefined,
      })
      .pipe(map((envelope) => envelope.data));
  }

  clientStatement(clientId: string, from: string, to: string): Observable<ClientStatement> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http
      .get<ApiSuccessEnvelope<ClientStatement>>(`${this.baseUrl}/clients/${clientId}/statement`, {
        params,
      })
      .pipe(map((envelope) => envelope.data));
  }

  createCreditNote(request: CreateCreditNoteRequest): Observable<CreditNote> {
    return this.http
      .post<ApiSuccessEnvelope<CreditNote>>(`${this.baseUrl}/credit-notes`, request)
      .pipe(map((envelope) => envelope.data));
  }

  applyCreditNote(id: string): Observable<CreditNote> {
    return this.http
      .post<ApiSuccessEnvelope<CreditNote>>(`${this.baseUrl}/credit-notes/${id}/apply`, {})
      .pipe(map((envelope) => envelope.data));
  }

  /** `payment.refund` is finance-only + 2FA re-prompt per PRD Security Rules — enforced server-side. */
  createRefund(request: CreateRefundRequest): Observable<Refund> {
    return this.http
      .post<ApiSuccessEnvelope<Refund>>(`${this.baseUrl}/refunds`, request)
      .pipe(map((envelope) => envelope.data));
  }
}
