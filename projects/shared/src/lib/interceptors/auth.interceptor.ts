import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthTokenService } from '../services/auth-token.service';

const AUTH_EXCLUDED_PATHS = ['/auth/login', '/auth/refresh', '/auth/forgot', '/auth/reset'];

/**
 * Attaches the in-memory JWT access token (PRD §20(3): 15-min access token) to
 * every outgoing API request, and transparently refreshes-and-retries once on a
 * 401 using the rotating httpOnly refresh cookie. If the refresh itself fails
 * (cookie missing/expired/reuse-detected — §20(3) "family-based reuse detection"),
 * the session is unrecoverable: the token is cleared and the user is redirected to
 * `/login` with a `returnUrl` so they land back where they were after signing in
 * again, instead of the original request just failing silently.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authTokenService = inject(AuthTokenService);
  const router = inject(Router);

  if (AUTH_EXCLUDED_PATHS.some((path) => req.url.includes(path))) {
    return next(req);
  }

  const token = authTokenService.accessToken();
  const authorizedReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authorizedReq).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && token) {
        return authTokenService.refresh().pipe(
          switchMap((refreshed) =>
            next(req.clone({ setHeaders: { Authorization: `Bearer ${refreshed.accessToken}` } })),
          ),
          catchError((refreshError: unknown) => {
            router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
            return throwError(() => refreshError);
          }),
        );
      }

      return throwError(() => error);
    }),
  );
};
