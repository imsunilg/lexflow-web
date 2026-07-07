import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';
import { ApiErrorEnvelope } from '../models/api-envelope.models';

/**
 * Surfaces the error envelope (PRD §17/§28) as a toast for server-side (5xx) and
 * network failures, then rethrows so callers still handle 400/422 field errors
 * and 409 concurrency inline. Never shown for 401 (handled by silent refresh in
 * `auth.interceptor.ts`) since that either succeeds transparently or redirects.
 */
export const errorEnvelopeInterceptor: HttpInterceptorFn = (req, next) => {
  const snackBar = inject(MatSnackBar);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status !== 401) {
        const envelope = error.error as Partial<ApiErrorEnvelope> | null;
        const message = envelope?.error?.message ?? 'Something went wrong. Please try again.';

        if (error.status === 0 || error.status >= 500) {
          snackBar.open(message, 'Dismiss', { duration: 6000 });
        }
      }

      return throwError(() => error);
    }),
  );
};
