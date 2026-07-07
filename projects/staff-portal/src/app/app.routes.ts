import { Routes } from '@angular/router';
import { authGuard, permissionGuard } from 'shared';
import { ForbiddenPage } from './features/auth/forbidden.page';
import { LoginPage } from './features/auth/login.page';
import { ShellComponent } from './shell/shell.component';

export const routes: Routes = [
  { path: 'login', component: LoginPage },
  { path: 'forbidden', component: ForbiddenPage },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    canActivateChild: [permissionGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'leads',
        loadComponent: () => import('./features/leads/leads.page').then((m) => m.LeadsPage),
        data: { permission: 'leads.read' },
      },
      {
        path: 'clients',
        loadComponent: () => import('./features/clients/clients.page').then((m) => m.ClientsPage),
        data: { permission: 'clients.read' },
      },
      {
        path: 'matters',
        loadComponent: () => import('./features/matters/matters.page').then((m) => m.MattersPage),
        data: { permission: 'matters.read' },
      },
      {
        path: 'calendar',
        loadComponent: () =>
          import('./features/calendar/calendar.page').then((m) => m.CalendarPage),
      },
      {
        path: 'documents',
        loadComponent: () =>
          import('./features/documents/documents.page').then((m) => m.DocumentsPage),
        data: { permission: 'documents.read' },
      },
      {
        path: 'billing',
        loadComponent: () => import('./features/billing/billing.page').then((m) => m.BillingPage),
        data: { permission: 'billing.read' },
      },
      {
        path: 'time',
        loadComponent: () => import('./features/time/time.page').then((m) => m.TimePage),
      },
      {
        path: 'tasks',
        loadComponent: () => import('./features/tasks/tasks.page').then((m) => m.TasksPage),
      },
      {
        path: 'communication',
        loadComponent: () =>
          import('./features/communication/communication.page').then((m) => m.CommunicationPage),
      },
      {
        path: 'knowledge-base',
        loadComponent: () =>
          import('./features/knowledge-base/knowledge-base.page').then((m) => m.KnowledgeBasePage),
      },
      {
        path: 'reports',
        loadComponent: () => import('./features/reports/reports.page').then((m) => m.ReportsPage),
        data: { permission: 'reports.read' },
      },
      {
        path: 'ai-studio',
        loadComponent: () =>
          import('./features/ai-studio/ai-studio.page').then((m) => m.AiStudioPage),
      },
      {
        path: 'admin',
        loadComponent: () => import('./features/admin/admin.page').then((m) => m.AdminPage),
        data: { permission: 'admin.read' },
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
