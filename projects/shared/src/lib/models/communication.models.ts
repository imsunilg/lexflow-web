/**
 * PRD Module 11 — Communication.
 *
 * Field casing: camelCase on the wire, per this engagement's confirmed
 * ASP.NET Core default (no `AddJsonOptions` override found for this module
 * either).
 *
 * Confirmed gaps (backend research pass) — deliberately NOT modeled/built:
 * - No BCC-dropbox address exists anywhere server-side (no field on
 *   `Mailbox`) — only the inbound sender-matching logic it would feed. There
 *   is nothing to display as "BCC this address to file email."
 * - Email has no template/merge-field application, no send-later scheduling,
 *   no open/click tracking on the send path at all — `SendEmailRequest` has
 *   none of these fields. The composer's "template + merge preview" for
 *   email is a client-side-only convenience: it fetches a `Channel: 'Email'`
 *   template, substitutes `{{var}}` locally, and sends the *resulting* HTML
 *   as `bodyHtml` — the server never sees a template reference for email.
 * - SMS/WhatsApp templates DO have server-side variable substitution — the
 *   client sends raw `variables`, the server interpolates. The composer's
 *   "merge preview" for those channels is a local mirror of that same naive
 *   `{{key}}` replace, purely for UX, before the real send call.
 * - `CommTemplateDto` has `dltTemplateId`/`waHsmName` fields, but neither the
 *   create nor update endpoint accepts them — those fields can only ever be
 *   `null` via the API. No UI control is built for setting them.
 * - `GET /comm/timeline` only accepts `clientId`, never `matterId` — there is
 *   no per-matter communication timeline. The Matter 360° embed passes the
 *   matter's `clientId` instead and says so in the UI.
 * - WhatsApp's 24h session window has no dedicated "is it open" endpoint —
 *   it's derived from the latest **inbound** message's `windowExpiresAt` in
 *   that client's message history.
 * - Chat has no unread/last-read tracking server-side at all — the client
 *   must track "last seen `seq`" itself (e.g. in memory per session).
 * - Video meetings (Zoom/Teams/Meet) and AI meeting summaries: no backend
 *   implementation found at all — not built.
 */

export const COMM_CHANNELS = ['Email', 'SMS', 'WhatsApp', 'Call'] as const;
export type CommChannel = (typeof COMM_CHANNELS)[number];

// ---- Email ----

export interface EmailThread {
  id: string;
  subject: string | null;
  matterId: string | null;
  clientId: string | null;
  mailboxId: string | null;
  lastMessageAt: string | null;
}

export interface EmailMessage {
  id: string;
  threadId: string | null;
  messageIdHdr: string;
  direction: string;
  fromAddr: string | null;
  toAddrs: string[];
  subject: string | null;
  bodyHtmlSanitized: string | null;
  hasAttachments: boolean;
  sentAt: string;
}

export interface EmailAttachmentInput {
  documentId: string;
  filename: string;
  mime: string;
  /** Base64-encoded — the wire format is JSON, not multipart/form-data. */
  content: string;
}

/** No template/merge-field/send-later/tracking fields exist — see file header. */
export interface SendEmailRequest {
  mailboxId: string;
  toAddresses: string[];
  subject: string;
  bodyHtml: string;
  attachments?: EmailAttachmentInput[] | null;
  inReplyToMessageIdHdr?: string | null;
  matterId?: string | null;
  clientId?: string | null;
}

export interface LinkEmailThreadRequest {
  matterId: string;
  clientId?: string | null;
}

export interface ConnectEmailAccountRequest {
  provider: string;
  redirectUri: string;
}

// ---- SMS ----

export interface SmsMessage {
  id: string;
  clientId: string | null;
  matterId: string | null;
  direction: string;
  fromNumber: string | null;
  toNumber: string | null;
  body: string | null;
  dltTemplateId: string | null;
  provider: string | null;
  providerMessageId: string | null;
  status: string;
  sentAt: string;
}

