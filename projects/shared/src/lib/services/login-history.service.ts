import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import { LoginHistoryEntry } from '../models/user-management.models';
import { API_BASE_URL } from './api-base-url.token';

/** `GET /login-history?userId=&from=` (`LoginHistoryController`, permission `audit.read.own` — a different key than the rest of Module 14). No geo field exists — IP/UA/outcome only. */
@Injectable({ providedIn: 'root' })
export class LoginHistoryService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  list(userId?: string, from?: string) {
    let params = new HttpParams();
    if (userId) params = params.set('userId', userId);
    if (from) params = params.set('from', from);
    return this.http
      .get<ApiSuccessEnvelope<LoginHistoryEntry[]>>(`${this.baseUrl}/login-history`, { params })
      .pipe(map((envelope) => envelope.data));
  }
}
