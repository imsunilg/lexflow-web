export interface NavItem {
  label: string;
  icon: string;
  path: string;
}

/** Portal nav items, PRD §13 / Module 17: "Home · Matters · Invoices · Documents · Appointments · Messages · Profile". */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Home', icon: 'home', path: 'home' },
  { label: 'Matters', icon: 'gavel', path: 'matters' },
  { label: 'Invoices', icon: 'receipt_long', path: 'invoices' },
  { label: 'Documents', icon: 'folder', path: 'documents' },
  { label: 'Appointments', icon: 'event', path: 'appointments' },
  { label: 'Messages', icon: 'forum', path: 'messages' },
  { label: 'Profile', icon: 'account_circle', path: 'profile' },
];
