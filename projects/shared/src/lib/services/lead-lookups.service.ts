import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import { LeadSource, LostReason } from '../models/lead.models';
import { API_BASE_URL } from './api-base-url.token';

/**
 * Seeded demo-tenant lost reasons (`lexflow-database/Scripts/16_Seed/007_Lost_Reasons.sql`),
 * used only as a fallback when `GET /leads/lost-reasons` 404s — no
 * `LostReasonsController`/`LeadSourcesController` exists in lexflow-api yet
 * (only the `crm.lost_reasons`/`crm.lead_sources` tables do), so this keeps
 * the lost-reason dialog usable ahead of those read endpoints shipping.
 */
const FALLBACK_LOST_REASONS: LostReason[] = [
  { id: 'went-with-another-firm', name: 'Went with another firm' },
  { id: 'budget-mismatch', name: 'Budget mismatch' },
  { id: 'handling-in-house', name: 'Handling in-house' },
  { id: 'not-pursuing-the-matter', name: 'Not pursuing the matter' },
  { id: 'unresponsive', name: 'Unresponsive' },
  { id: 'conflict-of-interest', name: 'Conflict of interest' },
  { id: 'out-of-practice-area', name: 'Out of practice area' },
  { id: 'duplicate-spam', name: 'Duplicate/spam' },
];

@Injectable({ providedIn: 'root' })
export class LeadLookupsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  lostReasons(): Observable<LostReason[]> {
    return this.http
      .get<ApiSuccessEnvelope<LostReason[]>>(`${this.baseUrl}/leads/lost-reasons`)
      .pipe(
        map((envelope) => envelope.data),
        catchError(() => of(FALLBACK_LOST_REASONS)),
      );
  }

  sources(): Observable<LeadSource[]> {
    return this.http.get<ApiSuccessEnvelope<LeadSource[]>>(`${this.baseUrl}/leads/sources`).pipe(
      map((envelope) => envelope.data),
      catchError(() => of<LeadSource[]>([])),
    );
  }
}
