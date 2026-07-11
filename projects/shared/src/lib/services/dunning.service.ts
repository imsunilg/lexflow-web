import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import { DunningSchedule } from '../models/billing.models';
import { API_BASE_URL } from './api-base-url.token';

/** `GET/POST /dunning/schedules`, `POST /dunning/invoices/{id}/mute` (PRD Module 8 §User Flow 7). */
@Injectable({ providedIn: 'root' })
export class DunningService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  listSchedules(): Observable<DunningSchedule[]> {
    return this.http
      .get<ApiSuccessEnvelope<DunningSchedule[]>>(`${this.baseUrl}/dunning/schedules`)
      .pipe(map((envelope) => envelope.data));
  }

  createSchedule(name: string, stepsJson: string, isActive: boolean): Observable<DunningSchedule> {
    return this.http
      .post<ApiSuccessEnvelope<DunningSchedule>>(`${this.baseUrl}/dunning/schedules`, {
        name,
        stepsJson,
        isActive,
      })
      .pipe(map((envelope) => envelope.data));
  }

  muteInvoice(invoiceId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/dunning/invoices/${invoiceId}/mute`, {});
  }
}
