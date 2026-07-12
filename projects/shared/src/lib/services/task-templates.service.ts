import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import {
  ApplyTaskTemplateRequest,
  CreateTaskTemplateRequest,
  OpsTask,
  TaskTemplate,
} from '../models/task.models';
import { API_BASE_URL } from './api-base-url.token';

/** PRD Module 10 — task-plan templates (`task_templates`/`task_template_items`). */
@Injectable({ providedIn: 'root' })
export class TaskTemplatesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  list() {
    return this.http
      .get<ApiSuccessEnvelope<TaskTemplate[]>>(`${this.baseUrl}/task-templates`)
      .pipe(map((envelope) => envelope.data));
  }

  create(request: CreateTaskTemplateRequest) {
    return this.http
      .post<ApiSuccessEnvelope<TaskTemplate>>(`${this.baseUrl}/task-templates`, request)
      .pipe(map((envelope) => envelope.data));
  }

  /**
   * Returns only the newly created tasks — re-applying the same template to the
   * same matter is idempotent (matched by a `templateKey`) and returns `[]` on
   * repeat calls rather than an error.
   */
  applyToMatter(matterId: string, templateId: string, request: ApplyTaskTemplateRequest) {
    return this.http
      .post<ApiSuccessEnvelope<OpsTask[]>>(
        `${this.baseUrl}/matters/${matterId}/apply-task-template/${templateId}`,
        request,
      )
      .pipe(map((envelope) => envelope.data));
  }
}
