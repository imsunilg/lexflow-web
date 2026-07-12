import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL, ApiSuccessEnvelope } from 'shared';
import { PortalMatterSummary, PortalMatterTimeline } from '../models/portal.models';

/** `PortalMattersController` (`api/portal/v1/me/matters`, `.../matters/{id}/timeline`). Object-level scoping (tenant + clientId + per-user visible-matter subset) is enforced entirely server-side from the JWT — never passed client-side. */
@Injectable({ providedIn: 'root' })
export class PortalMattersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/portal/v1';

  getMyMatters(): Observable<PortalMatterSummary[]> {
    return this.http
      .get<ApiSuccessEnvelope<PortalMatterSummary[]>>(`${this.baseUrl}/me/matters`)
      .pipe(map((envelope) => envelope.data));
  }

  /** Sanitized timeline: hearings + published outcomes only (`PortalVisible` flags) — never internal notes/strategy. Unauthorized/foreign matter ids come back 404 (enumeration-safe), not 403. */
  getTimeline(matterId: string): Observable<PortalMatterTimeline> {
    return this.http
      .get<ApiSuccessEnvelope<PortalMatterTimeline>>(`${this.baseUrl}/matters/${matterId}/timeline`)
      .pipe(map((envelope) => envelope.data));
  }
}
