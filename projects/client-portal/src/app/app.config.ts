import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  isDevMode,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import {
  API_BASE_URL,
  authInterceptor,
  errorEnvelopeInterceptor,
  idempotencyKeyInterceptor,
} from 'shared';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideNativeDateAdapter(),
    // Separate JWT audience `portal` per PRD §20(3)/Module 17 — distinct base path
    // from the staff app's `/api/v1`.
    { provide: API_BASE_URL, useValue: '/api/portal/v1' },
    provideHttpClient(
      withInterceptors([authInterceptor, errorEnvelopeInterceptor, idempotencyKeyInterceptor]),
    ),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
