import { Routes } from '@angular/router';
import { authGuard } from 'shared';
import { LoginPage } from './features/auth/login.page';
import { ShellComponent } from './shell/shell.component';

export const routes: Routes = [
  { path: 'login', component: LoginPage },
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
        path: 'profile',
        loadComponent: () => import('./features/profile/profile.page').then((m) => m.ProfilePage),
      },
    ],
  },
  { path: '**', redirectTo: 'home' },
];
