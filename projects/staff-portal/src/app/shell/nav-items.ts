export interface NavItem {
  label: string;
  icon: string;
  path: string;
  /** Permission key gating visibility — nav items are hidden without read permission (PRD §13). */
  permission?: string;
}

/** Primary nav rail items, in PRD §13 order. */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', path: 'dashboard' },
  { label: 'Leads', icon: 'person_add', path: 'leads', permission: 'leads.read' },
  { label: 'Clients', icon: 'groups', path: 'clients', permission: 'clients.read' },
  { label: 'Matters', icon: 'gavel', path: 'matters', permission: 'matters.read' },
  { label: 'Calendar', icon: 'calendar_month', path: 'calendar' },
  { label: 'Documents', icon: 'folder', path: 'documents', permission: 'documents.read' },
  { label: 'Billing', icon: 'receipt_long', path: 'billing', permission: 'billing.read' },
  { label: 'Time', icon: 'schedule', path: 'time' },
  { label: 'Tasks', icon: 'checklist', path: 'tasks' },
  { label: 'Communication', icon: 'forum', path: 'communication' },
  { label: 'Knowledge Base', icon: 'menu_book', path: 'knowledge-base' },
  { label: 'Reports', icon: 'bar_chart', path: 'reports', permission: 'reports.read' },
  { label: 'AI Studio', icon: 'auto_awesome', path: 'ai-studio' },
  { label: 'Admin', icon: 'admin_panel_settings', path: 'admin', permission: 'admin.read' },
];
