/** The 12 dashboard widgets defined in PRD Module 1's widget catalog. */
export type WidgetId =
  | 'hearings-today'
  | 'tasks-pending'
  | 'revenue'
  | 'outstanding'
  | 'deadlines'
  | 'activity'
  | 'case-stats'
  | 'lawyer-performance'
  | 'matter-summary'
  | 'client-summary'
  | 'lead-pipeline'
  | 'trust-balance';

/** Grid column span: small=4/12, medium=6/12, large=12/12 (full width) on desktop. */
export type WidgetSize = 'small' | 'medium' | 'large';

export interface DashboardWidgetLayoutEntry {
  widgetId: WidgetId;
  size: WidgetSize;
  order: number;
  visible: boolean;
}

/** `user_dashboard_layouts.layout_json`, PRD Module 1 DB spec — capped at 32KB, validated against the widget catalog. */
export interface DashboardLayout {
  widgets: DashboardWidgetLayoutEntry[];
}

/** Preset options for the analytics date-range selector; `custom` requires `start`/`end`. */
export type AnalyticsRangePreset = 'week' | 'month' | 'quarter' | 'custom';

export interface AnalyticsRange {
  preset: AnalyticsRangePreset;
  start: string;
  end: string;
}

export interface HearingTodayItem {
  id: string;
  time: string;
  courtName: string;
  caseNumber: string;
  matterTitle: string;
  clientName: string;
  assignedLawyerName: string | null;
}

export interface TaskPendingItem {
  id: string;
  title: string;
  dueDate: string;
  bucket: 'overdue' | 'today' | 'thisWeek';
  matterTitle: string | null;
}

export interface RevenuePoint {
  periodLabel: string;
  billed: number;
  collected: number;
}

export interface RevenueSummary {
  billed: number;
  collected: number;
  target: number;
  priorPeriodCollected: number;
  currency: string;
  series: RevenuePoint[];
}

export interface OutstandingAgingBucket {
  label: '0-30' | '31-60' | '61-90' | '90+';
  amount: number;
}

export interface OutstandingDebtor {
  clientId: string;
  clientName: string;
  amount: number;
}

export interface OutstandingSummary {
  total: number;
  currency: string;
  buckets: OutstandingAgingBucket[];
  topDebtors: OutstandingDebtor[];
}

export interface DeadlineItem {
  id: string;
  title: string;
  dueDate: string;
  severity: 'low' | 'medium' | 'high';
  matterTitle: string | null;
}

export interface ActivityItem {
  id: string;
  message: string;
  actorName: string;
  occurredAt: string;
}

export interface CaseStatsSummary {
  open: number;
  closed: number;
  won: number;
  lost: number;
  settled: number;
  byStage: Array<{ stage: string; count: number }>;
}

export interface LawyerPerformanceItem {
  lawyerId: string;
  lawyerName: string;
  billableHours: number;
  utilizationPct: number;
  realizationPct: number;
}

export interface MatterSummaryItem {
  status: string;
  practiceArea: string;
  count: number;
}

export interface ClientSummaryWidgetData {
  newThisMonth: number;
  active: number;
  atRisk: number;
}

export interface LeadPipelineStage {
  stage: string;
  count: number;
}

export interface TrustBalanceSummary {
  totalHeld: number;
  currency: string;
  accountsNeedingReconciliation: number;
}

/** Pushed over `/hubs/notifications` (PRD Module 1: "auto-refresh via SignalR push"). */
export interface HearingOutcomeAddedEvent {
  hearingId: string;
}

export interface PaymentReceivedEvent {
  invoiceId: string;
}
