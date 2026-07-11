import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import {
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  ResetPasswordRequest,
  TwoFaSetupResponse,
  TwoFaVerifyRequest,
} from '../models/auth.models';
import { API_BASE_URL } from './api-base-url.token';
import { AuthTokenService } from './auth-token.service';
import { PermissionService } from './permission.service';

/**
 * Thin wrapper over the C-1 auth endpoints (PRD §17/§20) that also orchestrates the
 * two services that hold session state: on any successful login/2FA-completion, it
 * stashes the access token in `AuthTokenService` and immediately hydrates
 * `PermissionService` (`loadSession` + `loadCatalog`) so nav trimming and route
 * guards have real permission data the moment the user lands in the shell —
 * previously nothing called those two methods at all.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';
  private readonly authTokenService = inject(AuthTokenService);
  private readonly permissionService = inject(PermissionService);

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<ApiSuccessEnvelope<LoginResponse>>(`${this.baseUrl}/auth/login`, request)
      .pipe(
        map((envelope) => envelope.data),
        switchMap((response) => this.hydrateIfAuthenticated(response)),
      );
  }

  /** Completes a pending login (HTTP 428 from `login()`) or confirms 2FA enrollment, per `TwoFaVerifyRequest`'s doc comment — same endpoint, disambiguated server-side by cookie vs. bearer token. */
  verifyTwoFactor(request: TwoFaVerifyRequest): Observable<LoginResponse> {
    return this.http
      .post<ApiSuccessEnvelope<LoginResponse>>(`${this.baseUrl}/auth/2fa/verify`, request)
      .pipe(
        map((envelope) => envelope.data),
        switchMap((response) => this.hydrateIfAuthenticated(response)),
      );
  }

  setupTwoFactor(): Observable<TwoFaSetupResponse> {
    return this.http
      .post<ApiSuccessEnvelope<TwoFaSetupResponse>>(`${this.baseUrl}/auth/2fa/setup`, {})
      .pipe(map((envelope) => envelope.data));
  }

  forgotPassword(request: ForgotPasswordRequest): Observable<void> {
    return this.http
      .post<ApiSuccessEnvelope<object>>(`${this.baseUrl}/auth/forgot`, request)
      .pipe(map(() => undefined));
  }

  /** Also used for the accept-invitation flow — see accept-invitation.page.ts. */
  resetPassword(request: ResetPasswordRequest): Observable<void> {
    return this.http
      .post<ApiSuccessEnvelope<object>>(`${this.baseUrl}/auth/reset`, request)
      .pipe(map(() => undefined));
  }

  /**
   * Clears local session state (token + permissions) in `finalize`, not `tap` —
   * the server-side call revokes the refresh cookie, but a failed request (network
   * blip, already-expired session) must not leave the client believing it's still
   * authenticated. The caller navigates to `/login` regardless of outcome.
   */
  logout(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/auth/logout`, {}).pipe(
      finalize(() => {
        this.authTokenService.clear();
        this.permissionService.clear();
      }),
    );
  }

  private hydrateIfAuthenticated(response: LoginResponse): Observable<LoginResponse> {
    if (response.requires2fa || !response.accessToken) {
      return of(response);
    }

    this.authTokenService.setAccessToken(response.accessToken);
    return forkJoin([
      this.permissionService.loadSession(),
      this.permissionService.loadCatalog(),
    ]).pipe(map(() => response));
  }
}
