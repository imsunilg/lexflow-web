/**
 * PRD Module 12 — Knowledge Base.
 *
 * Field casing: camelCase on the wire, per this engagement's confirmed
 * ASP.NET Core default (no `AddJsonOptions` override found for this module
 * either).
 *
 * Confirmed gaps (backend research pass) — deliberately NOT modeled/built:
 * - "Templates" content type: no table/entity/controller/service exists at
 *   all. `'Template'` only appears as a string literal in the matter-pin
 *   validator's allow-list — pinning one would actually fail server-side
 *   (`ResolveSnapshotTextAsync` has no case for it). Deliberately excluded
 *   from `KB_REF_KINDS` below so the UI never offers a guaranteed-to-fail
 *   option.
 * - Bulk import (`POST /kb/import/acts`/`/kb/import/judgments`): no backend
 *   implementation at all — not built.
 * - Search snippet highlighting: `KbSearchHit.snippet` exists on the wire but
 *   is always `null` (the ES indexer never populates it) — the UI must not
 *   assume a highlighted excerpt is ever present.
 * - True OCR of scanned judgment PDFs: only native PDF text-layer extraction
 *   exists; a scanned page with no text layer behaves identically to a
 *   failed extraction (`ocrStatus: 'Failed'`, metadata-only searchable).
 * - "Cited in N matters": only exposed for judgments
 *   (`GET /kb/judgments/{id}/pin-count`), and that endpoint counts pin rows,
 *   not distinct matters — a judgment pinned twice into the same matter
 *   would over-count. There is no generic, correctly-deduped pin-count
 *   endpoint for Acts/Sections/Articles (the deduped service method exists
 *   server-side but is never wired to a controller).
 * - No chapter/hierarchy tree endpoint for Act sections — only a flat list
 *   (`GET /kb/acts/{id}/sections`) ordered by section number. The tree shown
 *   in the reader is reconstructed client-side from each section's
 *   `parentId`.
 * - No tag-list-for-item endpoint — attached tags aren't independently
 *   fetchable per item (the service method exists but is unwired).
 * - No article version diff — only a flat, publish-time version history.
 */

export const KB_REF_KINDS = ['Act', 'ActSection', 'Judgment', 'Article'] as const;
export type KbRefKind = (typeof KB_REF_KINDS)[number];

export interface KbAct {
  id: string;
  name: string;
  shortCode: string | null;
  jurisdiction: string | null;
  year: number | null;
}

export interface KbActSection {
  id: string;
  actId: string;
  parentId: string | null;
  number: string;
  title: string | null;
  body: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  path: string | null;
}

/** `AmendedOn` closes the current row and creates a new one — append-only history, not an in-place edit. */
export interface AmendKbActSectionRequest {
  newTitle?: string | null;
  newBody?: string | null;
  amendedOn: string;
}

export type KbJudgmentOcrStatus = string;

export interface KbJudgment {
  id: string;
  citation: string;
  neutralCitation: string | null;
  courtId: string | null;
  decisionDate: string | null;
  parties: string | null;
  headnote: string | null;
  documentId: string | null;
  /** Native PDF text-layer extraction only — not true OCR of scanned images. */
  ocrStatus: KbJudgmentOcrStatus;
}

export const KB_ARTICLE_STATUSES = ['Draft', 'InReview', 'Published'] as const;
export type KbArticleStatus = (typeof KB_ARTICLE_STATUSES)[number];

export interface KbArticle {
  id: string;
  title: string;
  body: string | null;
  status: KbArticleStatus;
  version: number;
  authorId: string | null;
  reviewerId: string | null;
  publishedAt: string | null;
}

export interface KbArticleVersion {
  id: string;
  versionNo: number;
  title: string | null;
  body: string | null;
  authorId: string | null;
  createdAt: string;
}

export interface CreateKbArticleRequest {
  title: string;
  body?: string | null;
}

/** Enforced server-side, multi-layer: reviewer must differ from author (a DB trigger backstops the app-layer check too). */
export interface AssignKbArticleReviewerRequest {
  reviewerId: string;
}

export interface ApproveKbArticleRequest {
  reviewerId: string;
}

export interface KbMatterPin {
  id: string;
  matterId: string;
  kbRefKind: KbRefKind;
  kbRefId: string;
  note: string | null;
  /** Frozen at pin time — later edits, unpublishing, or deletion of the source never change this. */
  snapshotText: string | null;
  pinnedBy: string | null;
  pinnedAt: string;
}

export interface PinKbItemRequest {
  kbRefKind: KbRefKind;
  kbRefId: string;
  note?: string | null;
}

export interface KbTag {
  id: string;
  name: string;
}

export interface KbRefRequest {
  kbRefKind: KbRefKind;
  kbRefId: string;
}

export interface KbTagRefRequest extends KbRefRequest {
  tagName: string;
}

export interface KbCollection {
  id: string;
  name: string;
  description: string | null;
}

export interface CreateKbCollectionRequest {
  name: string;
  description?: string | null;
}

export interface KbCollectionItem {
  id: string;
  kbRefKind: KbRefKind;
  kbRefId: string;
  sortOrder: number;
}

export interface KbBookmark {
  id: string;
  kbRefKind: KbRefKind;
  kbRefId: string;
}

export interface KbSearchHit {
  kind: string;
  id: string;
  title: string;
  score: number;
  /** Always `null` in practice — the field exists on the wire but the ES indexer never populates it. */
  snippet: string | null;
}

export interface KbSearchResult {
  directSection: KbActSection | null;
  directJudgment: KbJudgment | null;
  hits: KbSearchHit[];
  isFreeformFallback: boolean;
}

export interface KbSearchParams {
  q: string;
  type?: string;
  courtId?: string;
  yearFrom?: number;
  tag?: string;
}
