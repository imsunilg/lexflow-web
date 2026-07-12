import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import { DepartmentDto, UpsertDepartmentRequest } from '../models/user-management.models';
import { API_BASE_URL } from './api-base-url.token';

/** `DepartmentsController` — full CRUD (PRD Module 14). Flat structure only: single `headUserId`, no reporting-manager chain/parent department. */
@Injectable({ providedIn: 'root' })
export class DepartmentsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  list() {
    return this.http
      .get<ApiSuccessEnvelope<DepartmentDto[]>>(`${this.baseUrl}/departments`)
      .pipe(map((envelope) => envelope.data));
  }

  get(id: string) {
    return this.http
      .get<ApiSuccessEnvelope<DepartmentDto>>(`${this.baseUrl}/departments/${id}`)
      .pipe(map((envelope) => envelope.data));
  }

  create(request: UpsertDepartmentRequest) {
    return this.http
      .post<ApiSuccessEnvelope<DepartmentDto>>(`${this.baseUrl}/departments`, request)
      .pipe(map((envelope) => envelope.data));
  }

  update(id: string, request: UpsertDepartmentRequest) {
    return this.http
      .put<ApiSuccessEnvelope<DepartmentDto>>(`${this.baseUrl}/departments/${id}`, request)
      .pipe(map((envelope) => envelope.data));
  }

  delete(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/departments/${id}`);
  }
}
