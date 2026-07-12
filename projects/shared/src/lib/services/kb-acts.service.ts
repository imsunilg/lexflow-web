import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import { AmendKbActSectionRequest, KbAct, KbActSection } from '../models/kb.models';
import { API_BASE_URL } from './api-base-url.token';

/** PRD Module 12 — Acts + sections (`kb.read.all`/`kb.contribute.all`). */
@Injectable({ providedIn: 'root' })
export class KbActsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  listActs() {
    return this.http
      .get<ApiSuccessEnvelope<KbAct[]>>(`${this.baseUrl}/kb/acts`)
      .pipe(map((envelope) => envelope.data));
  }

  getAct(id: string) {
    return this.http
      .get<ApiSuccessEnvelope<KbAct | null>>(`${this.baseUrl}/kb/acts/${id}`)
      .pipe(map((envelope) => envelope.data));
  }

  /** Flat list ordered by section number — no chapter/hierarchy grouping endpoint exists; reconstruct the tree from `parentId` client-side. */
  listSections(actId: string) {
    return this.http
      .get<ApiSuccessEnvelope<KbActSection[]>>(`${this.baseUrl}/kb/acts/${actId}/sections`)
      .pipe(map((envelope) => envelope.data));
  }

  getSection(id: string) {
    return this.http
      .get<ApiSuccessEnvelope<KbActSection>>(`${this.baseUrl}/kb/sections/${id}`)
      .pipe(map((envelope) => envelope.data));
  }

  lookupSection(act: string, number: string) {
    return this.http
      .get<ApiSuccessEnvelope<KbActSection | null>>(`${this.baseUrl}/kb/sections/lookup`, {
        params: { act, number },
      })
      .pipe(map((envelope) => envelope.data));
  }

  /** Resolves the section text as it stood on `asOf` — real, DB-backed effective-dating (not aspirational). */
  sectionAsOf(actId: string, number: string, asOf: string) {
    return this.http
      .get<ApiSuccessEnvelope<KbActSection | null>>(
        `${this.baseUrl}/kb/acts/${actId}/sections/${number}/as-of`,
        { params: { asOf } },
      )
      .pipe(map((envelope) => envelope.data));
  }

  /** All historical rows (including closed-out amended versions) for this section number, oldest first. */
  sectionHistory(actId: string, number: string) {
    return this.http
      .get<ApiSuccessEnvelope<KbActSection[]>>(
        `${this.baseUrl}/kb/acts/${actId}/sections/${number}/history`,
      )
      .pipe(map((envelope) => envelope.data));
  }

  /** Closes the current row and inserts a new one — append-only history, not an in-place edit. */
  amendSection(sectionId: string, request: AmendKbActSectionRequest) {
    return this.http
      .post<ApiSuccessEnvelope<KbActSection>>(
        `${this.baseUrl}/kb/sections/${sectionId}/amend`,
        request,
      )
      .pipe(map((envelope) => envelope.data));
  }
}
