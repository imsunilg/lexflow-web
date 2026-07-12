import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from './api-base-url.token';

/** `SessionsController` — `DELETE /sessions/{id}` revokes one session (PRD Module 14). Listing a user's sessions is `UsersService.sessions(userId)`. */
@Injectable({ providedIn: 'root' })
export class SessionsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  revoke(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/sessions/${id}`);
  }
}
