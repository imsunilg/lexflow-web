import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import { TeamDto, UpsertTeamRequest } from '../models/user-management.models';
import { API_BASE_URL } from './api-base-url.token';

/** `TeamsController` — full CRUD (PRD Module 14). */
@Injectable({ providedIn: 'root' })
export class TeamsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  list() {
    return this.http
      .get<ApiSuccessEnvelope<TeamDto[]>>(`${this.baseUrl}/teams`)
      .pipe(map((envelope) => envelope.data));
  }

  get(id: string) {
    return this.http
      .get<ApiSuccessEnvelope<TeamDto>>(`${this.baseUrl}/teams/${id}`)
      .pipe(map((envelope) => envelope.data));
  }

  create(request: UpsertTeamRequest) {
    return this.http
      .post<ApiSuccessEnvelope<TeamDto>>(`${this.baseUrl}/teams`, request)
      .pipe(map((envelope) => envelope.data));
  }

  update(id: string, request: UpsertTeamRequest) {
    return this.http
      .put<ApiSuccessEnvelope<TeamDto>>(`${this.baseUrl}/teams/${id}`, request)
      .pipe(map((envelope) => envelope.data));
  }

  delete(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/teams/${id}`);
  }
}
