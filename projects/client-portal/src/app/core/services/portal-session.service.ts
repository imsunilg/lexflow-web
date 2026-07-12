import { Injectable, signal } from '@angular/core';
import { PortalLoginUser } from '../models/portal.models';

/**
 * Holds the logged-in portal user's identity in memory only (mirrors
 * `AuthTokenService`'s in-memory-only access token, PRD §20(3)) — there is no
 * portal equivalent of staff's `GET /auth/me`, so this is populated directly
 * from the login response and cleared on logout, not re-fetched.
 */
@Injectable({ providedIn: 'root' })
export class PortalSessionService {
  private readonly userSignal = signal<PortalLoginUser | null>(null);
  readonly user = this.userSignal.asReadonly();

  set(user: PortalLoginUser): void {
    this.userSignal.set(user);
  }

  clear(): void {
    this.userSignal.set(null);
  }
}
