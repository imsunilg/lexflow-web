import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import { CommChannel, CommTimelineEntry } from '../models/communication.models';
import { API_BASE_URL } from './api-base-url.token';

/**
 * PRD Module 11 — "Unified client Communication tab." Real aggregation across
 * Email/SMS/WhatsApp/Call (chat is NOT included), capped at 200 rows per
 * channel with no pagination beyond that. `clientId` only — there is no
 * `matterId` filter server-side at all.
 */
@Injectable({ providedIn: 'root' })
export class CommTimelineService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  get(clientId?: string, channels?: CommChannel[]) {
    const params: Record<string, string> = {};
    if (clientId) params['clientId'] = clientId;
    if (channels && channels.length > 0) params['channels'] = channels.join(',');
    return this.http
      .get<ApiSuccessEnvelope<CommTimelineEntry[]>>(`${this.baseUrl}/comm/timeline`, { params })
      .pipe(map((envelope) => envelope.data));
  }
}
