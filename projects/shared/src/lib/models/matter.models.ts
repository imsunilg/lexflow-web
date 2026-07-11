export const MATTER_TYPES = [
  'Litigation',
  'Advisory',
  'Transactional',
  'Arbitration',
  'Compliance',
] as const;
export type MatterType = (typeof MATTER_TYPES)[number];

export const MATTER_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;
export type MatterPriority = (typeof MATTER_PRIORITIES)[number];

export const MATTER_STATUSES = ['Open', 'OnHold', 'Closed', 'Reopened'] as const;
export type MatterStatus = (typeof MATTER_STATUSES)[number];

export const MATTER_OUTCOMES = ['Won', 'Lost', 'Settled', 'Withdrawn'] as const;
export type MatterOutcome = (typeof MATTER_OUTCOMES)[number];

export const MATTER_PARTY_ROLES = ['Client', 'Opposite', 'Co-party', 'Witness-org'] as const;
export type MatterPartyRole = (typeof MATTER_PARTY_ROLES)[number];

export const IMPORTANT_DATE_KINDS = ['Limitation', 'Filing', 'Compliance', 'Custom'] as const;
export type ImportantDateKind = (typeof IMPORTANT_DATE_KINDS)[number];

export const MATTER_RELATION_TYPES = ['Appeal-of', 'Connected', 'Cross-suit'] as const;
export type MatterRelationType = (typeof MATTER_RELATION_TYPES)[number];

export interface Matter {
  id: string;
  number: string;
  title: string;
  clientId: string;
  matterType: MatterType;
  practiceAreaId: string | null;
  branchId: string | null;
  responsibleLawyerId: string | null;
  priority: MatterPriority;
  status: MatterStatus;
  outcome: MatterOutcome | null;
  openedOn: string;
  closedOn: string | null;
  isPrivate: boolean;
  budget: number | null;
  description: string | null;
  billingArrangementJson: string;
  createdAt: string;
}

export interface MatterFilter {
  status?: MatterStatus;
  matterType?: MatterType;
  practiceAreaId?: string;
  lawyerId?: string;
  priority?: MatterPriority;
  q?: string;
}

export interface SavedMatterView {
  id: string;
  name: string;
  filter: MatterFilter;
}

export interface ConflictMatch {
  name: string;
  score: number;
  sourceType: string;
  sourceId: string;
  matterId: string;
  matterNumber: string;
}

export interface CreateMatterRequest {
  clientId: string;
  title: string;
  matterType: MatterType;
  practiceAreaId?: string | null;
  branchId?: string | null;
  responsibleLawyerId: string;
  priority: MatterPriority;
  description?: string | null;
  openedOn: string;
  budget?: number | null;
  oppositePartyNames?: string[];
  overrideConflict?: boolean;
  conflictOverrideReason?: string | null;
}

export interface UpdateMatterRequest {
  title: string;
  matterType: MatterType;
  practiceAreaId?: string | null;
  branchId?: string | null;
  responsibleLawyerId: string;
  priority: MatterPriority;
  description?: string | null;
  budget?: number | null;
  isPrivate: boolean;
  billingArrangementJson?: string;
}

export interface ChangeMatterStatusRequest {
  toStatus: MatterStatus;
  outcome?: MatterOutcome | null;
  closureNote?: string | null;
}

export interface MatterTeamMember {
  userId: string;
  roleInMatter: string | null;
  rateOverride: number | null;
}

export interface MatterParty {
  id: string;
  matterId: string;
  name: string;
  partyRole: MatterPartyRole;
  advocateName: string | null;
  contact: string | null;
}

export interface MatterPartyInput {
  name: string;
  partyRole: MatterPartyRole;
  advocateName?: string | null;
  contact?: string | null;
}

/** BR-2: cannot be deleted within 30 days of `dueAt` — only "marked satisfied." Severity drives the side-panel badge (own escalation thresholds — see `important-date-severity.util.ts`). */
export interface MatterImportantDate {
  id: string;
  matterId: string;
  kind: ImportantDateKind;
  title: string;
  dueAt: string;
  satisfiedAt: string | null;
  satisfiedNote: string | null;
  severity: string | null;
}

export interface MatterImportantDateInput {
  kind: ImportantDateKind;
  title: string;
  dueAt: string;
  /** ASSUMPTION: no dedicated "mark satisfied" endpoint is documented — sending this via the same `PUT` update call is the natural route, mirroring the domain entity's `MarkSatisfied(note)` behavior method. */
  satisfiedNote?: string | null;
}

export interface MatterExpense {
  id: string;
  matterId: string;
  description: string;
  amount: number;
  incurredOn: string;
  billable: boolean;
}

export interface MatterExpenseInput {
  description: string;
  amount: number;
  incurredOn: string;
  billable: boolean;
}

export interface MatterRelated {
  id: string;
  matterId: string;
  relatedMatterId: string;
  relationType: MatterRelationType;
}

/** AC-M2: merges 6 entity types (hearings, orders, tasks, notes, documents, time entries) chronologically. */
export interface MatterTimelineEntry {
  id: string;
  entryType: string;
  occurredAt: string;
  summary: string;
}

/** AC-M4. */
export interface MatterFinancialSummary {
  billed: number;
  collected: number;
  wip: number;
  expenses: number;
  budgetVariance: number;
  trustBalance: number;
}
