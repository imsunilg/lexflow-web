import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, finalize, tap } from 'rxjs';
import { API_BASE_URL } from './api-base-url.token';

interface RefreshResponse {
  accessToken: string;
  expiresIn: number;
}

/**
 * Holds the short-lived JWT access token in memory (never localStorage, per PRD
 * §20(3)) and refreshes it via the httpOnly rotating refresh-token cookie.
 * The refresh call itself is excluded from the auth interceptor to avoid a loop
 * (see `auth.interceptor.ts`).
 */
@Injectable({ providedIn: 'root' })
export class AuthTokenService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  private readonly accessTokenSignal = signal<string | null>(null);
  readonly accessToken = this.accessTokenSignal.asReadonly();

  private refreshInFlight$: Observable<RefreshResponse> | null = null;

  setAccessToken(token: string | null): void {
    this.accessTokenSignal.set(token);
  }

  isAuthenticated(): boolean {
    return this.accessTokenSignal() !== null;
  }

  /** Coalesces concurrent 401s into a single in-flight refresh call. */
  refresh(): Observable<RefreshResponse> {
    this.refreshInFlight$ ??= this.http
      .post<RefreshResponse>(`${this.baseUrl}/auth/refresh`, {})
      .pipe(
        tap({
          next: (response) => this.setAccessToken(response.accessToken),
          error: () => this.setAccessToken(null),
        }),
        finalize(() => (this.refreshInFlight$ = null)),
      );

    return this.refreshInFlight$;
  }

  clear(): void {
    this.setAccessToken(null);
  }
}
