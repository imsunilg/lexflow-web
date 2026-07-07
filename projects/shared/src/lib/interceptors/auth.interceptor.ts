import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthTokenService } from '../services/auth-token.service';

const AUTH_EXCLUDED_PATHS = ['/auth/login', '/auth/refresh', '/auth/forgot', '/auth/reset'];

/**
 * Attaches the in-memory JWT access token (PRD §20(3): 15-min access token) to
 * every outgoing API request, and transparently refreshes-and-retries once on a
 * 401 using the rotating httpOnly refresh cookie.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authTokenService = inject(AuthTokenService);

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
        return authTokenService
          .refresh()
          .pipe(
            switchMap((refreshed) =>
              next(req.clone({ setHeaders: { Authorization: `Bearer ${refreshed.accessToken}` } })),
            ),
          );
      }

      return throwError(() => error);
    }),
  );
};
