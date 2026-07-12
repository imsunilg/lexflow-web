/**
 * Module 15 — Settings. Backend confirmed real for the generic per-section
 * GET/PUT plus live test/verify endpoints (`SettingsController`), and for
 * Number Series / Tax Rates (their own controllers) — but several PRD
 * sub-features have no backend at all. See each section's own comment below
 * for exactly what's real vs missing; the file-level summary:
 *
 * - Section keys are snake_case in code (`firm_details`, `sms_gateway`, …),
 *   not the PRD's kebab-case.
 * - `taxes`, `document_templates`, `number_series`, `email_templates`,
 *   `workflow_rules` are collection sections — `PUT /settings/{section}` on
 *   any of these throws a 409 (`SETTINGS_SECTION_IS_COLLECTION`); each has
 *   its own dedicated CRUD controller instead (see their own services).
 * - No logo upload, no portal branding field, no per-user theme override, no
 *   import hub / tenant data export / backup status, no HSN/SAC or
 *   place-of-supply fields on tax rates, no document-template
 *   preview-with-sample-data, no email-template subject/versioning/
 *   per-language/preview/revert-to-default — none of these exist server-side.
 * - Number-series tokens are `{SEQ}`/`{SEQ:n}`, `{SERIES}`, `{FY}`, `{BR}` —
 *   not the PRD's `{BRANCH}{FY}{YYYY}{MM}{seq:n}`. There's no reset-policy
 *   field; a new fiscal year means a new series row, not an automatic reset.
 * - The only audit-read endpoint (`GET /settings/audit?section=`) is scoped
 *   to settings/gateway changes only, with a single `section` filter and a
 *   reduced DTO (no actor/action/date filters, no IP/UA/traceId) — there is
 *   no general cross-entity audit browser and no CSV export. See
 *   `SettingsAuditEntryDto` below.
 */

export const SETTINGS_SECTIONS = [
  { key: 'firm_details', label: 'Firm details' },
  { key: 'branding', label: 'Branding' },
  { key: 'theme', label: 'Theme' },
  { key: 'smtp', label: 'SMTP' },
  { key: 'sms_gateway', label: 'SMS gateway' },
  { key: 'whatsapp', label: 'WhatsApp API' },
  { key: 'business_hours', label: 'Business hours & holidays' },
  { key: 'data', label: 'Data' },
  { key: 'security', label: 'Security settings' },
] as const;
export type SettingsSectionKey = (typeof SETTINGS_SECTIONS)[number]['key'];

/** Raw JSON-schema-validated blob per section — shape varies by section key, see file-header comment for which fields each section actually supports. */
export type SettingsSectionValue = Record<string, unknown>;

export interface TestSmtpRequest {
  host: string;
  port: number;
  tlsMode: 'None' | 'StartTls' | 'Ssl' | 'Tls';
  username?: string | null;
  password?: string | null;
  fromName?: string | null;
  fromAddress: string;
  toAddress: string;
}

export interface TestSmsRequest {
  provider: 'sms_twilio' | 'sms_msg91';
  accountSid?: string | null;
  authToken?: string | null;
  senderId: string;
  dltEntityId?: string | null;
  toPhoneNumber: string;
}

export interface SyncWhatsAppTemplatesRequest {
  wabaId: string;
  phoneNumberId: string;
  accessToken: string;
}

export interface TestWhatsAppRequest {
  wabaId: string;
  phoneNumberId: string;
  accessToken: string;
  toPhoneNumber: string;
}

export interface ExternalCallResult {
  success: boolean;
  message: string;
}

export type PaymentGatewayProvider = 'stripe' | 'razorpay' | 'paypal';

export interface GatewayConfigDto {
  id: string;
  provider: PaymentGatewayProvider | string;
  configJson: string;
  hasSecret: boolean;
  isEnabled: boolean;
  isTestMode: boolean;
}

export interface VerifyGatewayRequest {
  configJson: string;
  secret?: string | null;
  isTestMode: boolean;
  save: boolean;
}

export interface NumberSeriesDto {
  id: string;
  seriesKey: string;
  fiscalYear: number;
  formatPattern: string;
  nextSeq: number;
  branchId: string | null;
}

export interface CreateNumberSeriesRequest {
  seriesKey: string;
  fiscalYear: number;
  formatPattern: string;
  branchId?: string | null;
}

export interface UpdateNumberSeriesPatternRequest {
  formatPattern: string;
}

export interface NumberSeriesPreview {
  preview: string;
}

export interface TaxRateDto {
  id: string;
  countryCode: string;
  taxType: string;
  componentsJson: string;
  isActive: boolean;
  branchId: string | null;
}

export interface UpsertTaxRateRequest {
  countryCode: string;
  taxType: string;
  componentsJson: string;
  isActive: boolean;
  branchId?: string | null;
}

/** Reduced projection of the underlying `AuditEvent` row — see file-header comment on what's missing. */
export interface SettingsAuditEntryDto {
  id: string;
  at: string;
  actorUserId: string | null;
  action: string;
  before: string | null;
  after: string | null;
}
