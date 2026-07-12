import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import { CreateRoleRequest, RoleDto, UpdateRoleRequest } from '../models/user-management.models';
import { API_BASE_URL } from './api-base-url.token';

/** `RolesController` (PRD Module 14). No DELETE route exists — roles can't be removed via the API. System roles reject `PUT` server-side (403). */
@Injectable({ providedIn: 'root' })
export class RolesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  list() {
    return this.http
      .get<ApiSuccessEnvelope<RoleDto[]>>(`${this.baseUrl}/roles`)
      .pipe(map((envelope) => envelope.data));
  }

  get(id: string) {
    return this.http
      .get<ApiSuccessEnvelope<RoleDto>>(`${this.baseUrl}/roles/${id}`)
      .pipe(map((envelope) => envelope.data));
  }

  create(request: CreateRoleRequest) {
    return this.http
      .post<ApiSuccessEnvelope<RoleDto>>(`${this.baseUrl}/roles`, request)
      .pipe(map((envelope) => envelope.data));
  }

  update(id: string, request: UpdateRoleRequest) {
    return this.http
      .put<ApiSuccessEnvelope<RoleDto>>(`${this.baseUrl}/roles/${id}`, request)
      .pipe(map((envelope) => envelope.data));
  }
}
