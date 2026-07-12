import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import { KbJudgment } from '../models/kb.models';
import { API_BASE_URL } from './api-base-url.token';

/** PRD Module 12 — judgments/case law (`kb.read.all`). */
@Injectable({ providedIn: 'root' })
export class KbJudgmentsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  list() {
    return this.http
      .get<ApiSuccessEnvelope<KbJudgment[]>>(`${this.baseUrl}/kb/judgments`)
      .pipe(map((envelope) => envelope.data));
  }

  get(id: string) {
    return this.http
      .get<ApiSuccessEnvelope<KbJudgment>>(`${this.baseUrl}/kb/judgments/${id}`)
      .pipe(map((envelope) => envelope.data));
  }

  /** Counts pin *rows*, not distinct matters — a judgment pinned twice into the same matter is over-counted (confirmed backend behavior, no generic deduped endpoint exists). */
  pinCount(id: string) {
    return this.http
      .get<ApiSuccessEnvelope<number>>(`${this.baseUrl}/kb/judgments/${id}/pin-count`)
      .pipe(map((envelope) => envelope.data));
  }
}
