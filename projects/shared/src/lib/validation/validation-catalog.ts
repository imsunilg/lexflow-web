/**
 * Single source of truth for cross-module validation primitives (PRD §27:
 * "mirror rules via shared JSON schema (validation-catalog.json) consumed by
 * Angular reactive-forms validator factory"). The PRD names the file and its
 * purpose but doesn't specify a schema, so this shape is designed here: one
 * entry per named rule, covering the string/identifier/money/date/pagination
 * buckets §27 lists. The server always re-validates (FluentValidation) —
 * this catalog only drives client-side UX, and where a server validator's
 * exact pattern is known (e.g. `LeadValidators.cs`'s phone regex), this
 * catalog uses that literal pattern rather than a looser general-purpose one,
 * so client and server never disagree about what's valid.
 */
export interface StringLengthRule {
  readonly kind: 'string';
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly trim?: boolean;
}

export interface PatternRule {
  readonly kind: 'pattern';
  readonly pattern: string;
  readonly message: string;
}

export interface NumberRangeRule {
  readonly kind: 'number';
  readonly min?: number;
  readonly max?: number;
  readonly maxDecimals?: number;
}

export type ValidationRule = StringLengthRule | PatternRule | NumberRangeRule;

/** §27 verbatim: "Strings: trimmed; names 2–200; titles 3–300; notes/narratives ≤ 10k". */
export const VALIDATION_CATALOG = {
  name: { kind: 'string', minLength: 2, maxLength: 200, trim: true } satisfies StringLengthRule,
  title: { kind: 'string', minLength: 3, maxLength: 300, trim: true } satisfies StringLengthRule,
  narrative: { kind: 'string', maxLength: 10_000, trim: true } satisfies StringLengthRule,
  caseNumber: {
    kind: 'string',
    minLength: 1,
    maxLength: 50,
    trim: true,
  } satisfies StringLengthRule,

  /** RFC 5322 shape check (async MX-check is advisory server-side only, not reproduced client-side). */
  email: {
    kind: 'pattern',
    pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
    message: 'Enter a valid email address.',
  } satisfies PatternRule,

  /**
   * E.164 phone. This mirrors `CreateLeadCommandValidator`/`UpdateLeadCommandValidator`
   * in `lexflow-api`'s `LeadValidators.cs` (`^\+[1-9]\d{6,14}$`) exactly, rather
   * than a generic libphonenumber pattern, so client and server never disagree
   * on a lead's phone number.
   */
  phoneE164: {
    kind: 'pattern',
    pattern: '^\\+[1-9]\\d{6,14}$',
    message: 'Enter a phone number in international format, e.g. +919812345678.',
  } satisfies PatternRule,

  pan: {
    kind: 'pattern',
    pattern: '^[A-Z]{5}[0-9]{4}[A-Z]$',
    message: 'Enter a valid PAN (e.g. ABCDE1234F).',
  } satisfies PatternRule,

  /** Mirrors `ClientValidators.cs`'s exact GSTIN pattern in lexflow-api, not a generic 15-char GSTIN checksum pattern, so client and server never disagree. */
  gstin: {
    kind: 'pattern',
    pattern: '^\\d{2}[A-Z]{5}\\d{4}[A-Z]\\d[A-Z\\d]Z[A-Z\\d]$',
    message: 'Enter a valid GSTIN.',
  } satisfies PatternRule,

  ifsc: {
    kind: 'pattern',
    pattern: '^[A-Z]{4}0[A-Z0-9]{6}$',
    message: 'Enter a valid IFSC code.',
  } satisfies PatternRule,

  cin: {
    kind: 'pattern',
    pattern: '^[A-Z0-9]{21}$',
    message: 'Enter a valid 21-character CIN.',
  } satisfies PatternRule,

  /** §27: "Money: ≥ 0 unless credit-note context; ≤ 10^12; 2-dp." */
  money: {
    kind: 'number',
    min: 0,
    max: 1_000_000_000_000,
    maxDecimals: 2,
  } satisfies NumberRangeRule,

  /** §27: "Pagination: limit 1–100 default 25." */
  paginationLimit: { kind: 'number', min: 1, max: 100 } satisfies NumberRangeRule,
} as const;

export type ValidationCatalogKey = keyof typeof VALIDATION_CATALOG;

/** §27: "Bulk ops: ≤ 500 ids/request; imports ≤ 10k rows." */
export const MAX_BULK_OP_IDS = 500;
export const MAX_IMPORT_ROWS = 10_000;

export const DEFAULT_PAGE_SIZE = 25;
