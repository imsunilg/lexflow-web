import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import {
  CreateNumberSeriesRequest,
  NumberSeriesDto,
  NumberSeriesPreview,
  UpdateNumberSeriesPatternRequest,
} from '../models/settings.models';
import { API_BASE_URL } from './api-base-url.token';

/**
 * `NumberSeriesController` (`api/v1/settings/number-series`, PRD Module 15 §10).
 * Tokens are `{SEQ}`/`{SEQ:n}`, `{SERIES}`, `{FY}`, `{BR}` only — see
 * `settings.models.ts`'s file-header comment. `preview` is non-consuming
 * (`PeekNext`) and is guaranteed to match the actual next-generated number.
 */
@Injectable({ providedIn: 'root' })
export class NumberSeriesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  list() {
    return this.http
      .get<ApiSuccessEnvelope<NumberSeriesDto[]>>(`${this.baseUrl}/settings/number-series`)
      .pipe(map((envelope) => envelope.data));
  }

  create(request: CreateNumberSeriesRequest) {
    return this.http
      .post<ApiSuccessEnvelope<NumberSeriesDto>>(`${this.baseUrl}/settings/number-series`, request)
      .pipe(map((envelope) => envelope.data));
  }

  updatePattern(id: string, request: UpdateNumberSeriesPatternRequest) {
    return this.http
      .put<ApiSuccessEnvelope<NumberSeriesDto>>(
        `${this.baseUrl}/settings/number-series/${id}`,
        request,
      )
      .pipe(map((envelope) => envelope.data));
  }

  delete(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/settings/number-series/${id}`);
  }

  preview(id: string) {
    return this.http
      .get<ApiSuccessEnvelope<NumberSeriesPreview>>(
        `${this.baseUrl}/settings/number-series/${id}/preview`,
      )
      .pipe(map((envelope) => envelope.data));
  }
}
