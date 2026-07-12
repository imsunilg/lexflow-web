import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL, ApiSuccessEnvelope } from 'shared';
import {
  PortalInvoiceSummary,
  PortalPayNowRequest,
  PortalPaySession,
} from '../models/portal.models';

/**
 * `PortalInvoicesController` (`api/portal/v1/invoices*`). Draft invoices are
 * excluded server-side. There is NO PDF/receipt/statement download endpoint
 * for the portal — only this JSON summary — so this service intentionally has
 * no `downloadUrl()`/`previewUrl()` method the way staff's `DocumentsService`
 * does; the invoice page discloses that gap in its UI instead of guessing at
 * a route.
 */
@Injectable({ providedIn: 'root' })
export class PortalInvoicesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/portal/v1';

  list(): Observable<PortalInvoiceSummary[]> {
    return this.http
      .get<ApiSuccessEnvelope<PortalInvoiceSummary[]>>(`${this.baseUrl}/invoices`)
      .pipe(map((envelope) => envelope.data));
  }

  get(id: string): Observable<PortalInvoiceSummary> {
    return this.http
      .get<ApiSuccessEnvelope<PortalInvoiceSummary>>(`${this.baseUrl}/invoices/${id}`)
      .pipe(map((envelope) => envelope.data));
  }

  /** Returns a real gateway checkout session (Razorpay/Stripe/PayPal, whichever the tenant has configured) — the caller redirects the browser to `checkoutUrl`; there is no embedded-iframe mode. */
  payNow(id: string, request: PortalPayNowRequest): Observable<PortalPaySession> {
    return this.http
      .post<ApiSuccessEnvelope<PortalPaySession>>(`${this.baseUrl}/invoices/${id}/pay`, request)
      .pipe(map((envelope) => envelope.data));
  }
}
