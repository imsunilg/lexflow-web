import { DashboardWidgetLayoutEntry, WidgetId, WidgetSize } from 'shared';

export interface WidgetCatalogEntry {
  id: WidgetId;
  title: string;
  icon: string;
  defaultSize: WidgetSize;
  /** Whether this widget reacts to the page's analytics date-range selector (PRD Module 1 UI Components). */
  isAnalytics: boolean;
  /** Coarse permission gate — revenue/outstanding/trust widgets require `billing.read.*` per AC-D5. */
  permission?: string;
}

/** The 12-widget catalog (PRD Module 1), in the PRD's own listed order. */
export const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  {
    id: 'hearings-today',
    title: "Today's Hearings",
    icon: 'gavel',
    defaultSize: 'medium',
    isAnalytics: false,
  },
  {
    id: 'tasks-pending',
    title: 'Pending Tasks',
    icon: 'checklist',
    defaultSize: 'medium',
    isAnalytics: false,
  },
  {
    id: 'revenue',
    title: 'Revenue',
    icon: 'trending_up',
    defaultSize: 'large',
    isAnalytics: true,
    permission: 'billing.read',
  },
  {
    id: 'outstanding',
    title: 'Outstanding Payments',
    icon: 'request_quote',
    defaultSize: 'medium',
    isAnalytics: false,
    permission: 'billing.read',
  },
  {
    id: 'deadlines',
    title: 'Upcoming Deadlines',
    icon: 'event_busy',
    defaultSize: 'medium',
    isAnalytics: false,
  },
  {
    id: 'activity',
    title: 'Recent Activities',
    icon: 'history',
    defaultSize: 'medium',
    isAnalytics: false,
  },
  {
    id: 'case-stats',
    title: 'Case Statistics',
    icon: 'bar_chart',
    defaultSize: 'medium',
    isAnalytics: true,
  },
  {
    id: 'lawyer-performance',
    title: 'Performance Charts',
    icon: 'insights',
    defaultSize: 'large',
    isAnalytics: true,
  },
  {
    id: 'matter-summary',
    title: 'Matter Summary',
    icon: 'folder_open',
    defaultSize: 'medium',
    isAnalytics: true,
  },
  {
    id: 'client-summary',
    title: 'Client Summary',
    icon: 'groups',
    defaultSize: 'small',
    isAnalytics: true,
  },
  {
    id: 'lead-pipeline',
    title: 'Lead Pipeline',
    icon: 'filter_alt',
    defaultSize: 'small',
    isAnalytics: true,
  },
  {
    id: 'trust-balance',
    title: 'Trust Balance',
    icon: 'account_balance',
    defaultSize: 'small',
    isAnalytics: false,
    permission: 'billing.read',
  },
];

export function widgetCatalogEntry(id: WidgetId): WidgetCatalogEntry {
  const entry = WIDGET_CATALOG.find((candidate) => candidate.id === id);
  if (!entry) {
    throw new Error(`Unknown widget id: ${id}`);
  }
  return entry;
}

/** Layout used the first time a user opens the dashboard (before any `PUT /dashboard/layout` has ever been saved). */
export function defaultDashboardLayout(): DashboardWidgetLayoutEntry[] {
  return WIDGET_CATALOG.map((entry, index) => ({
    widgetId: entry.id,
    size: entry.defaultSize,
    order: index,
    visible: true,
  }));
}
