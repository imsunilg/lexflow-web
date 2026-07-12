/**
 * Client-portal API models (PRD Module 17), confirmed against the real backend
 * (`api/portal/v1/...`, distinct "Portal" JWT bearer scheme + audience, own
 * `client_portal_users` identity realm — genuinely separate from staff's
 * `/api/v1`). Deliberately NOT re-exported from `shared`'s `public-api.ts`:
 * per the identity-separation rule (PRD §20), this app's data layer stays
 * physically isolated in `client-portal`, never imported by staff-portal.
 *
 * Confirmed backend gaps (verified by reading the actual controllers, not
 * assumed from the PRD) — handled by honest UI disclosure, not fabrication:
 * - No branding endpoint exists (`GET .../branding` is not implemented
 *   anywhere server-side) — `PortalBrandingService` calls the route the PRD
 *   names anyway (forward-compatible), but it will 404 until the backend
 *   ships it; the UI silently falls back to the shared default theme.
 * - No `/preferences` endpoint (GET or PUT) exists at all.
 * - No invoice PDF/receipt/statement download endpoint exists for the portal
 *   (only the JSON summary via `GET /invoices/{id}`).
 * - No message-attachment support — `PortalPostMessageRequest` is body-only.
 * - `PortalAppointmentRequest.Confirm()`/`.Reschedule()` exist on the domain
 *   entity but have zero call sites anywhere (staff or portal) — there is no
 *   confirm/reschedule endpoint to wire up yet.
 * - No lawyer-availability-publishing or lawyer-lookup endpoint — requesting
 *   an appointment requires a raw `lawyerId` GUID that no portal endpoint
 *   ever exposes (`GET /me/matters` only returns `responsibleLawyerName`).
 */

export interface PortalLoginRequest {
  tenantSlug: string;
  email: string;
  password: string;
}

export interface PortalLoginUser {
  id: string;
  clientId: string;
  name: string;
  email: string;
}

export interface PortalLoginResponse {
  accessToken: string;
  expiresIn: number;
  user: PortalLoginUser;
}

export interface PortalForgotPasswordRequest {
  tenantSlug: string;
  email: string;
}

/** Also used for the invite-acceptance flow — the backend's `/auth/reset` moves a freshly-invited `ClientPortalUser` from `Invited` to `Active`. */
export interface PortalResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface PortalMatterSummary {
  id: string;
  number: string;
  title: string;
  status: string;
  nextHearingDate: string | null;
  responsibleLawyerName: string | null;
}

export interface PortalTimelineEntry {
  kind: 'Hearing' | 'HearingOutcome';
  at: string;
  title: string;
  detail: string | null;
}

export interface PortalMatterTimeline {
  matterId: string;
  number: string;
  title: string;
  status: string;
  entries: PortalTimelineEntry[];
}

export interface PortalInvoiceSummary {
  id: string;
  number: string;
  matterId: string;
  status: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  grandTotal: number;
  amountPaid: number;
  openBalance: number;
}

export interface PortalPayNowRequest {
  returnUrl: string;
}

export interface PortalPaySession {
  sessionId: string;
  checkoutUrl: string;
  gateway: string;
  amount: number;
}

export interface PortalDocument {
  id: string;
  title: string;
  docType: string;
  matterId: string;
  createdAt: string;
}

export interface PortalDocumentDownload {
  url: string;
}

/** Max upload size the backend enforces (`[RequestSizeLimit(25_000_000)]` + an explicit in-code cap) — validated client-side too so users get instant feedback instead of a failed request. */
export const PORTAL_MAX_UPLOAD_BYTES = 25_000_000;

export interface PortalAppointment {
  id: string;
  matterId: string;
  lawyerId: string;
  requestedStart: string;
  requestedEnd: string;
  status: string;
  confirmedStart: string | null;
  confirmedEnd: string | null;
}

export interface PortalAppointmentRequest {
  matterId: string;
  lawyerId: string;
  requestedStart: string;
  requestedEnd: string;
  notes?: string;
}

export interface PortalMessageThread {
  id: string;
  matterId: string;
  subject: string;
  lastMessageAt: string;
}

export interface PortalMessage {
  id: string;
  threadId: string;
  fromPortalUser: boolean;
  senderName: string;
  body: string;
  createdAt: string;
}

/** Server-enforced max (`PortalMessage.MaxBodyLength`, backed by a DB CHECK) — mirrored client-side for immediate validation feedback. */
export const PORTAL_MESSAGE_MAX_LENGTH = 10_000;

export interface PortalPostMessageRequest {
  body: string;
}

/**
 * Shape the frontend requests from `GET .../branding` per the PRD ("logo/colors
 * from Settings"). Not a confirmed backend contract — no such endpoint exists
 * today (see file-header gap list) — this interface documents what the call
 * site expects if/when the backend adds it.
 */
export interface PortalBranding {
  firmName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
}
