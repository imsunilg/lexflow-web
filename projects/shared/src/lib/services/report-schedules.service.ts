import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import { ReportScheduleDto, ReportScheduleInput } from '../models/reports.models';
import { API_BASE_URL } from './api-base-url.token';

/**
 * Report schedules (`POST/GET /reports/schedule(s)`). A real Hangfire
 * recurring job (`ReportSchedulerService.RunDueSchedulesAsync`) delivers
 * these — but only to recipients with a firm `userId`; email-only recipients
 * are recorded and never actually sent an attachment (no attachment-capable
 * SMTP sender exists yet server-side). The schedule dialog must surface this.
 */
@Injectable({ providedIn: 'root' })
export class ReportSchedulesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  list(): Observable<ReportScheduleDto[]> {
    return this.http
      .get<ApiSuccessEnvelope<ReportScheduleDto[]>>(`${this.baseUrl}/reports/schedules`)
      .pipe(map((envelope) => envelope.data));
  }

  create(input: ReportScheduleInput): Observable<ReportScheduleDto> {
    return this.http
      .post<ApiSuccessEnvelope<ReportScheduleDto>>(`${this.baseUrl}/reports/schedule`, input)
      .pipe(map((envelope) => envelope.data));
  }
}
