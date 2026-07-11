import { Routes } from '@angular/router';

/** PRD Module 6 nav: calendar grid + settings (sync/reminders/ICS export). */
export const CALENDAR_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'view' },
  {
    path: 'view',
    loadComponent: () => import('./calendar-page').then((m) => m.CalendarPage),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./settings/calendar-settings.page').then((m) => m.CalendarSettingsPage),
  },
];