/**
 * DLT enforcement is real and server-side: if the tenant's SMS gateway config
 * has `dltRequired` (default true when unset), a send without a `templateId`
 * carrying a `dltTemplateId` is rejected with 422 `DLT_TEMPLATE_REQUIRED` —
 * under the default config, `freeformBody` sends are effectively always
 * rejected. Prefer template-based sends in the UI.
 */
export interface SendSmsRequest {
  clientId?: string | null;
  matterId?: string | null;
  toNumber: string;
  templateId?: string | null;
  freeformBody?: string | null;
  variables?: Record<string, string> | null;
}

// ---- WhatsApp ----

export interface WhatsappMessage {
  id: string;
  clientId: string | null;
  waMsgId: string;
  direction: string;
  templateId: string | null;
  body: string | null;
  status: string;
  /** Only ever set on **inbound** messages (24h from receipt) — outbound messages always have `null` here. */
  windowExpiresAt: string | null;
}

/** A template send requires an active opt-in record; a session send requires an open 24h window from the client's latest inbound message. */
export interface SendWhatsAppRequest {
  clientId: string;
  templateId?: string | null;
  variables?: Record<string, string> | null;
  sessionText?: string | null;
}

export interface WhatsAppOptin {
  id: string;
  clientId: string;
  phoneE164: string;
  optedInAt: string;
  optedOutAt: string | null;
}

export interface OptInWhatsAppRequest {
  phoneE164: string;
  source?: string | null;
}

// ---- Calls ----

export interface CallLog {
  id: string;
  clientId: string | null;
  matterId: string | null;
  userId: string | null;
  direction: string;
  durationSec: number;
  summary: string | null;
  followUpTaskId: string | null;
  consentGiven: boolean;
  /** Populated later, asynchronously, from the provider's status-callback webhook — never present synchronously on log/click-to-call. */
  recordingBlobPath: string | null;
  occurredAt: string;
}

export interface LogCallRequest {
  clientId?: string | null;
  matterId?: string | null;
  userId?: string | null;
  direction: string;
  durationSec: number;
  summary?: string | null;
  createFollowUpTask: boolean;
  followUpTaskTitle?: string | null;
}

/** Recording is gated on `consentGiven` at the Twilio API call itself, not just app-side. */
export interface ClickToCallRequest {
  clientId?: string | null;
  matterId?: string | null;
  toNumber: string;
  consentGiven: boolean;
}

// ---- Chat ----

export const CHAT_CHANNEL_KINDS = ['Firm', 'Team', 'Matter', 'DM'] as const;
export type ChatChannelKind = (typeof CHAT_CHANNEL_KINDS)[number];

export interface ChatChannel {
  id: string;
  kind: ChatChannelKind;
  name: string | null;
  matterId: string | null;
  teamId: string | null;
  retentionDays: number | null;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  senderId: string | null;
  body: string | null;
  seq: number;
  taskId: string | null;
  documentId: string | null;
  sentAt: string;
}

export interface CreateChatChannelRequest {
  kind: ChatChannelKind;
  name?: string | null;
  matterId?: string | null;
  teamId?: string | null;
  memberUserIds: string[];
}

export interface ConvertChatMessageToTaskRequest {
  title: string;
  dueAt?: string | null;
}

// ---- Templates ----

export interface CommTemplate {
  id: string;
  channel: string;
  name: string;
  body: string;
  /** JSON-encoded array of variable names, by this codebase's convention — parse before rendering a variable-fill form. */
  variablesJson: string;
  dltTemplateId: string | null;
  waHsmName: string | null;
  isActive: boolean;
  /** `{{var}}` tokens found in `body` that aren't declared in `variablesJson` — a warning, not a hard validation error. */
  unknownPlaceholders: string[];
}

export interface CreateCommTemplateRequest {
  channel: string;
  name: string;
  body: string;
  variablesJson: string;
}

export interface UpdateCommTemplateRequest {
  body: string;
  variablesJson: string;
  isActive: boolean;
}

// ---- Timeline ----

export interface CommTimelineEntry {
  channel: CommChannel;
  entityId: string;
  at: string;
  direction: string;
  summary: string;
}
