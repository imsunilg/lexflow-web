import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import {
  CommTemplate,
  CreateCommTemplateRequest,
  UpdateCommTemplateRequest,
} from '../models/communication.models';
import { API_BASE_URL } from './api-base-url.token';

/**
 * PRD Module 11/15 — comm templates, actually served at `/settings/templates`
 * (`settings.read.all`/`settings.manage.all`), not `/comm/templates` as the
 * PRD literally states. Neither create nor update can set `dltTemplateId`/
 * `waHsmName` — those entity fields have no write path via any endpoint.
 */
@Injectable({ providedIn: 'root' })
export class CommTemplatesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  list(channel?: string) {
    const params: Record<string, string> = {};
    if (channel) params['channel'] = channel;
    return this.http
      .get<ApiSuccessEnvelope<CommTemplate[]>>(`${this.baseUrl}/settings/templates`, { params })
      .pipe(map((envelope) => envelope.data));
  }

  create(request: CreateCommTemplateRequest) {
    return this.http
      .post<ApiSuccessEnvelope<CommTemplate>>(`${this.baseUrl}/settings/templates`, request)
      .pipe(map((envelope) => envelope.data));
  }

  update(id: string, request: UpdateCommTemplateRequest) {
    return this.http
      .put<ApiSuccessEnvelope<CommTemplate>>(`${this.baseUrl}/settings/templates/${id}`, request)
      .pipe(map((envelope) => envelope.data));
  }

  delete(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/settings/templates/${id}`);
  }
}
