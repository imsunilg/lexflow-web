import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import { DashboardLayout } from '../models/dashboard.models';
import { API_BASE_URL } from './api-base-url.token';

/**
 * `GET`/`PUT /dashboard/layout` (PRD Module 1) — the per-user, per-tenant
 * `user_dashboard_layouts.layout_json` row. `getLayout()` 404s for a user who
 * has never customized their dashboard; callers should fall back to the widget
 * catalog's default order rather than surfacing that as an error.
 */
@Injectable({ providedIn: 'root' })
export class DashboardLayoutService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  getLayout(): Observable<DashboardLayout> {
    return this.http
      .get<ApiSuccessEnvelope<DashboardLayout>>(`${this.baseUrl}/dashboard/layout`)
      .pipe(map((envelope) => envelope.data));
  }

  saveLayout(layout: DashboardLayout): Observable<DashboardLayout> {
    return this.http
      .put<ApiSuccessEnvelope<DashboardLayout>>(`${this.baseUrl}/dashboard/layout`, layout)
      .pipe(map((envelope) => envelope.data));
  }
}
