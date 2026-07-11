import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import {
  ActivityItem,
  AnalyticsRange,
  CaseStatsSummary,
  ClientSummaryWidgetData,
  DeadlineItem,
  HearingTodayItem,
  LawyerPerformanceItem,
  LeadPipelineStage,
  MatterSummaryItem,
  OutstandingSummary,
  RevenueSummary,
  TaskPendingItem,
  TrustBalanceSummary,
} from '../models/dashboard.models';
import { API_BASE_URL } from './api-base-url.token';

function rangeParams(range?: AnalyticsRange): HttpParams {
  let params = new HttpParams();
  if (range) {
    params = params.set('range', range.preset).set('start', range.start).set('end', range.end);
  }
  return params;
}

/**
 * One method per `GET /dashboard/widgets/*` route (PRD Module 1). The routes for
 * `hearings-today`, `tasks-pending`, `revenue`, `outstanding`, `deadlines`,
 * `activity`, `case-stats`, and `lawyer-performance` are documented verbatim in
 * the PRD; `matter-summary`, `client-summary`, `lead-pipeline`, and
 * `trust-balance` complete the 12-widget catalog but have no documented route —
 * their paths here are an ASSUMPTION following the same `/dashboard/widgets/{id}`
 * convention as the documented ones. No `DashboardController` exists in
 * lexflow-api yet, so every call here 404s until the backend ships; each widget
 * component treats that as its normal error-card state (PRD "each widget
 * isolates failures ... never blank page"), not a hard failure of the page.
 */
@Injectable({ providedIn: 'root' })
export class DashboardWidgetsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  private get<T>(widgetPath: string, params?: HttpParams): Observable<T> {
    return this.http
      .get<ApiSuccessEnvelope<T>>(`${this.baseUrl}/dashboard/widgets/${widgetPath}`, { params })
      .pipe(map((envelope) => envelope.data));
  }

  hearingsToday(): Observable<HearingTodayItem[]> {
    return this.get<HearingTodayItem[]>('hearings-today');
  }

  tasksPending(): Observable<TaskPendingItem[]> {
    return this.get<TaskPendingItem[]>('tasks-pending');
  }

  revenue(range: AnalyticsRange): Observable<RevenueSummary> {
    return this.get<RevenueSummary>('revenue', rangeParams(range));
  }

  outstanding(): Observable<OutstandingSummary> {
    return this.get<OutstandingSummary>('outstanding');
  }

  deadlines(days = 14): Observable<DeadlineItem[]> {
    return this.get<DeadlineItem[]>('deadlines', new HttpParams().set('days', days));
  }

  activity(limit = 20): Observable<ActivityItem[]> {
    return this.get<ActivityItem[]>('activity', new HttpParams().set('limit', limit));
  }

  caseStats(range: AnalyticsRange): Observable<CaseStatsSummary> {
    return this.get<CaseStatsSummary>('case-stats', rangeParams(range));
  }

  lawyerPerformance(range: AnalyticsRange): Observable<LawyerPerformanceItem[]> {
    return this.get<LawyerPerformanceItem[]>('lawyer-performance', rangeParams(range));
  }

  matterSummary(range: AnalyticsRange): Observable<MatterSummaryItem[]> {
    return this.get<MatterSummaryItem[]>('matter-summary', rangeParams(range));
  }

  clientSummary(range: AnalyticsRange): Observable<ClientSummaryWidgetData> {
    return this.get<ClientSummaryWidgetData>('client-summary', rangeParams(range));
  }

  leadPipeline(range: AnalyticsRange): Observable<LeadPipelineStage[]> {
    return this.get<LeadPipelineStage[]>('lead-pipeline', rangeParams(range));
  }

  trustBalance(): Observable<TrustBalanceSummary> {
    return this.get<TrustBalanceSummary>('trust-balance');
  }
}
