import { Routes } from '@angular/router';

/** PRD §13 nav: "Communication (Inbox | SMS | WhatsApp | Calls)". */
export const COMMUNICATION_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'inbox' },
  {
    path: 'inbox',
    loadComponent: () => import('./inbox/email-inbox.page').then((m) => m.EmailInboxPage),
    data: { permission: 'comm.email.read' },
  },
  {
    path: 'sms',
    loadComponent: () => import('./sms/sms-pane.page').then((m) => m.SmsPanePage),
    data: { permission: 'comm.sms.read' },
  },
  {
    path: 'whatsapp',
    loadComponent: () => import('./whatsapp/whatsapp-pane.page').then((m) => m.WhatsAppPanePage),
    data: { permission: 'comm.whatsapp.read' },
  },
  {
    path: 'calls',
    loadComponent: () => import('./calls/calls.page').then((m) => m.CallsPage),
    data: { permission: 'comm.calls.read' },
  },
];
