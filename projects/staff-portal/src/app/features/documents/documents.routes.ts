import { Routes } from '@angular/router';

/** PRD Module 7 nav: a single explorer shell; drawers/dialogs handle the rest. */
export const DOCUMENTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./documents-explorer.page').then((m) => m.DocumentsExplorerPage),
    data: { permission: 'documents.read' },
  },
];
