import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import {
  UpsertWorkflowRuleRequest,
  WorkflowRuleDto,
  WorkflowRunDto,
} from '../models/workflow-rules.models';
import { API_BASE_URL } from './api-base-url.token';

/** `WorkflowRulesController` (`api/v1/workflow-rules`, PRD §23). See `workflow-rules.models.ts`'s file-header comment for the confirmed-live trigger/condition/action subset. */
@Injectable({ providedIn: 'root' })
export class WorkflowRulesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  list() {
    return this.http
      .get<ApiSuccessEnvelope<WorkflowRuleDto[]>>(`${this.baseUrl}/workflow-rules`)
      .pipe(map((envelope) => envelope.data));
  }

  get(id: string) {
    return this.http
      .get<ApiSuccessEnvelope<WorkflowRuleDto>>(`${this.baseUrl}/workflow-rules/${id}`)
      .pipe(map((envelope) => envelope.data));
  }

  create(request: UpsertWorkflowRuleRequest) {
    return this.http
      .post<ApiSuccessEnvelope<WorkflowRuleDto>>(`${this.baseUrl}/workflow-rules`, request)
      .pipe(map((envelope) => envelope.data));
  }

  update(id: string, request: UpsertWorkflowRuleRequest) {
    return this.http
      .put<ApiSuccessEnvelope<WorkflowRuleDto>>(`${this.baseUrl}/workflow-rules/${id}`, request)
      .pipe(map((envelope) => envelope.data));
  }

  delete(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/workflow-rules/${id}`);
  }

  /** One-shot test against a caller-supplied sample payload — not a persistent simulation mode (none exists). */
  test(id: string, samplePayload: Record<string, unknown>) {
    return this.http
      .post<ApiSuccessEnvelope<WorkflowRunDto>>(
        `${this.baseUrl}/workflow-rules/${id}/test`,
        samplePayload,
      )
      .pipe(map((envelope) => envelope.data));
  }

  runs(id: string) {
    return this.http
      .get<ApiSuccessEnvelope<WorkflowRunDto[]>>(`${this.baseUrl}/workflow-rules/${id}/runs`)
      .pipe(map((envelope) => envelope.data));
  }

  seedDefaults() {
    return this.http.post<ApiSuccessEnvelope<unknown>>(
      `${this.baseUrl}/workflow-rules/seed-defaults`,
      {},
    );
  }
}
