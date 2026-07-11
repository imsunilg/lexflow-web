import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import {
  BatchInvoiceRequest,
  CreateInvoiceRequest,
  Invoice,
  InvoiceFilter,
  InvoiceStatusHistoryEntry,
} from '../models/billing.models';
import { API_BASE_URL } from './api-base-url.token';

/** `GET/POST/PUT /invoices*` (PRD Module 8 §APIs). */
@Injectable({ providedIn: 'root' })
export class InvoicesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  list(filter: InvoiceFilter = {}): Observable<Invoice[]> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http
      .get<ApiSuccessEnvelope<Invoice[]>>(`${this.baseUrl}/invoices`, { params })
      .pipe(map((envelope) => envelope.data));
  }

  get(id: string): Observable<Invoice> {
    return this.http
      .get<ApiSuccessEnvelope<Invoice>>(`${this.baseUrl}/invoices/${id}`)
      .pipe(map((envelope) => envelope.data));
  }

  create(request: CreateInvoiceRequest): Observable<Invoice> {
    return this.http
      .post<ApiSuccessEnvelope<Invoice>>(`${this.baseUrl}/invoices`, request)
      .pipe(map((envelope) => envelope.data));
  }

  batch(request: BatchInvoiceRequest): Observable<Invoice[]> {
    return this.http
      .post<ApiSuccessEnvelope<Invoice[]>>(`${this.baseUrl}/invoices/batch`, request)
      .pipe(map((envelope) => envelope.data));
  }

  /** PUT only permitted while the invoice is Draft. */
  update(id: string, request: CreateInvoiceRequest): Observable<Invoice> {
    return this.http
      .put<ApiSuccessEnvelope<Invoice>>(`${this.baseUrl}/invoices/${id}`, request)
      .pipe(map((envelope) => envelope.data));
  }

  submit(id: string): Observable<Invoice> {
    return this.http
      .post<ApiSuccessEnvelope<Invoice>>(`${this.baseUrl}/invoices/${id}/submit`, {})
      .pipe(map((envelope) => envelope.data));
  }

  approve(id: string): Observable<Invoice> {
    return this.http
      .post<ApiSuccessEnvelope<Invoice>>(`${this.baseUrl}/invoices/${id}/approve`, {})
      .pipe(map((envelope) => envelope.data));
  }

  reject(id: string, reason: string): Observable<Invoice> {
    return this.http
      .post<ApiSuccessEnvelope<Invoice>>(`${this.baseUrl}/invoices/${id}/reject`, { reason })
      .pipe(map((envelope) => envelope.data));
  }

  send(id: string): Observable<Invoice> {
    return this.http
      .post<ApiSuccessEnvelope<Invoice>>(`${this.baseUrl}/invoices/${id}/send`, {})
      .pipe(map((envelope) => envelope.data));
  }

  /** AC-B5: void only if unpaid — otherwise the API rejects it, use a credit note instead. */
  void(id: string, reason: string): Observable<Invoice> {
    return this.http
      .post<ApiSuccessEnvelope<Invoice>>(`${this.baseUrl}/invoices/${id}/void`, { reason })
      .pipe(map((envelope) => envelope.data));
  }

  statusHistory(id: string): Observable<InvoiceStatusHistoryEntry[]> {
    return this.http
      .get<ApiSuccessEnvelope<InvoiceStatusHistoryEntry[]>>(
        `${this.baseUrl}/invoices/${id}/status-history`,
      )
      .pipe(map((envelope) => envelope.data));
  }

  /** Raw `application/pdf` — not envelope-wrapped. Use directly as an `<a href>`/`<iframe src>`. */
  pdfUrl(id: string): string {
    return `${this.baseUrl}/invoices/${id}/pdf`;
  }
}
