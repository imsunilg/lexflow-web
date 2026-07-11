import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import { AgingReport } from '../models/billing.models';
import { API_BASE_URL } from './api-base-url.token';

/** `GET /billing/aging?asOf=` (PRD Module 8 §APIs, AC-B6). */
@Injectable({ providedIn: 'root' })
export class BillingReportsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  aging(asOf?: string): Observable<AgingReport> {
    let params = new HttpParams();
    if (asOf) params = params.set('asOf', asOf);
    return this.http
      .get<ApiSuccessEnvelope<AgingReport>>(`${this.baseUrl}/billing/aging`, { params })
      .pipe(map((envelope) => envelope.data));
  }
}
