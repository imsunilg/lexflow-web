/**
 * Module 13 — Reports & Analytics. Backend confirmed real and comprehensive
 * (`ReportsController`, `StandardReportService`, `CustomReportService`,
 * `ReportRunService`, `ReportSchedulerService`, `ReportExportService`) —
 * documented gaps below are the only places this frontend has to work around
 * something that doesn't exist yet:
 *
 * - No favorites/saved-standard-report endpoint exists at all (only custom
 *   report *definitions* have a Visibility of private/team/firm — that's a
 *   different concept). Favorites are tracked client-side (localStorage) —
 *   see `ReportFavoritesService` — and won't follow the user across devices.
 * - No field-catalog endpoint (`ReportFieldCatalog` is a static, unexported
 *   C# class never wired to a controller) — `REPORT_FIELD_CATALOG` below is a
 *   hand-mirrored copy of it and must be kept in sync manually if the backend
 *   catalog changes.
 * - Async (queued) runs never return row data through `GET runs/{jobId}` —
 *   only status/rowCount. The only way to see a queued run's data is the
 *   export endpoint, so the report viewer cannot render a chart/table for a
 *   run that went async; it shows a "completed — export below" state instead.
 * - Schedule recipients that are email-only (no firm user id) are recorded
 *   but never actually emailed — no attachment-capable SMTP sender exists yet
 *   server-side. The schedule dialog surfaces this as a caveat, not a promise.
 * - True drill-down to a filtered list view isn't supported by any list page
 *   in this app (no list page reads filter state from query params), so
 *   "drill-down" here means: for custom reports only (which have one
 *   unambiguous base entity), link a row's entity id to that entity's own
 *   detail page when one exists (Matter, Invoice, Lead). TimeEntry/Task/
 *   Hearing have no per-id detail route in this app, so those stay plain
 *   text. The 12 standard reports are cross-dimension aggregates with no
 *   single source record to link to, so they have no drill-down at all.
 */

export interface ReportCatalogItem {
  key: string;
  name: string;
  category: string;
  requiresFinancialPermission: boolean;
}

export interface ReportRunParams {
  dateFrom?: string | null;
  dateTo?: string | null;
  practiceAreaId?: string | null;
  lawyerId?: string | null;
  clientId?: string | null;
  branchId?: string | null;
}

/** Flat, exportable tabular result — shared currency between standard reports, the custom builder, and every export format. */
export interface ReportResult {
  columns: string[];
  rows: unknown[][];
}

export type ReportRunStatus = 'Completed' | 'Queued' | 'Running' | 'Failed';

export interface ReportRunOutcome {
  runId: string;
  status: ReportRunStatus;
  inlineResult: ReportResult | null;
}

export interface ReportRunDto {
  id: string;
  reportKey: string | null;
  reportDefinitionId: string | null;
  status: ReportRunStatus;
  rowCount: number | null;
  errorMessage: string | null;
  requestedAt: string;
  completedAt: string | null;
}

export type ReportFieldType = 'Text' | 'Number' | 'Date' | 'Boolean';

export interface ReportFieldDefinition {
  key: string;
  label: string;
  type: ReportFieldType;
}

export const REPORT_BASE_ENTITIES = [
  'Matter',
  'Invoice',
  'TimeEntry',
  'Lead',
  'Task',
  'Hearing',
] as const;
export type ReportBaseEntity = (typeof REPORT_BASE_ENTITIES)[number];

