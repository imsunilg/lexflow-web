import { Routes } from '@angular/router';

/** PRD §13 nav: "Matters (List | Workspace)". */
export const MATTERS_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'list' },
  {
    path: 'list',
    loadComponent: () => import('./list/matters-list.page').then((m) => m.MattersListPage),
    data: { permission: 'matters.read' },
  },
  {
    // Must be registered before ':id' so 'cause-list' isn't captured as a matter id.
    path: 'cause-list',
    loadComponent: () => import('./cause-list/cause-list.page').then((m) => m.CauseListPage),
    data: { permission: 'matters.read' },
  },
  {
    path: ':id/cases/:caseId',
    loadComponent: () => import('./case-detail/case-detail.page').then((m) => m.CaseDetailPage),
    data: { permission: 'matters.read' },
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./workspace/matter-workspace.page').then((m) => m.MatterWorkspacePage),
    data: { permission: 'matters.read' },
  },
];
