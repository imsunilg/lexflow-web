import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import {
  CreateTaskRequest,
  OpsTask,
  ParsedTaskDraft,
  TaskAssignee,
  TaskAssigneeRole,
  TaskChecklistItem,
  TaskComment,
  TaskFilter,
  TaskWorkload,
  UpdateTaskRequest,
} from '../models/task.models';
import { API_BASE_URL } from './api-base-url.token';

/** PRD Module 10 — Task Management: `POST/GET /tasks`, status, assignees, checklist, comments, dependencies. */
@Injectable({ providedIn: 'root' })
export class TasksService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  list(filter: TaskFilter = {}) {
    const params: Record<string, string> = {};
    if (filter.assigneeId) params['assigneeId'] = filter.assigneeId;
    if (filter.status) params['status'] = filter.status;
    if (filter.priority) params['priority'] = filter.priority;
    if (filter.matterId) params['matterId'] = filter.matterId;
    if (filter.dueFrom) params['dueFrom'] = filter.dueFrom;
    if (filter.dueTo) params['dueTo'] = filter.dueTo;
    if (filter.category) params['category'] = filter.category;
    if (filter.overdue !== undefined) params['overdue'] = String(filter.overdue);

    return this.http
      .get<ApiSuccessEnvelope<OpsTask[]>>(`${this.baseUrl}/tasks`, { params })
      .pipe(map((envelope) => envelope.data));
  }

  get(id: string) {
    return this.http
      .get<ApiSuccessEnvelope<OpsTask>>(`${this.baseUrl}/tasks/${id}`)
      .pipe(map((envelope) => envelope.data));
  }

  create(request: CreateTaskRequest) {
    return this.http
      .post<ApiSuccessEnvelope<OpsTask>>(`${this.baseUrl}/tasks`, request)
      .pipe(map((envelope) => envelope.data));
  }

  update(id: string, request: UpdateTaskRequest) {
    return this.http
      .put<ApiSuccessEnvelope<OpsTask>>(`${this.baseUrl}/tasks/${id}`, request)
      .pipe(map((envelope) => envelope.data));
  }

  delete(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/tasks/${id}`);
  }

  /**
   * The server does not enforce forward-only status adjacency (Done can go back
   * to New, etc.) — it only gates on dependency-block (409 `TASK_BLOCKED`) and
   * mandatory-checklist-incomplete (409 `CHECKLIST_INCOMPLETE`) for the Done
   * transition. Any UI-level "linear flow" restriction is a client-side choice.
   */
  setStatus(id: string, status: string) {
    return this.http
      .post<ApiSuccessEnvelope<OpsTask>>(`${this.baseUrl}/tasks/${id}/status`, { status })
      .pipe(map((envelope) => envelope.data));
  }

  listAssignees(taskId: string) {
    return this.http
      .get<ApiSuccessEnvelope<TaskAssignee[]>>(`${this.baseUrl}/tasks/${taskId}/assignees`)
      .pipe(map((envelope) => envelope.data));
  }

  addAssignee(taskId: string, userId: string, role: TaskAssigneeRole) {
    return this.http.post<void>(`${this.baseUrl}/tasks/${taskId}/assignees`, { userId, role });
  }

  removeAssignee(taskId: string, userId: string) {
    return this.http.delete<void>(`${this.baseUrl}/tasks/${taskId}/assignees/${userId}`);
  }

  listChecklist(taskId: string) {
    return this.http
      .get<ApiSuccessEnvelope<TaskChecklistItem[]>>(`${this.baseUrl}/tasks/${taskId}/checklist`)
      .pipe(map((envelope) => envelope.data));
  }

  /** No ≤100-item cap is enforced server-side for ad-hoc per-task checklists (only at template-creation time). */
  addChecklistItem(taskId: string, label: string, isMandatory: boolean, sortOrder: number) {
    return this.http
      .post<ApiSuccessEnvelope<TaskChecklistItem>>(`${this.baseUrl}/tasks/${taskId}/checklist`, {
        label,
        isMandatory,
        sortOrder,
      })
      .pipe(map((envelope) => envelope.data));
  }

  /** Toggle-only — there is no label/mandatory edit or delete endpoint for checklist items. */
  setChecklistItemDone(taskId: string, itemId: string, isDone: boolean) {
    return this.http
      .patch<ApiSuccessEnvelope<TaskChecklistItem>>(
        `${this.baseUrl}/tasks/${taskId}/checklist/${itemId}`,
        { isDone },
      )
      .pipe(map((envelope) => envelope.data));
  }

  listComments(taskId: string) {
    return this.http
      .get<ApiSuccessEnvelope<TaskComment[]>>(`${this.baseUrl}/tasks/${taskId}/comments`)
      .pipe(map((envelope) => envelope.data));
  }

  /** Append-only — no edit/delete endpoint exists. */
  addComment(taskId: string, body: string) {
    return this.http
      .post<ApiSuccessEnvelope<TaskComment>>(`${this.baseUrl}/tasks/${taskId}/comments`, { body })
      .pipe(map((envelope) => envelope.data));
  }

  /** Returns bare `dependsOnTaskId` GUIDs, not dependency objects — hydrate labels separately. */
  listDependencies(taskId: string) {
    return this.http
      .get<ApiSuccessEnvelope<string[]>>(`${this.baseUrl}/tasks/${taskId}/dependencies`)
      .pipe(map((envelope) => envelope.data));
  }

  /** On cycle, the server returns 422 `CYCLE_DETECTED` with a plain message string — no structured path array. */
  addDependency(taskId: string, dependsOnTaskId: string) {
    return this.http.post<void>(`${this.baseUrl}/tasks/${taskId}/dependencies`, {
      dependsOnTaskId,
    });
  }

  removeDependency(taskId: string, dependsOnTaskId: string) {
    return this.http.delete<void>(
      `${this.baseUrl}/tasks/${taskId}/dependencies/${dependsOnTaskId}`,
    );
  }

  parse(text: string) {
    return this.http
      .post<ApiSuccessEnvelope<ParsedTaskDraft>>(`${this.baseUrl}/tasks/parse`, { text })
      .pipe(map((envelope) => envelope.data));
  }

  /** One row per owner; no capacity/hours field — pure task-status counts. */
  workload(week: string, teamId?: string) {
    const params: Record<string, string> = { week };
    if (teamId) params['teamId'] = teamId;
    return this.http
      .get<ApiSuccessEnvelope<TaskWorkload[]>>(`${this.baseUrl}/tasks/workload`, { params })
      .pipe(map((envelope) => envelope.data));
  }
}
