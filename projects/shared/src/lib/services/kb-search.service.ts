import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import { KbSearchParams, KbSearchResult } from '../models/kb.models';
import { API_BASE_URL } from './api-base-url.token';

/**
 * PRD Module 12 — KB search. Real Elasticsearch-backed full-text search
 * (not a naive per-table LIKE), with a citation/section-lookup parser layered
 * in front of it: a recognized `"IPC 420"` shape resolves `directSection`
 * directly from Postgres (bypassing ES, for AC-KB1's <500ms budget), a
 * recognized citation format resolves `directJudgment` directly, and
 * anything else falls through to the general ES query with
 * `isFreeformFallback: true`. Hit snippets are always `null` — ES
 * highlighting is not wired up despite the field existing on the DTO.
 */
@Injectable({ providedIn: 'root' })
export class KbSearchService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  search(params: KbSearchParams) {
    const query: Record<string, string> = { q: params.q };
    if (params.type) query['type'] = params.type;
    if (params.courtId) query['courtId'] = params.courtId;
    if (params.yearFrom !== undefined) query['yearFrom'] = String(params.yearFrom);
    if (params.tag) query['tag'] = params.tag;

    return this.http
      .get<ApiSuccessEnvelope<KbSearchResult>>(`${this.baseUrl}/kb/search`, { params: query })
      .pipe(map((envelope) => envelope.data));
  }
}
