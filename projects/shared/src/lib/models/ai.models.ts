/**
 * Module 16 — AI Features (scoped build: chat assistant, contract review,
 * drafting, research only — the other 8 PRD features like case summary,
 * hearing prediction, voice notes are out of scope here). Backend confirmed
 * real (`AiController` at `api/v1/ai`, `AiAssistantService`) but narrower
 * than the PRD in several places — documented here rather than faked:
 *
 * - Chat is a single request/response, NOT SSE-streamed — `ChatAsync` is a
 *   plain `Task<AiChatResponse>`, no `text/event-stream` anywhere in the
 *   backend. The frontend does not open an EventSource/streaming reader.
 * - Slash commands (`/summarize`, `/draft`, `/research`, `/timeline`) are
 *   NOT parsed server-side — `AiChatRequest.command` exists as a field but
 *   `ChatAsync` never reads it. The frontend dispatches `/research` and
 *   `/summarize` (when a matter/document context is set) to their own real
 *   endpoints itself; `/draft` navigates to the Draft Studio; `/timeline`
 *   has no backing feature in this scoped build and falls through as a
 *   plain chat message (which is exactly what the backend would do with it
 *   anyway).
 * - Citations (`AiCitation`) carry `kind`/`id` but `label` is always `null`
 *   — the frontend resolves a display label itself per `kind` (see
 *   `AiCitationLinkComponent`).
 * - `webGroundedMode` on research is accepted but is a no-op server-side —
 *   it doesn't change retrieval. The UI doesn't imply it does anything yet.
 * - `noAuthorityFound` is a real field, but is produced by a crude
 *   string-match on the LLM's own output (looking for the literal phrase
 *   "no authority found"), not an independent verification gate — treated
 *   as authoritative here since it's the only signal available.
 * - Contract review has NO tracked-changes/redline docx output and NO
 *   configurable firm-playbook rules table — `riskFlags` is just a flat
 *   list of clause-type names the LLM judged high-risk, not
 *   `{rule, severity, explanation}` objects. The UI presents it as such,
 *   honestly.
 * - Contract review only accepts an existing `documentId` — there's no
 *   upload-and-review-in-one-call path; an unsaved file must be uploaded via
 *   `DocumentsService.upload` first to get an id.
 * - Draft generation does NOT auto-fill parties from the matter and does
 *   NOT ground against real firm document templates (both are prose-only
 *   claims in the PRD — the backend renders a literal hardcoded
 *   "(firm default skeleton)" string). There is no regenerate-per-section
 *   capability — only whole-draft regeneration.
 * - BR-19/AC-AI5 ("every AI output requires explicit Save/Insert, never
 *   auto-applies"): every response DTO below carries `isAiGenerated: true`
 *   (structurally guaranteed server-side, not a frontend convention) and a
 *   fixed `disclaimer` string — both are rendered via `AiBadgeComponent`.
 *   There is NO feature-specific "apply"/"save" AI endpoint anywhere — Save
 *   actions in this build call the real, existing `DocumentsService.upload`/
 *   `uploadVersion` endpoints with client-constructed file content, which is
 *   a genuine human-initiated save, not a fabricated AI auto-apply path.
 */

export interface AiChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiChatRequest {
  message: string;
  command?: string | null;
  matterId?: string | null;
  documentId?: string | null;
  history?: AiChatTurn[] | null;
}

export interface AiCitation {
  kind: string;
  id: string;
  label: string | null;
}

export interface AiGeneratedResponse {
  interactionId: string;
  isAiGenerated: boolean;
  disclaimer: string;
}

export interface AiChatResponse extends AiGeneratedResponse {
  text: string;
  citations: AiCitation[];
}

export interface AiContractClause {
  clauseType: string;
  text: string | null;
  riskLevel: 'low' | 'medium' | 'high' | null;
}

export interface AiContractReviewResponse extends AiGeneratedResponse {
  clauses: AiContractClause[];
  riskFlags: string[];
}

export const AI_DRAFT_KINDS = ['notice', 'agreement'] as const;
export type AiDraftKind = (typeof AI_DRAFT_KINDS)[number];

export interface AiDraftRequest {
  kind: AiDraftKind | string;
  matterId: string;
  intakeFields: Record<string, string>;
}

export interface AiDraftResponse extends AiGeneratedResponse {
  draftText: string;
}

export interface AiResearchRequest {
  question: string;
  webGroundedMode: boolean;
}

export interface AiResearchResponse extends AiGeneratedResponse {
  answer: string;
  citations: AiCitation[];
  noAuthorityFound: boolean;
}

/** `rating` must be exactly `1` or `-1` (thumbs up/down) — the server rejects anything else. */
export interface AiFeedbackRequest {
  rating: 1 | -1;
  reason?: string | null;
}
