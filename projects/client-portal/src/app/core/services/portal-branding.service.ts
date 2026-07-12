import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, of, tap } from 'rxjs';
import { API_BASE_URL, ApiSuccessEnvelope } from 'shared';
import { PortalBranding } from '../models/portal.models';

/**
 * Firm-branded theming (PRD Module 17: "firm-branded (logo/colors from
 * Settings)"). Calls the endpoint the PRD names, `GET .../branding` — but
 * backend research (reading every controller under `Controllers/Portal/`)
 * confirmed no such endpoint, route, or DTO exists anywhere in the solution
 * today. This call is real and forward-compatible (it'll start working the
 * moment the backend adds the route) but is expected to 404 in the meantime;
 * on any error this silently keeps the shared library's default LexFlow
 * theme (`_tokens.scss`) rather than surfacing an error toast — a missing
 * branding endpoint is not something a client user should ever see as a
 * failure.
 */
@Injectable({ providedIn: 'root' })
export class PortalBrandingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/portal/v1';

  private readonly brandingSignal = signal<PortalBranding | null>(null);
  readonly branding = this.brandingSignal.asReadonly();

  loadAndApply() {
    return this.http.get<ApiSuccessEnvelope<PortalBranding>>(`${this.baseUrl}/branding`).pipe(
      tap((envelope) => {
        this.brandingSignal.set(envelope.data);
        this.applyTheme(envelope.data);
      }),
      catchError(() => of(null)),
    );
  }

  private applyTheme(branding: PortalBranding): void {
    const root = document.documentElement.style;
    if (branding.primaryColor) root.setProperty('--lf-primary', branding.primaryColor);
    if (branding.accentColor) root.setProperty('--lf-accent', branding.accentColor);
  }
}
