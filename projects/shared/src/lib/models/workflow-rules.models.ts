/**
 * PRD §23 — Workflow Rules (Automation Engine). Backend confirmed real
 * (`WorkflowRulesController` at `api/v1/workflow-rules`, a Hangfire-driven
 * outbox dispatcher, `ops.workflow_runs` execution log) but narrower than the
 * PRD's ideal — the builder below is scoped to only what can actually fire or
 * execute:
 *
 * - `conditionsJson`/`actionsJson` are raw JSON strings server-side, not typed
 *   sub-objects — this frontend serializes `WorkflowConditionGroup`/
 *   `WorkflowAction[]` into those strings itself.
 * - Trigger catalog: only 5 of the PRD's 12 entity-event triggers are ever
 *   actually published anywhere in the codebase (`lead.created`,
 *   `client.created`, `task.overdue`, `document.uploaded`,
 *   `hearing.outcome_recorded`). `WORKFLOW_TRIGGERS` below lists only these —
 *   presenting the other 7 (or the seed data's own dormant trigger names,
 *   e.g. `matter.limitation_date.approaching`) would create rules that
 *   silently never fire, so the trigger picker doesn't offer them.
 * - No cron/schedule trigger and no generic date-proximity trigger exist as
 *   first-class types — `TriggerEvent` is always a single event-name string.
 * - Conditions: field comparisons (=,≠,>,<,in,contains) and nested AND/OR
 *   groups are real (`WorkflowRuleEngine.EvaluateConditions`), evaluated by
 *   dot-path traversal into the trigger's own event payload only — there is
 *   no related-entity lookup and no business-hours predicate, so the builder
 *   doesn't offer either.
 * - Actions: `notify`, `escalate`, `create_task`, `update_field` (only the
 *   `status` field is actually honored — any other field silently no-ops),
 *   `assign` (least-loaded only — there is no round-robin mode), `webhook`,
 *   `wait` are the real, executed action types. Distinct "send email/SMS/WA"
 *   actions and a "start approval chain" action don't exist — `notify` with a
 *   `channels` array is the closest real equivalent to the former, and the
 *   latter is simply not offered.
 * - There is no persistent "simulation mode (log-only, 24h)" toggle on a rule
 *   — only a one-shot `POST {id}/test` against a caller-supplied sample
 *   payload. The builder's "Simulate" step is this one-shot test, not a
 *   standing dry-run mode.
 */

export const WORKFLOW_TRIGGERS = [
  { event: 'lead.created', label: 'Lead created' },
  { event: 'client.created', label: 'Client created' },
  { event: 'task.overdue', label: 'Task overdue' },
  { event: 'document.uploaded', label: 'Document uploaded' },
  { event: 'hearing.outcome_recorded', label: 'Hearing outcome recorded' },
] as const;

export const WORKFLOW_CONDITION_OPERATORS = [
  'eq',
  'neq',
  'gt',
  'lt',
  'gte',
  'lte',
  'in',
  'contains',
] as const;
export type WorkflowConditionOperator = (typeof WORKFLOW_CONDITION_OPERATORS)[number];

export interface WorkflowConditionLeaf {
  field: string;
  op: WorkflowConditionOperator | string;
  value: string;
}

/** `{}` (empty) matches everything; `and`/`or` nest recursively; a leaf carries no `and`/`or` key. */
export interface WorkflowConditionGroup {
  and?: (WorkflowConditionGroup | WorkflowConditionLeaf)[];
  or?: (WorkflowConditionGroup | WorkflowConditionLeaf)[];
}

export const WORKFLOW_ACTION_TYPES = [
  'notify',
  'escalate',
  'create_task',
  'update_field',
  'assign',
  'webhook',
  'wait',
] as const;
export type WorkflowActionType = (typeof WORKFLOW_ACTION_TYPES)[number];

export interface WorkflowAction {
  type: WorkflowActionType | string;
  /** Free-form per-type config (e.g. `{ channels: ['email'] }` for `notify`, `{ pool: [...] }` for `assign`, `{ url }` for `webhook`, `{ durationMinutes }` for `wait`). Kept opaque since each action type has its own shape. */
  config: Record<string, unknown>;
}

export interface WorkflowRuleDto {
  id: string;
  name: string;
  triggerEvent: string;
  conditionsJson: string;
  actionsJson: string;
  active: boolean;
  runOrder: number;
}

export interface UpsertWorkflowRuleRequest {
  name: string;
  triggerEvent: string;
  conditionsJson: string;
  actionsJson: string;
  active: boolean;
  runOrder: number;
}

export type WorkflowRunStatus = 'Pending' | 'Succeeded' | 'Failed';

export interface WorkflowRunDto {
  id: string;
  ruleId: string;
  triggerRef: string | null;
  status: WorkflowRunStatus;
  executedAt: string | null;
  resultJson: string | null;
}
