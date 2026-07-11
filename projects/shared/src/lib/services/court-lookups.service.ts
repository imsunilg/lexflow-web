import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import { Court, CourtHoliday } from '../models/court-case.models';
import { API_BASE_URL } from './api-base-url.token';

/**
 * Court master list + court-holiday calendar lookups. Both are documented
 * gaps: `courts`/`court_holidays` tables and entities exist in lexflow-api,
 * but no controller/endpoint reads either today (confirmed — no
 * `CourtsController`, no holiday route anywhere in `HearingsController`/
 * `CasesController`). These call the natural REST routes and degrade to an
 * empty list if they 404, so the court dropdown and the hearing-outcome
 * dialog's holiday warning both stay usable (just inert) until the backend
 * ships them.
 */
@Injectable({ providedIn: 'root' })
export class CourtLookupsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  courts(): Observable<Court[]> {
    return this.http.get<ApiSuccessEnvelope<Court[]>>(`${this.baseUrl}/courts`).pipe(
      map((envelope) => envelope.data),
      catchError(() => of<Court[]>([])),
    );
  }

  holidays(courtId: string, year: number): Observable<CourtHoliday[]> {
    return this.http
      .get<ApiSuccessEnvelope<CourtHoliday[]>>(`${this.baseUrl}/courts/${courtId}/holidays`, {
        params: new HttpParams().set('year', year),
      })
      .pipe(
        map((envelope) => envelope.data),
        catchError(() => of<CourtHoliday[]>([])),
      );
  }
}
