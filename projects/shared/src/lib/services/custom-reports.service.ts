import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import { CustomReportDefinitionInput, ReportDefinitionDto } from '../models/reports.models';
import { API_BASE_URL } from './api-base-url.token';

/**
 * Custom report builder definitions (`ReportsController` custom routes).
 * Every column/filter/group-by/aggregate/sort field is validated server-side
 * against `ReportFieldCatalog` (mirrored client-side as `REPORT_FIELD_CATALOG`
 * in `reports.models.ts` — no endpoint exists to fetch it live).
 */
@Injectable({ providedIn: 'root' })
export class CustomReportsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  list(): Observable<ReportDefinitionDto[]> {
    return this.http
      .get<ApiSuccessEnvelope<ReportDefinitionDto[]>>(`${this.baseUrl}/reports/custom`)
      .pipe(map((envelope) => envelope.data));
  }

  create(input: CustomReportDefinitionInput): Observable<ReportDefinitionDto> {
    return this.http
      .post<ApiSuccessEnvelope<ReportDefinitionDto>>(`${this.baseUrl}/reports/custom`, input)
      .pipe(map((envelope) => envelope.data));
  }

  update(id: string, input: CustomReportDefinitionInput): Observable<ReportDefinitionDto> {
    return this.http
      .put<ApiSuccessEnvelope<ReportDefinitionDto>>(`${this.baseUrl}/reports/custom/${id}`, input)
      .pipe(map((envelope) => envelope.data));
  }
}
