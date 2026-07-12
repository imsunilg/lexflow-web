import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, finalize, map, tap } from 'rxjs';
import { API_BASE_URL, ApiSuccessEnvelope, AuthTokenService } from 'shared';
import {
  PortalForgotPasswordRequest,
  PortalLoginRequest,
  PortalLoginResponse,
  PortalResetPasswordRequest,
} from '../models/portal.models';
import { PortalSessionService } from './portal-session.service';

/**
 * `PortalAuthController` (`api/portal/v1/auth/*`). Deliberately does NOT reuse
 * `shared`'s `AuthService` — that class also hydrates `PermissionService` via
 * `GET /auth/me` + `GET /permissions/catalog`, which are staff-only RBAC
 * endpoints that don't exist under the portal's "Portal" JWT scheme. Reusing
 * it here would either 404 against the real backend or, worse, blur the
 * identity-separation boundary the PRD requires (§20). This service only
 * calls the confirmed real portal auth routes and stores state in the two
 * portal-local, in-memory-only holders (`AuthTokenService` for the token —
 * generic infra, safe to share — and `PortalSessionService` for the user).
 */
@Injectable({ providedIn: 'root' })
export class PortalAuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/portal/v1';
  private readonly authTokenService = inject(AuthTokenService);
  private readonly session = inject(PortalSessionService);

  login(request: PortalLoginRequest): Observable<PortalLoginResponse> {
    return this.http
      .post<ApiSuccessEnvelope<PortalLoginResponse>>(`${this.baseUrl}/auth/login`, request)
      .pipe(
        map((envelope) => envelope.data),
        tap((response) => {
          this.authTokenService.setAccessToken(response.accessToken);
          this.session.set(response.user);
        }),
      );
  }

  forgotPassword(request: PortalForgotPasswordRequest): Observable<void> {
    return this.http
      .post<ApiSuccessEnvelope<object>>(`${this.baseUrl}/auth/forgot`, request)
      .pipe(map(() => undefined));
  }

  /** Also used for the accept-invitation flow (PRD Module 17 step 1) — the backend's `/auth/reset` handles both. */
  resetPassword(request: PortalResetPasswordRequest): Observable<void> {
    return this.http
      .post<ApiSuccessEnvelope<object>>(`${this.baseUrl}/auth/reset`, request)
      .pipe(map(() => undefined));
  }

  /** Clears local session state in `finalize`, not `tap`, so a failed server call (network blip, already-expired session) never leaves the client believing it's still authenticated. */
  logout(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/auth/logout`, {}).pipe(
      finalize(() => {
        this.authTokenService.clear();
        this.session.clear();
      }),
    );
  }
}
