import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import {
  Hearing,
  RecordHearingOutcomeRequest,
  RecordHearingOutcomeResult,
} from '../models/court-case.models';
import { API_BASE_URL } from './api-base-url.token';

/** `GET/POST /hearings*` (PRD Module 5). */
@Injectable({ providedIn: 'root' })
export class HearingsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  get(id: string): Observable<Hearing> {
    return this.http
      .get<ApiSuccessEnvelope<Hearing>>(`${this.baseUrl}/hearings/${id}`)
      .pipe(map((envelope) => envelope.data));
  }

  /** AC-CC1: recording an outcome with a next date creates the next hearing + reminders in one transaction. */
  recordOutcome(
    hearingId: string,
    request: RecordHearingOutcomeRequest,
  ): Observable<RecordHearingOutcomeResult> {
    return this.http
      .post<ApiSuccessEnvelope<RecordHearingOutcomeResult>>(
        `${this.baseUrl}/hearings/${hearingId}/outcome`,
        request,
      )
      .pipe(map((envelope) => envelope.data));
  }

  /** Cause list (AC-CC2): every firm hearing on a date, optionally filtered by court/lawyer. */
  causeList(date: string, courtId?: string, lawyerId?: string): Observable<Hearing[]> {
    let params = new HttpParams().set('date', date);
    if (courtId) params = params.set('courtId', courtId);
    if (lawyerId) params = params.set('lawyerId', lawyerId);
    return this.http
      .get<ApiSuccessEnvelope<Hearing[]>>(`${this.baseUrl}/hearings`, { params })
      .pipe(map((envelope) => envelope.data));
  }
}
