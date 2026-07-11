import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import { SearchResultGroup } from '../models/search.models';
import { API_BASE_URL } from './api-base-url.token';

/**
 * `GET /search?q=` (PRD §26 global federated search). Build Playbook Prompt D-1
 * calls the ⌘K overlay "a stub calling GET /search" — that endpoint isn't built
 * server-side yet (no SearchController exists in lexflow-api as of this writing),
 * so every call here will 404 until it ships. The overlay component treats that
 * the same as a zero-results response (see search-overlay.component.ts) rather
 * than a hard error, so the UI is otherwise complete and just needs the backend.
 */
@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  search(query: string): Observable<SearchResultGroup[]> {
    return this.http
      .get<ApiSuccessEnvelope<SearchResultGroup[]>>(`${this.baseUrl}/search`, {
        params: { q: query },
      })
      .pipe(map((envelope) => envelope.data));
  }
}
