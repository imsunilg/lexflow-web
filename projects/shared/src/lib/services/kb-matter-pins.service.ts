import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import { KbMatterPin, PinKbItemRequest } from '../models/kb.models';
import { API_BASE_URL } from './api-base-url.token';

/** PRD Module 12 — matter Research tab pins. Gated by `matters.read.all` (follows the matter's own ACL, not a separate KB permission). */
@Injectable({ providedIn: 'root' })
export class KbMatterPinsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  list(matterId: string) {
    return this.http
      .get<ApiSuccessEnvelope<KbMatterPin[]>>(`${this.baseUrl}/matters/${matterId}/kb-pins`)
      .pipe(map((envelope) => envelope.data));
  }

  /** Freezes a snapshot of the source's text at pin time — later edits/unpublish/delete of the source never change it. */
  pin(matterId: string, request: PinKbItemRequest) {
    return this.http
      .post<ApiSuccessEnvelope<KbMatterPin>>(`${this.baseUrl}/matters/${matterId}/kb-pins`, request)
      .pipe(map((envelope) => envelope.data));
  }

  unpin(matterId: string, pinId: string) {
    return this.http.delete<void>(`${this.baseUrl}/matters/${matterId}/kb-pins/${pinId}`);
  }
}
