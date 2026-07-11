export const CASE_STATUSES = ['Active', 'Disposed', 'SineDie', 'Transferred'] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const HEARING_STATUSES = ['Scheduled', 'Held', 'Adjourned', 'Cancelled'] as const;
export type HearingStatus = (typeof HEARING_STATUSES)[number];

export const EVIDENCE_KINDS = ['Documentary', 'Electronic', 'Physical'] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export const WITNESS_EXAM_STATUSES = [
  'ToBeExamined',
  'ChiefDone',
  'CrossDone',
  'Discharged',
] as const;
export type WitnessExamStatus = (typeof WITNESS_EXAM_STATUSES)[number];

/** Court master list is tenant-configurable (PRD Module 5) — no lookup endpoint is documented, so `court-lookups.service.ts` degrades to an empty list on 404, same pattern as lead sources/lost reasons. */
export interface Court {
  id: string;
  name: string;
}

export interface CourtCase {
  id: string;
  matterId: string;
  courtId: string;
  caseType: string;
  caseNumber: string;
  caseYear: number;
  cnrNumber: string | null;
  filingDate: string | null;
  stage: string | null;
  judgeId: string | null;
  courtroom: string | null;
  status: CaseStatus;
  appealOfCaseId: string | null;
  createdAt: string;
}

export interface CreateCourtCaseRequest {
  courtId: string;
  caseType: string;
  caseNumber: string;
  caseYear: number;
  cnrNumber?: string | null;
  filingDate?: string | null;
  stage?: string | null;
  judgeId?: string | null;
  courtroom?: string | null;
}

export interface FileAppealRequest {
  targetCourtId: string;
  carryDocumentIds?: string[];
}

export interface CaseParty {
  id: string;
  caseId: string;
  partyRole: string;
  name: string;
  advocateName: string | null;
  advocateUserId: string | null;
  contact: string | null;
}

export interface CasePartyInput {
  partyRole: string;
  name: string;
  advocateName?: string | null;
  advocateUserId?: string | null;
  contact?: string | null;
}

export interface Hearing {
  id: string;
  caseId: string;
  date: string;
  time: string | null;
  courtTz: string;
  purpose: string | null;
  courtroom: string | null;
  assignedLawyerId: string | null;
  status: HearingStatus;
}

export interface CreateHearingRequest {
  date: string;
  time?: string | null;
  purpose?: string | null;
  courtroom?: string | null;
  assignedLawyerId?: string | null;
}

export interface NextHearingInput {
  date: string;
  time?: string | null;
  purpose?: string | null;
}

export interface OrderInput {
  orderDate: string;
  gist?: string | null;
  complianceDue?: string | null;
}

/**
 * `POST /hearings/{id}/outcome` — exactly one of `nextHearing` / `sineDie` /
 * `disposed` must be set (mirrors `RecordHearingOutcomeCommandValidator`'s
 * exactly-one-of rule and the DB's BR-6 deferred-constraint trigger).
 */
export interface RecordHearingOutcomeRequest {
  summary: string;
  adjournReason?: string | null;
  nextHearing?: NextHearingInput | null;
  sineDie?: boolean;
  disposed?: boolean;
  orders?: OrderInput[];
  createComplianceTask?: boolean;
}

export interface RecordHearingOutcomeResult {
  outcomeId: string;
  nextHearing: Hearing | null;
  createdOrderIds: string[];
  createdReminderIds: string[];
  complianceTaskId: string | null;
}

export interface CourtOrder {
  id: string;
  caseId: string;
  hearingId: string | null;
  orderDate: string;
  gist: string | null;
  complianceDue: string | null;
  documentId: string | null;
}

export interface EvidenceItem {
  id: string;
  caseId: string;
  exhibitNo: string | null;
  kind: EvidenceKind;
  description: string | null;
  marked: boolean;
  objected: boolean;
  custodyStatus: string | null;
  documentId: string | null;
}

export interface EvidenceItemInput {
  exhibitNo?: string | null;
  kind: EvidenceKind;
  description?: string | null;
}

/** Append-only (PRD AC-CC5) — edits create new log rows, never overwrite. */
export interface EvidenceCustodyLogEntry {
  id: string;
  evidenceId: string;
  action: string;
  holder: string | null;
  at: string;
  note: string | null;
}

export interface EvidenceCustodyLogInput {
  action: string;
  holder?: string | null;
  note?: string | null;
}

export interface Witness {
  id: string;
  caseId: string;
  name: string;
  side: string | null;
  contact: string | null;
  examStatus: WitnessExamStatus;
  scheduledOn: string | null;
}

export interface WitnessInput {
  name: string;
  side?: string | null;
  scheduledOn?: string | null;
}

export interface ArgumentNote {
  id: string;
  caseId: string;
  hearingId: string | null;
  stage: string | null;
  body: string;
  citationJudgmentIds: string[];
}

export interface ArgumentNoteInput {
  hearingId?: string | null;
  stage?: string | null;
  body: string;
  citationJudgmentIds?: string[];
}

/**
 * ASSUMPTION: no PRD-documented endpoint exposes `court_holidays` (confirmed
 * gap — the table/entity exist server-side but nothing reads them yet). This
 * is the natural read route for the hearing-outcome dialog's "next-date
 * picker aware of court holidays" requirement; degrades to an empty list
 * (no warning shown) if it 404s, same pattern as other documented gaps.
 */
export interface CourtHoliday {
  courtId: string;
  holidayDate: string;
  name: string;
}
