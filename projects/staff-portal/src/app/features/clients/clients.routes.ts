import { Routes } from '@angular/router';

/** PRD Module 3 Screen List: client list, create stepper, and 360° detail are separate screens. */
export const CLIENTS_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'list' },
  {
    path: 'list',
    loadComponent: () => import('./list/clients-list.page').then((m) => m.ClientsListPage),
    data: { permission: 'clients.read' },
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./create/client-create-stepper.page').then((m) => m.ClientCreateStepperPage),
    data: { permission: 'clients.create' },
  },
  {
    path: ':id',
    loadComponent: () => import('./detail/client-detail.page').then((m) => m.ClientDetailPage),
    data: { permission: 'clients.read' },
  },
];
