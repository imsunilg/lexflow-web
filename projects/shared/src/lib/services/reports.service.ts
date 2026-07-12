import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import {
  ReportCatalogItem,
  ReportRunDto,
  ReportRunOutcome,
  ReportRunParams,
} from '../models/reports.models';
import { API_BASE_URL } from './api-base-url.token';

/**
 * Standard-report catalog, run, run-status, and export
 * (`ReportsController` — catalog/{key}/run/runs/export routes). See
 * `reports.models.ts`'s file-header doc comment for the async-run and
 * export-shape caveats.
 */
@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  catalog(): Observable<ReportCatalogItem[]> {
    return this.http
      .get<ApiSuccessEnvelope<ReportCatalogItem[]>>(`${this.baseUrl}/reports/catalog`)
      .pipe(map((envelope) => envelope.data));
  }

  runStandard(key: string, params: ReportRunParams): Observable<ReportRunOutcome> {
    return this.http
      .post<ApiSuccessEnvelope<ReportRunOutcome>>(`${this.baseUrl}/reports/${key}/run`, params)
      .pipe(map((envelope) => envelope.data));
  }

  runCustom(definitionId: string): Observable<ReportRunOutcome> {
    return this.http
      .post<ApiSuccessEnvelope<ReportRunOutcome>>(
        `${this.baseUrl}/reports/custom/${definitionId}/run`,
        {},
      )
      .pipe(map((envelope) => envelope.data));
  }

  getRun(jobId: string): Observable<ReportRunDto> {
    return this.http
      .get<ApiSuccessEnvelope<ReportRunDto>>(`${this.baseUrl}/reports/runs/${jobId}`)
      .pipe(map((envelope) => envelope.data));
  }

  export(runId: string, format: 'pdf' | 'xlsx' | 'csv'): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/reports/export/${runId}`, {
      params: { format },
      responseType: 'blob',
    });
  }
}
