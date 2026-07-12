import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import {
  DeactivateUserRequest,
  EffectivePermissionExplanation,
  InviteUserRequest,
  SessionInfo,
  UnresolvedAssignment,
  UpdateUserRequest,
  UserDetail,
} from '../models/user-management.models';
import { UserSummary } from '../models/user.models';
import { API_BASE_URL } from './api-base-url.token';

/**
 * `GET /users` — gated by `users.read.all`; callers without it should catch
 * 403 and degrade gracefully (e.g. an empty picker). Also covers the rest of
 * `UsersController` (PRD Module 14) — invite, detail, update, lifecycle,
 * unresolved-assignments, effective-permissions, sessions. See
 * `user-management.models.ts`'s file-header comment for confirmed gaps
 * (no photo/signature upload, no working hours, notification prefs are
 * write-only, cost rate isn't visibility-restricted).
 */
@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  list() {
    return this.http
      .get<ApiSuccessEnvelope<UserSummary[]>>(`${this.baseUrl}/users`)
      .pipe(map((envelope) => envelope.data));
  }

  get(id: string) {
    return this.http
      .get<ApiSuccessEnvelope<UserDetail>>(`${this.baseUrl}/users/${id}`)
      .pipe(map((envelope) => envelope.data));
  }

  invite(request: InviteUserRequest) {
    return this.http
      .post<ApiSuccessEnvelope<UserDetail>>(`${this.baseUrl}/users/invite`, request)
      .pipe(map((envelope) => envelope.data));
  }

  update(id: string, request: UpdateUserRequest) {
    return this.http
      .put<ApiSuccessEnvelope<UserDetail>>(`${this.baseUrl}/users/${id}`, request)
      .pipe(map((envelope) => envelope.data));
  }

  suspend(id: string) {
    return this.http
      .post<ApiSuccessEnvelope<UserDetail>>(`${this.baseUrl}/users/${id}/suspend`, {})
      .pipe(map((envelope) => envelope.data));
  }

  reactivate(id: string) {
    return this.http
      .post<ApiSuccessEnvelope<UserDetail>>(`${this.baseUrl}/users/${id}/reactivate`, {})
      .pipe(map((envelope) => envelope.data));
  }

  unresolvedAssignments(id: string) {
    return this.http
      .get<ApiSuccessEnvelope<UnresolvedAssignment[]>>(
        `${this.baseUrl}/users/${id}/unresolved-assignments`,
      )
      .pipe(map((envelope) => envelope.data));
  }

  deactivate(id: string, request: DeactivateUserRequest) {
    return this.http
      .post<ApiSuccessEnvelope<UserDetail>>(`${this.baseUrl}/users/${id}/deactivate`, request)
      .pipe(map((envelope) => envelope.data));
  }

  /** `resource` is accepted by the endpoint but ignored server-side — it always explains the user's full effective permission set, never a single resource. */
  effectivePermissions(id: string) {
    return this.http
      .get<ApiSuccessEnvelope<EffectivePermissionExplanation[]>>(
        `${this.baseUrl}/users/${id}/effective-permissions`,
      )
      .pipe(map((envelope) => envelope.data));
  }

  sessions(id: string) {
    return this.http
      .get<ApiSuccessEnvelope<SessionInfo[]>>(`${this.baseUrl}/users/${id}/sessions`)
      .pipe(map((envelope) => envelope.data));
  }
}
