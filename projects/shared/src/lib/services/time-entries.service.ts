import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import {
  ApproveTimeEntriesRequest,
  CreateTimeEntryRequest,
  RejectTimeEntriesRequest,
  TimeEntry,
  TimeEntryFilter,
  UpdateTimeEntryRequest,
} from '../models/time-entry.models';
import { API_BASE_URL } from './api-base-url.token';

/**
 * `GET/POST/PUT/DELETE /time-entries*` (PRD Module 9 §APIs). List is a flat,
 * unpaginated array (confirmed — `GetAll` has no `page`/`cursor` params
 * despite the envelope's `meta` generically supporting them), so any
 * grid/virtualization is assembled client-side from this one call.
 */
@Injectable({ providedIn: 'root' })
export class TimeEntriesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  list(filter: TimeEntryFilter = {}): Observable<TimeEntry[]> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filter)) {
      if (value) params = params.set(key, value);
    }
    return this.http
      .get<ApiSuccessEnvelope<TimeEntry[]>>(`${this.baseUrl}/time-entries`, { params })
      .pipe(map((envelope) => envelope.data));
  }

  get(id: string): Observable<TimeEntry> {
    return this.http
      .get<ApiSuccessEnvelope<TimeEntry>>(`${this.baseUrl}/time-entries/${id}`)
      .pipe(map((envelope) => envelope.data));
  }

  create(request: CreateTimeEntryRequest): Observable<TimeEntry> {
    return this.http
      .post<ApiSuccessEnvelope<TimeEntry>>(`${this.baseUrl}/time-entries`, request)
      .pipe(map((envelope) => envelope.data));
  }

  /** Only permitted until the entry is Approved (AC-T3: never editable once Billed). */
  update(id: string, request: UpdateTimeEntryRequest): Observable<TimeEntry> {
    return this.http
      .put<ApiSuccessEnvelope<TimeEntry>>(`${this.baseUrl}/time-entries/${id}`, request)
      .pipe(map((envelope) => envelope.data));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/time-entries/${id}`);
  }

  submit(ids: string[]): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/time-entries/submit`, { ids });
  }

  /** `time.approve` cannot approve own entries (server-enforced segregation, PRD Security Rules). */
  approve(request: ApproveTimeEntriesRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/time-entries/approve`, request);
  }

  reject(request: RejectTimeEntriesRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/time-entries/reject`, request);
  }
}
