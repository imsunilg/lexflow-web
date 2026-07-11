/**
 * PRD Module 8 — Billing (with Trust Accounting).
 *
 * Field casing: the backend research pass for this module found DTOs defined
 * as PascalCase C# records with no explicit `JsonNamingPolicy` configured in
 * `Program.cs`. ASP.NET Core's `AddControllers()` default (`Microsoft.
 * AspNetCore.Mvc.JsonOptions`) is camelCase, and every other module built in
 * this engagement (Matters, Calendar, Documents) confirmed camelCase on the
 * wire against this same API — so these models use camelCase, consistent
 * with that established, empirically-confirmed default rather than the
 * PascalCase record declarations themselves.
 */

/**
 * No authoritative status enum was confirmed server-side — kept as `string`
 * rather than a closed union (see `INVOICE_STATUSES` below for the UI's
 * best-effort list of values actually reachable via the status-change
 * endpoints: submit/approve/reject/send/void).
 */
export type InvoiceStatus = string;

export const INVOICE_STATUSES = [
  'Draft',
  'Submitted',
  'Approved',
  'Rejected',
  'Sent',
  'PartiallyPaid',
  'Paid',
  'Overdue',
  'Void',
] as const;

export const PAYMENT_MODES = ['Cash', 'Cheque', 'NEFT', 'Gateway'] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

/** `TrustLedgerEntryDto.kind` — no closed enum confirmed; used for color-coding. */
export const TRUST_ENTRY_KINDS = ['Deposit', 'Disbursement', 'Reversal'] as const;
export type TrustEntryKind = (typeof TRUST_ENTRY_KINDS)[number];

export interface InvoiceLine {
  id: string;
  lineNo: number;
  type: string;
  description: string | null;
  qty: number;
  unit: string | null;
  rate: number;
  amount: number;
  timeEntryIds: string[];
}

export interface InvoiceTax {
  name: string;
  ratePct: number;
  taxableAmount: number;
  amount: number;
}

export interface Invoice {
  id: string;
  number: string | null;
  matterId: string;
  clientId: string;
  status: InvoiceStatus;
  issueDate: string | null;
  dueDate: string | null;
  currency: string;
  subTotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  amountPaid: number;
  notes: string | null;
  pdfBlobPath: string | null;
  lines: InvoiceLine[];
  taxes: InvoiceTax[];
}

export interface InvoiceStatusHistoryEntry {
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  changedBy: string | null;
  changedAt: string;
}

export interface InvoiceExtraLine {
  type: string;
  description?: string | null;
  qty: number;
  unit?: string | null;
  rate: number;
}

export interface CreateInvoiceRequest {
  matterId: string;
  issueDate?: string | null;
  dueInDays: number;
  pullTimeEntryIds?: string[];
  extraLines?: InvoiceExtraLine[];
  discount?: number | null;
  notes?: string | null;
}

export interface BatchInvoiceRequest {
  minWip: number;
  branchId?: string | null;
  matterTypeId?: string | null;
  asOf: string;
}

export interface InvoiceFilter {
  status?: string;
  clientId?: string;
  matterId?: string;
  from?: string;
  to?: string;
  overdueOnly?: boolean;
}

export interface PaymentAllocation {
  invoiceId: string;
  amount: number;
}

export interface Payment {
  id: string;
  receiptNumber: string | null;
  clientId: string;
  amount: number;
  mode: PaymentMode;
  gateway: string | null;
  gatewayRef: string | null;
  receivedOn: string;
  status: string;
  allocations: PaymentAllocation[];
}

export interface CreatePaymentRequest {
  clientId: string;
  amount: number;
  mode: PaymentMode;
  gateway?: string | null;
  gatewayRef?: string | null;
  receivedOn: string;
  allocations: PaymentAllocation[];
  idempotencyKey?: string;
}

export interface CreditNote {
  id: string;
  number: string | null;
  invoiceId: string;
  amount: number;
  reason: string;
  status: string;
}

export interface CreateCreditNoteRequest {
  invoiceId: string;
  amount: number;
  reason: string;
}

export interface Refund {
  id: string;
  paymentId: string;
  amount: number;
  reason: string | null;
  status: string;
  gatewayRef: string | null;
}

export interface CreateRefundRequest {
  paymentId: string;
  amount: number;
  reason?: string | null;
}

export interface ClientStatement {
  clientId: string;
  from: string;
  to: string;
  invoices: Invoice[];
  payments: Payment[];
  openingBalance: number;
  closingBalance: number;
}

export interface AgingReport {
  current: number;
  bucket1To30: number;
  bucket31To60: number;
  bucket61To90: number;
  over90: number;
  total: number;
}

export interface TrustAccount {
  id: string;
  clientId: string;
  bankRef: string | null;
  currentBalance: number;
}

export interface TrustLedgerEntry {
  id: string;
  trustAccountId: string;
  entryNo: number;
  kind: TrustEntryKind;
  amount: number;
  runningBalance: number;
  purpose: string | null;
  invoiceId: string | null;
  createdAt: string;
}

export interface TrustDepositRequest {
  amount: number;
  purpose?: string | null;
  authorizationRef?: string | null;
}

export interface TrustDisbursementRequest {
  amount: number;
  purpose?: string | null;
  invoiceId?: string | null;
  authorizationRef: string;
  secondApproverId?: string | null;
}

export interface TrustReconciliationLine {
  date: string;
  description?: string | null;
  amount: number;
}

/**
 * There is NO multipart/CSV-upload endpoint — the backend only accepts a JSON
 * body with pre-parsed `lines[]`. So CSV parsing happens entirely client-side
 * before this request is built; `importedCsvBlobPath` is just an optional
 * reference string, not a file upload field.
 */
export interface CreateTrustReconciliationRequest {
  periodStart: string;
  periodEnd: string;
  bankStatementBalance: number;
  lines: TrustReconciliationLine[];
  importedCsvBlobPath?: string | null;
}

export interface TrustReconciliation {
  id: string;
  periodStart: string;
  periodEnd: string;
  bankStatementBalance: number;
  ledgerBalance: number;
  status: string;
  isBalanced: boolean;
  exceptionCount: number;
}

export interface TrustReconciliationItem {
  id: string;
  bankLineDate: string;
  bankLineDescription: string | null;
  bankLineAmount: number;
  isException: boolean;
}

export interface RateCardEntry {
  id: string;
  role: string;
  rate: number;
}

export interface RateCard {
  id: string;
  name: string;
  entries: RateCardEntry[];
}

export interface DunningSchedule {
  id: string;
  name: string;
  stepsJson: string;
  isActive: boolean;
}
