import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import { BranchDto, UpsertBranchRequest } from '../models/user-management.models';
import { API_BASE_URL } from './api-base-url.token';

/** `BranchesController` — full CRUD (PRD Module 14). No holiday-calendar sub-resource; `gstin` is India-GST-registration-number, not the PRD's generic "default tax place-of-supply". */
@Injectable({ providedIn: 'root' })
export class BranchesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  list() {
    return this.http
      .get<ApiSuccessEnvelope<BranchDto[]>>(`${this.baseUrl}/branches`)
      .pipe(map((envelope) => envelope.data));
  }

  get(id: string) {
    return this.http
      .get<ApiSuccessEnvelope<BranchDto>>(`${this.baseUrl}/branches/${id}`)
      .pipe(map((envelope) => envelope.data));
  }

  create(request: UpsertBranchRequest) {
    return this.http
      .post<ApiSuccessEnvelope<BranchDto>>(`${this.baseUrl}/branches`, request)
      .pipe(map((envelope) => envelope.data));
  }

  update(id: string, request: UpsertBranchRequest) {
    return this.http
      .put<ApiSuccessEnvelope<BranchDto>>(`${this.baseUrl}/branches/${id}`, request)
      .pipe(map((envelope) => envelope.data));
  }

  delete(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/branches/${id}`);
  }
}