/** Hand-mirrored copy of `ReportFieldCatalog.cs` — see file-header doc comment. */
export const REPORT_FIELD_CATALOG: Record<ReportBaseEntity, ReportFieldDefinition[]> = {
  Matter: [
    { key: 'Id', label: 'Number', type: 'Text' },
    { key: 'Number', label: 'Number', type: 'Text' },
    { key: 'Title', label: 'Title', type: 'Text' },
    { key: 'Status', label: 'Status', type: 'Text' },
    { key: 'Priority', label: 'Priority', type: 'Text' },
    { key: 'OpenedOn', label: 'Opened On', type: 'Date' },
    { key: 'ClosedOn', label: 'Closed On', type: 'Date' },
    { key: 'PracticeAreaId', label: 'Practice Area', type: 'Text' },
    { key: 'ResponsibleLawyerId', label: 'Responsible Lawyer', type: 'Text' },
    { key: 'ClientId', label: 'Client', type: 'Text' },
    { key: 'BranchId', label: 'Branch', type: 'Text' },
    { key: 'Budget', label: 'Budget', type: 'Number' },
  ],
  Invoice: [
    { key: 'Id', label: 'Id', type: 'Text' },
    { key: 'Number', label: 'Number', type: 'Text' },
    { key: 'Status', label: 'Status', type: 'Text' },
    { key: 'IssueDate', label: 'Issue Date', type: 'Date' },
    { key: 'DueDate', label: 'Due Date', type: 'Date' },
    { key: 'GrandTotal', label: 'Grand Total', type: 'Number' },
    { key: 'AmountPaid', label: 'Amount Paid', type: 'Number' },
    { key: 'TaxTotal', label: 'Tax Total', type: 'Number' },
    { key: 'ClientId', label: 'Client', type: 'Text' },
    { key: 'MatterId', label: 'Matter', type: 'Text' },
  ],
  TimeEntry: [
    { key: 'Id', label: 'Id', type: 'Text' },
    { key: 'UserId', label: 'Timekeeper', type: 'Text' },
    { key: 'MatterId', label: 'Matter', type: 'Text' },
    { key: 'EntryDate', label: 'Entry Date', type: 'Date' },
    { key: 'DurationMin', label: 'Duration (min)', type: 'Number' },
    { key: 'RoundedMin', label: 'Rounded (min)', type: 'Number' },
    { key: 'Billable', label: 'Billable', type: 'Boolean' },
    { key: 'Status', label: 'Status', type: 'Text' },
    { key: 'AmountSnapshot', label: 'Amount', type: 'Number' },
  ],
  Lead: [
    { key: 'Id', label: 'Id', type: 'Text' },
    { key: 'Number', label: 'Number', type: 'Text' },
    { key: 'Stage', label: 'Stage', type: 'Text' },
    { key: 'Status', label: 'Status', type: 'Text' },
    { key: 'OwnerId', label: 'Owner', type: 'Text' },
    { key: 'BranchId', label: 'Branch', type: 'Text' },
    { key: 'PracticeAreaId', label: 'Practice Area', type: 'Text' },
    { key: 'SourceId', label: 'Source', type: 'Text' },
    { key: 'Score', label: 'Score', type: 'Number' },
  ],
  Task: [
    { key: 'Id', label: 'Id', type: 'Text' },
    { key: 'Title', label: 'Title', type: 'Text' },
    { key: 'Status', label: 'Status', type: 'Text' },
    { key: 'Priority', label: 'Priority', type: 'Text' },
    { key: 'OwnerId', label: 'Owner', type: 'Text' },
    { key: 'MatterId', label: 'Matter', type: 'Text' },
    { key: 'DueAt', label: 'Due At', type: 'Date' },
    { key: 'ProgressPct', label: 'Progress %', type: 'Number' },
  ],
  Hearing: [
    { key: 'Id', label: 'Id', type: 'Text' },
    { key: 'CaseId', label: 'Case', type: 'Text' },
    { key: 'Date', label: 'Date', type: 'Date' },
    { key: 'Status', label: 'Status', type: 'Text' },
    { key: 'AssignedLawyerId', label: 'Assigned Lawyer', type: 'Text' },
    { key: 'Courtroom', label: 'Courtroom', type: 'Text' },
  ],
};

/** Base entities with a real single-record detail route in staff-portal today — see file-header doc comment on drill-down. */
export const REPORT_ENTITY_DETAIL_ROUTE: Partial<
  Record<ReportBaseEntity, (id: string) => string[]>
> = {
  Matter: (id) => ['/matters', id],
  Invoice: (id) => ['/billing/invoices', id],
  Lead: (id) => ['/leads', id],
};

export const CUSTOM_REPORT_AGGREGATE_FUNCTIONS = ['sum', 'avg', 'count', 'min', 'max'] as const;
export type CustomReportAggregateFunction = (typeof CUSTOM_REPORT_AGGREGATE_FUNCTIONS)[number];

export const CUSTOM_REPORT_FILTER_OPERATORS = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'startsWith',
] as const;
export type CustomReportFilterOperator = (typeof CUSTOM_REPORT_FILTER_OPERATORS)[number];

export interface CustomReportFilter {
  field: string;
  operator: CustomReportFilterOperator | string;
  value: string | null;
}

export interface CustomReportFilterGroup {
  logic: 'AND' | 'OR';
  filters: CustomReportFilter[];
  groups?: CustomReportFilterGroup[] | null;
}

export interface CustomReportAggregate {
  field: string;
  function: CustomReportAggregateFunction | string;
  alias: string | null;
}

export interface CustomReportSort {
  field: string;
  descending: boolean;
}

export const REPORT_VISIBILITIES = ['private', 'team', 'firm'] as const;
export type ReportVisibility = (typeof REPORT_VISIBILITIES)[number];

export interface CustomReportDefinitionInput {
  name: string;
  baseEntity: ReportBaseEntity | string;
  columns: string[];
  filter: CustomReportFilterGroup | null;
  groupBy: string[];
  aggregates: CustomReportAggregate[];
  sort: CustomReportSort[];
  visibility: ReportVisibility | string;
}

export interface ReportDefinitionDto {
  id: string;
  name: string;
  baseEntity: string;
  definition: CustomReportDefinitionInput;
  visibility: ReportVisibility | string;
  ownerId: string;
  isActive: boolean;
}

export const REPORT_SCHEDULE_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const;
export type ReportScheduleFrequency = (typeof REPORT_SCHEDULE_FREQUENCIES)[number];

export const REPORT_EXPORT_FORMATS = ['pdf', 'xlsx', 'csv'] as const;
export type ReportExportFormat = (typeof REPORT_EXPORT_FORMATS)[number];

export interface ReportScheduleRecipient {
  userId?: string | null;
  email?: string | null;
}

export interface ReportScheduleInput {
  reportKey?: string | null;
  reportDefinitionId?: string | null;
  frequency: ReportScheduleFrequency | string;
  format: ReportExportFormat | string;
  params?: ReportRunParams | null;
  recipients: ReportScheduleRecipient[];
}

export interface ReportScheduleDto {
  id: string;
  reportKey: string | null;
  reportDefinitionId: string | null;
  frequency: string;
  format: string;
  nextRunAt: string | null;
  lastRunAt: string | null;
  isActive: boolean;
}
