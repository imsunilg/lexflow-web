import { Routes } from '@angular/router';

/** PRD §13 nav: "Leads (Kanban | List | Import)"; lead detail and create/edit are their own screens (PRD Module 2 Screen List). */
export const LEADS_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'kanban' },
  {
    path: 'kanban',
    loadComponent: () => import('./kanban/leads-kanban.page').then((m) => m.LeadsKanbanPage),
    data: { permission: 'leads.read' },
  },
  {
    path: 'list',
    loadComponent: () => import('./list/leads-list.page').then((m) => m.LeadsListPage),
    data: { permission: 'leads.read' },
  },
  {
    path: 'import',
    loadComponent: () =>
      import('./import/leads-import-wizard.page').then((m) => m.LeadsImportWizardPage),
    data: { permission: 'leads.manage' },
  },
  {
    path: ':id',
    loadComponent: () => import('./detail/lead-detail.page').then((m) => m.LeadDetailPage),
    data: { permission: 'leads.read' },
  },
];
