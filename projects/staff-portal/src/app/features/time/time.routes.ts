import { Routes } from '@angular/router';

/** PRD §13 nav: "Time (Timesheet | Entries | Approvals | Utilization)". */
export const TIME_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'timesheet' },
  {
    path: 'timesheet',
    loadComponent: () => import('./timesheet/timesheet-grid.page').then((m) => m.TimesheetGridPage),
  },
  {
    path: 'entries',
    loadComponent: () => import('./entries/entry-list.page').then((m) => m.EntryListPage),
  },
  {
    path: 'approvals',
    loadComponent: () => import('./approvals/approval-queue.page').then((m) => m.ApprovalQueuePage),
    data: { permission: 'time.approve' },
  },
  {
    path: 'utilization',
    loadComponent: () => import('./utilization/utilization.page').then((m) => m.UtilizationPage),
  },
];
