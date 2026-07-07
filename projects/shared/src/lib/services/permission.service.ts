import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { CurrentUser, PermissionCatalogEntry } from '../models/auth.models';
import { API_BASE_URL } from './api-base-url.token';

/**
 * Loads the authenticated user (`GET /auth/me`) and the full permission catalog
 * (`GET /permissions/catalog`) once per session, then answers `has(key)` checks
 * synchronously from the cached permission set (PRD §20(4): `module.action.scope`
 * format, deny-by-default). The nav shell and route guards both read this.
 */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  private readonly currentUserSignal = signal<CurrentUser | null>(null);
  private readonly catalogSignal = signal<PermissionCatalogEntry[]>([]);

  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly catalog = this.catalogSignal.asReadonly();
  readonly permissionSet = computed(() => new Set(this.currentUserSignal()?.permissions ?? []));

  loadSession() {
    return this.http
      .get<CurrentUser>(`${this.baseUrl}/auth/me`)
      .pipe(tap((user) => this.currentUserSignal.set(user)));
  }

  loadCatalog() {
    return this.http
      .get<PermissionCatalogEntry[]>(`${this.baseUrl}/permissions/catalog`)
      .pipe(tap((catalog) => this.catalogSignal.set(catalog)));
  }

  has(permissionKey: string): boolean {
    return this.permissionSet().has(permissionKey);
  }

  hasAny(permissionKeys: string[]): boolean {
    return permissionKeys.some((key) => this.has(key));
  }

  clear(): void {
    this.currentUserSignal.set(null);
    this.catalogSignal.set([]);
  }
}
