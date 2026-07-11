import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import { RateCard, RateCardEntry } from '../models/billing.models';
import { API_BASE_URL } from './api-base-url.token';

/** `GET/POST /rate-cards*` (PRD Module 8 §User Flow 1 — fee setup rate cards). */
@Injectable({ providedIn: 'root' })
export class RateCardsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  list(): Observable<RateCard[]> {
    return this.http
      .get<ApiSuccessEnvelope<RateCard[]>>(`${this.baseUrl}/rate-cards`)
      .pipe(map((envelope) => envelope.data));
  }

  create(name: string): Observable<RateCard> {
    return this.http
      .post<ApiSuccessEnvelope<RateCard>>(`${this.baseUrl}/rate-cards`, { name })
      .pipe(map((envelope) => envelope.data));
  }

  addEntry(rateCardId: string, role: string, rate: number): Observable<RateCardEntry> {
    return this.http
      .post<ApiSuccessEnvelope<RateCardEntry>>(`${this.baseUrl}/rate-cards/${rateCardId}/entries`, {
        role,
        rate,
      })
      .pipe(map((envelope) => envelope.data));
  }
}
