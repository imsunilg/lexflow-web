import { Routes } from '@angular/router';
import { authGuard, permissionGuard } from 'shared';
import { AcceptInvitationPage } from './features/auth/accept-invitation.page';
import { ForbiddenPage } from './features/auth/forbidden.page';
import { ForgotPasswordPage } from './features/auth/forgot-password.page';
import { LoginPage } from './features/auth/login.page';
import { ResetPasswordPage } from './features/auth/reset-password.page';
import { TwoFaChallengePage } from './features/auth/two-fa-challenge.page';
import { ShellComponent } from './shell/shell.component';

export const routes: Routes = [
  { path: 'login', component: LoginPage },
  { path: '2fa', component: TwoFaChallengePage },
  { path: 'forgot-password', component: ForgotPasswordPage },
  { path: 'reset-password', component: ResetPasswordPage },
  { path: 'accept-invitation', component: AcceptInvitationPage },
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
        loadChildren: () => import('./features/leads/leads.routes').then((m) => m.LEADS_ROUTES),
      },
      {
        path: 'clients',
        loadChildren: () =>
          import('./features/clients/clients.routes').then((m) => m.CLIENTS_ROUTES),
      },
      {
        path: 'matters',
        loadChildren: () =>
          import('./features/matters/matters.routes').then((m) => m.MATTERS_ROUTES),
      },
      {
        path: 'calendar',
        loadChildren: () =>
          import('./features/calendar/calendar.routes').then((m) => m.CALENDAR_ROUTES),
      },
      {
        path: 'documents',
        loadChildren: () =>
          import('./features/documents/documents.routes').then((m) => m.DOCUMENTS_ROUTES),
      },
      {
        path: 'billing',
        loadChildren: () =>
          import('./features/billing/billing.routes').then((m) => m.BILLING_ROUTES),
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
