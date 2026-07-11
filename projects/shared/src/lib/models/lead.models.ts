/** Tenant-configurable pipeline (PRD Module 2) — the `stage` column itself is free text server-side, but this is the seeded default order the UI is built against. */
export const LEAD_PIPELINE_STAGES = [
  'New',
  'Contacted',
  'Consultation Scheduled',
  'Consultation Done',
  'Proposal Sent',
  'Negotiation',
  'Won(Converted)',
  'Lost',
] as const;

export type LeadStage = (typeof LEAD_PIPELINE_STAGES)[number];

/** Kanban columns: every stage except the two terminal ones, which get their own end-of-board treatment. */
export const LEAD_KANBAN_STAGES = LEAD_PIPELINE_STAGES.filter(
  (stage) => stage !== 'Won(Converted)' && stage !== 'Lost',
);

export type LeadStatus = 'Open' | 'Converted' | 'Lost';

export type LeadActivityType = 'call' | 'email' | 'meeting' | 'note';

export interface Lead {
  id: string;
  number: string;
  firstName: string;
  lastName: string | null;
  company: string | null;
  email: string | null;
  phoneE164: string | null;
  sourceId: string | null;
  stage: LeadStage;
  ownerId: string | null;
  branchId: string | null;
  practiceAreaId: string | null;
  score: number;
  issueSummary: string | null;
  opposingParty: string | null;
  budgetBand: string | null;
  status: LeadStatus;
  lostReasonId: string | null;
  convertedClientId: string | null;
  slaFirstContactDueAt: string | null;
  firstContactedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface LeadActivity {
  id: string;
  leadId: string;
  activityType: LeadActivityType;
  direction: string | null;
  durationMin: number | null;
  subject: string | null;
  body: string | null;
  outcome: string | null;
  occurredAt: string;
  loggedBy: string | null;
}

export interface LeadStageHistoryEntry {
  id: string;
  leadId: string;
  fromStage: string | null;
  toStage: string;
  at: string;
  byUser: string | null;
}

/**
 * `GET /leads/{id}` response shape. The PRD doesn't publish `LeadDto`'s exact
 * fields for the detail endpoint (only the list-filter query params and the
 * `convert` request/response are given verbatim) — ASSUMPTION: the detail
 * endpoint nests `activities`/`stageHistory` so the lead-detail 3-pane's
 * activity timeline doesn't need a separate list endpoint (none is
 * documented). If the real API returns a flatter shape, only `LeadsService.get()`
 * needs to change.
 */
export interface LeadDetail extends Lead {
  activities: LeadActivity[];
  stageHistory: LeadStageHistoryEntry[];
}

export interface LeadListFilter {
  stage?: string;
  source?: string;
  owner?: string;
  score?: number;
  createdFrom?: string;
  createdTo?: string;
  q?: string;
  status?: string;
}

/** A user's saved combination of `LeadListFilter` + column/sort prefs for the list view (PRD Module 2 UI: "list view ... saved views"). No saved-view endpoint is documented, so these persist client-side only (per-browser, not synced) — see `saved-lead-views.service.ts`. */
export interface SavedLeadView {
  id: string;
  name: string;
  filter: LeadListFilter;
}

export interface CreateLeadRequest {
  firstName: string;
  lastName?: string | null;
  company?: string | null;
  email?: string | null;
  phoneE164?: string | null;
  sourceId?: string | null;
  ownerId?: string | null;
  branchId?: string | null;
  practiceAreaId?: string | null;
  issueSummary?: string | null;
  opposingParty?: string | null;
  budgetBand?: string | null;
}

export type UpdateLeadRequest = Omit<CreateLeadRequest, 'ownerId' | 'branchId'>;

export interface ChangeLeadStageRequest {
  toStage: string;
  note?: string | null;
}

export interface AddLeadActivityRequest {
  type: LeadActivityType;
  direction?: string | null;
  durationMin?: number | null;
  subject?: string | null;
  body?: string | null;
  outcome?: string | null;
}

export interface AssignLeadRequest {
  userId?: string | null;
  ruleId?: string | null;
}

export interface MatterConversionPayload {
  title: string;
  matterTypeId?: string | null;
  practiceAreaId?: string | null;
  responsibleLawyerId?: string | null;
  oppositeParties?: Array<{ name: string }>;
  billing?: { arrangement: string; rateCardId?: string | null } | null;
}

export interface ConvertLeadRequest {
  createMatter: boolean;
  matter?: MatterConversionPayload | null;
  /** No fees/billing module exists yet server-side (see `ConvertLeadResult` doc) — collected for forward-compat, always sent as `null` today. */
  invoicePayload?: Record<string, unknown> | null;
}

export interface ConvertLeadResult {
  clientId: string;
  /**
   * Always `null` today: `LeadService.ConvertAsync` in lexflow-api throws
   * `MODULE_NOT_AVAILABLE` if `createMatter` or an invoice payload is sent,
   * because the Legal/Fin modules haven't shipped yet — only client-only
   * conversion (`createMatter:false`) currently succeeds. The wizard still
   * collects Matter/Fees steps per the PRD's 3-step spec and surfaces this
   * error clearly rather than pretending it succeeded.
   */
  matterId: string | null;
  invoiceId: string | null;
}

export interface MarkLeadLostRequest {
  reasonId: string;
  note?: string | null;
}

export type DuplicateMatchKind = 'Phone' | 'Email' | 'Name';

export interface DuplicateMatch {
  leadId: string;
  displayName: string;
  email: string | null;
  phoneE164: string | null;
  similarity: number;
  matchKind: DuplicateMatchKind;
}

export type LeadImportBatchStatus = 'Pending' | 'Running' | 'Completed' | 'Failed';

export interface LeadImportBatch {
  id: string;
  fileName: string;
  status: LeadImportBatchStatus;
  totalRows: number;
  successCount: number;
  errorCount: number;
  errorFileBlobPath: string | null;
  startedAt: string | null;
  completedAt: string | null;
  failureReason: string | null;
}

export interface LostReason {
  id: string;
  name: string;
}

export interface LeadSource {
  id: string;
  name: string;
}
