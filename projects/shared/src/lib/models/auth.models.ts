/** Shape of `GET /auth/me` (`MeResponse`, PRD §17/§20). Authoritative session source — populated after login via `PermissionService.loadSession()`. */
export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  branchId: string | null;
  twoFaEnabled: boolean;
}

/** Shape of `GET /permissions/catalog` — the full permission-key catalog (PRD §21). */
export interface PermissionCatalogEntry {
  key: string;
  module: string;
  action: string;
  scope: 'own' | 'team' | 'branch' | 'all' | 'special';
  label: string | null;
}

/** `POST /auth/login` request body (PRD §17). */
export interface LoginRequest {
  email: string;
  password: string;
  tenantSlug: string;
}

/** The `user` field of a successful `LoginResponse` — a subset of `CurrentUser` (no email/2FA flag); `PermissionService.loadSession()` is called right after login to populate the full session. */
export interface LoginUser {
  id: string;
  name: string;
  role: string;
  permissions: string[];
  branchId: string | null;
}

/**
 * `POST /auth/login` response body. On success, `requires2fa` is `false` and
 * `accessToken`/`user` are populated (HTTP 200). When 2FA is required, the API
 * returns HTTP 428 with `requires2fa: true` and empty `accessToken`/null `user`
 * — the pending challenge itself travels as a short-lived httpOnly cookie the
 * browser already holds, not as a field in this body (AuthController.cs
 * `TwoFaRequiredResponse`), so `TwoFaVerifyRequest` below needs only the code.
 */
export interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  requires2fa: boolean;
  user: LoginUser | null;
}

/** `POST /auth/2fa/verify` request body — used both to complete a pending login and to confirm enrollment started via `POST /auth/2fa/setup`. */
export interface TwoFaVerifyRequest {
  code: string;
}

/** `POST /auth/2fa/setup` response body. */
export interface TwoFaSetupResponse {
  provisioningUri: string;
  recoveryCodes: string[];
}

/** `POST /auth/forgot` request body. Always responds 200 regardless of whether the email/tenant match — enumeration-safe (PRD §20(15)). */
export interface ForgotPasswordRequest {
  tenantSlug: string;
  email: string;
}

/** `POST /auth/reset` request body — also used for the accept-invitation flow (see accept-invitation.page.ts for why). */
export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}
