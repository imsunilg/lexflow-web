/**
 * PRD Module 10 — Task Management.
 *
 * Field casing: camelCase on the wire, per this engagement's confirmed
 * ASP.NET Core default (no `AddJsonOptions` override found in `Program.cs`).
 *
 * Confirmed gaps (backend research pass) — deliberately NOT modeled/built:
 * - Task attachments: no entity/table/endpoint exists at all.
 * - Recurring tasks / RRULE: `recurrenceId` is a bare grouping GUID with no
 *   backing table or generation logic — there is no real recurrence engine.
 * - Structured cycle-path on 422 `CYCLE_DETECTED`: the server returns a plain
 *   message string, not a `path: Guid[]`.
 * - Checklist/comment edit or delete: only add + (for checklist) toggle-done
 *   exist server-side.
 */

export const OPS_TASK_STATUSES = ['New', 'InProgress', 'InReview', 'Done', 'Cancelled'] as const;
export type OpsTaskStatus = (typeof OPS_TASK_STATUSES)[number];

export const OPS_TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const;
export type OpsTaskPriority = (typeof OPS_TASK_PRIORITIES)[number];

/** Note the literal hyphen in `Follow-up` — matches the server's FluentValidation allow-list exactly. */
export const OPS_TASK_CATEGORIES = [
  'Filing',
  'Drafting',
  'Research',
  'Compliance',
  'Follow-up',
  'Admin',
] as const;
export type OpsTaskCategory = (typeof OPS_TASK_CATEGORIES)[number];

/** Lowercase, unlike every other enum here — matches the server's allow-list exactly. */
export const TASK_ASSIGNEE_ROLES = ['owner', 'collaborator', 'watcher'] as const;
export type TaskAssigneeRole = (typeof TASK_ASSIGNEE_ROLES)[number];

export interface OpsTask {
  id: string;
  number: string | null;
  title: string;
  description: string | null;
  matterId: string | null;
  clientId: string | null;
  ownerId: string | null;
  dueAt: string | null;
  priority: OpsTaskPriority;
  category: OpsTaskCategory | null;
  status: OpsTaskStatus;
  progressPct: number;
  recurrenceId: string | null;
  templateKey: string | null;
}

export interface TaskAssignee {
  taskId: string;
  userId: string;
  role: TaskAssigneeRole;
}

export interface TaskChecklistItem {
  id: string;
  taskId: string;
  label: string;
  isDone: boolean;
  isMandatory: boolean;
  sortOrder: number;
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string | null;
  body: string;
  createdAt: string;
}

/** Per-owner counts for a given ISO week — no capacity/hours field exists server-side. */
export interface TaskWorkload {
  userId: string;
  new: number;
  inProgress: number;
  inReview: number;
  done: number;
  overdue: number;
  total: number;
}

export interface TaskTemplateItem {
  title: string;
  relativeDueDays: number;
  category: OpsTaskCategory | null;
  sortOrder: number;
  isMandatory: boolean;
}

export interface TaskTemplate {
  id: string;
  name: string;
  matterType: string | null;
  isActive: boolean;
  items: TaskTemplateItem[];
}

export interface TaskFilter {
  assigneeId?: string;
  status?: OpsTaskStatus;
  priority?: OpsTaskPriority;
  matterId?: string;
  dueFrom?: string;
  dueTo?: string;
  category?: OpsTaskCategory;
  overdue?: boolean;
}

export interface CreateTaskRequest {
  title: string;
  description?: string | null;
  matterId?: string | null;
  clientId?: string | null;
  ownerId?: string | null;
  dueAt?: string | null;
  priority: OpsTaskPriority;
  category?: OpsTaskCategory | null;
}

export type UpdateTaskRequest = CreateTaskRequest;

/**
 * `POST /tasks/parse` is a real endpoint, but a fixed 4-token regex parser, not
 * an NLU model — it only recognizes `!priority`, `@mention`, a `PREFIX-1234`
 * matter code, and `today|tomorrow|next <weekday>|in N days` due-date phrases.
 * The composer's preview must reflect exactly these tokens, not free-form
 * date/entity extraction.
 */
export interface ParsedTaskDraft {
  title: string;
  matterId: string | null;
  matterNumber: string | null;
  assigneeUserId: string | null;
  assigneeMention: string | null;
  dueAt: string | null;
  priority: OpsTaskPriority;
}

export interface CreateTaskTemplateRequest {
  name: string;
  matterType?: string | null;
  items: TaskTemplateItem[];
}

/** The server computes each generated task's due date as `relativeFromDate + item.relativeDueDays`. */
export interface ApplyTaskTemplateRequest {
  relativeFromDate: string;
}
