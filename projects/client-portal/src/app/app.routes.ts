import { Routes } from '@angular/router';
import { authGuard } from 'shared';
import { ForgotPasswordPage } from './features/auth/forgot-password.page';
import { LoginPage } from './features/auth/login.page';
import { ResetPasswordPage } from './features/auth/reset-password.page';
import { ShellComponent } from './shell/shell.component';

export const routes: Routes = [
  { path: 'login', component: LoginPage },
  { path: 'forgot-password', component: ForgotPasswordPage },
  { path: 'reset-password', component: ResetPasswordPage },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      {
        path: 'home',
        loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage),
      },
      {
        path: 'matters',
        loadComponent: () => import('./features/matters/matters.page').then((m) => m.MattersPage),
      },
      {
        path: 'matters/:id',
        loadComponent: () =>
          import('./features/matters/matter-timeline.page').then((m) => m.MatterTimelinePage),
      },
      {
        path: 'invoices',
        loadComponent: () =>
          import('./features/invoices/invoices.page').then((m) => m.InvoicesPage),
      },
      {
        path: 'documents',
        loadComponent: () =>
          import('./features/documents/documents.page').then((m) => m.DocumentsPage),
      },
      {
        path: 'appointments',
        loadComponent: () =>
          import('./features/appointments/appointments.page').then((m) => m.AppointmentsPage),
      },
      {
        path: 'messages',
        loadComponent: () =>
          import('./features/messages/messages.page').then((m) => m.MessagesPage),
      },
      {
        path: 'messages/:threadId',
        loadComponent: () =>
          import('./features/messages/thread-detail.page').then((m) => m.ThreadDetailPage),
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile.page').then((m) => m.ProfilePage),
      },
    ],
  },
  { path: '**', redirectTo: 'home' },
];
