import { Routes } from '@angular/router';

/** PRD Module 13 UI Components: hub, viewer, custom builder, schedule dialog, saved-report manager. */
export const REPORTS_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'hub' },
  {
    path: 'hub',
    loadComponent: () => import('./hub/reports-hub.page').then((m) => m.ReportsHubPage),
  },
  {
    path: 'saved',
    loadComponent: () =>
      import('./saved/saved-report-manager.page').then((m) => m.SavedReportManagerPage),
  },
  {
    path: 'builder',
    loadComponent: () =>
      import('./builder/custom-report-builder.page').then((m) => m.CustomReportBuilderPage),
  },
  {
    path: 'builder/:id',
    loadComponent: () =>
      import('./builder/custom-report-builder.page').then((m) => m.CustomReportBuilderPage),
  },
  {
    path: 'view/standard/:key',
    loadComponent: () => import('./viewer/report-viewer.page').then((m) => m.ReportViewerPage),
  },
  {
    path: 'view/custom/:id',
    loadComponent: () => import('./viewer/report-viewer.page').then((m) => m.ReportViewerPage),
  },
];
