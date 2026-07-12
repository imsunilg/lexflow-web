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
        loadChildren: () => import('./features/time/time.routes').then((m) => m.TIME_ROUTES),
      },
      {
        path: 'tasks',
        loadChildren: () => import('./features/tasks/tasks.routes').then((m) => m.TASKS_ROUTES),
      },
      {
        path: 'communication',
        loadChildren: () =>
          import('./features/communication/communication.routes').then(
            (m) => m.COMMUNICATION_ROUTES,
          ),
      },
      {
        path: 'knowledge-base',
        loadChildren: () =>
          import('./features/knowledge-base/knowledge-base.routes').then(
            (m) => m.KNOWLEDGE_BASE_ROUTES,
          ),
      },
      {
        path: 'reports',
        loadChildren: () =>
          import('./features/reports/reports.routes').then((m) => m.REPORTS_ROUTES),
        data: { permission: 'reports.operational.own' },
      },
      {
        path: 'ai-studio',
        loadChildren: () => import('./features/ai/ai.routes').then((m) => m.AI_ROUTES),
        data: { permission: 'ai.use.own' },
      },
      {
        path: 'admin',
        loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
        data: { permission: 'users.read.all' },
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
