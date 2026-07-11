import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import {
  CalendarEditScope,
  CalendarEvent,
  CalendarItem,
  CalendarItemKind,
  CalendarScope,
  CalendarSyncProvider,
  CreateCalendarEventRequest,
  EventReminder,
  EventReminderInput,
  FreeBusyResult,
  IcsTokenResult,
  SyncConnectResult,
  UpdateCalendarEventRequest,
} from '../models/calendar.models';
import { API_BASE_URL } from './api-base-url.token';

/** `GET/POST/PUT/DELETE /calendar*` (PRD Module 6 §APIs). */
@Injectable({ providedIn: 'root' })
export class CalendarService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  /**
   * `scope` (My/Team/Firm) has no backing query param on the backend today
   * (confirmed against the controller) — sent anyway for forward
   * compatibility, filtering is otherwise a client-side no-op.
   */
  list(
    from: string,
    to: string,
    types?: CalendarItemKind[],
    scope?: CalendarScope,
  ): Observable<CalendarItem[]> {
    let params = new HttpParams().set('from', from).set('to', to);
    if (types && types.length > 0) {
      params = params.set('types', types.join(','));
    }
    if (scope) {
      params = params.set('scope', scope);
    }
    return this.http
      .get<ApiSuccessEnvelope<CalendarItem[]>>(`${this.baseUrl}/calendar`, { params })
      .pipe(map((envelope) => envelope.data));
  }

  getEvent(id: string): Observable<CalendarEvent> {
    return this.http
      .get<ApiSuccessEnvelope<CalendarEvent>>(`${this.baseUrl}/calendar/events/${id}`)
      .pipe(map((envelope) => envelope.data));
  }

  createEvent(request: CreateCalendarEventRequest): Observable<CalendarEvent> {
    return this.http
      .post<ApiSuccessEnvelope<CalendarEvent>>(`${this.baseUrl}/calendar/events`, request)
      .pipe(map((envelope) => envelope.data));
  }

  updateEvent(
    id: string,
    request: UpdateCalendarEventRequest,
    scope?: CalendarEditScope,
    occurrenceDate?: string,
  ): Observable<CalendarEvent> {
    let params = new HttpParams();
    if (scope) params = params.set('scope', scope);
    if (occurrenceDate) params = params.set('occurrenceDate', occurrenceDate);
    return this.http
      .put<ApiSuccessEnvelope<CalendarEvent>>(`${this.baseUrl}/calendar/events/${id}`, request, {
        params,
      })
      .pipe(map((envelope) => envelope.data));
  }

  deleteEvent(id: string, scope?: CalendarEditScope, occurrenceDate?: string): Observable<void> {
    let params = new HttpParams();
    if (scope) params = params.set('scope', scope);
    if (occurrenceDate) params = params.set('occurrenceDate', occurrenceDate);
    return this.http.delete<void>(`${this.baseUrl}/calendar/events/${id}`, { params });
  }

  addReminder(eventId: string, input: EventReminderInput): Observable<EventReminder> {
    return this.http
      .post<ApiSuccessEnvelope<EventReminder>>(
        `${this.baseUrl}/calendar/events/${eventId}/reminders`,
        input,
      )
      .pipe(map((envelope) => envelope.data));
  }

  freeBusy(userIds: string[], from: string, to: string): Observable<FreeBusyResult> {
    const params = new HttpParams()
      .set('userIds', userIds.join(','))
      .set('from', from)
      .set('to', to);
    return this.http
      .get<ApiSuccessEnvelope<FreeBusyResult>>(`${this.baseUrl}/calendar/freebusy`, { params })
      .pipe(map((envelope) => envelope.data));
  }

  icsToken(): Observable<IcsTokenResult> {
    return this.http
      .get<ApiSuccessEnvelope<IcsTokenResult>>(`${this.baseUrl}/calendar/ics/token`)
      .pipe(map((envelope) => envelope.data));
  }

  revokeIcsToken(): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/calendar/ics/token`);
  }

  connectSync(provider: CalendarSyncProvider): Observable<SyncConnectResult> {
    return this.http
      .post<ApiSuccessEnvelope<SyncConnectResult>>(
        `${this.baseUrl}/calendar/sync/${provider}/connect`,
        {},
      )
      .pipe(map((envelope) => envelope.data));
  }

  disconnectSync(
    provider: CalendarSyncProvider,
    accountId: string,
    removeRemoteEvents: boolean,
  ): Observable<void> {
    const params = new HttpParams().set('removeRemoteEvents', String(removeRemoteEvents));
    return this.http.delete<void>(
      `${this.baseUrl}/calendar/sync/${provider}/disconnect/${accountId}`,
      { params },
    );
  }

  pushEvent(provider: CalendarSyncProvider, accountId: string, eventId: string): Observable<void> {
    return this.http.post<void>(
      `${this.baseUrl}/calendar/sync/${provider}/push/${accountId}/${eventId}`,
      {},
    );
  }
}
