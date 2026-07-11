import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { map, tap } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
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
    return this.http.get<ApiSuccessEnvelope<CurrentUser>>(`${this.baseUrl}/auth/me`).pipe(
      map((envelope) => envelope.data),
      tap((user) => this.currentUserSignal.set(user)),
    );
  }

  loadCatalog() {
    return this.http
      .get<ApiSuccessEnvelope<PermissionCatalogEntry[]>>(`${this.baseUrl}/permissions/catalog`)
      .pipe(
        map((envelope) => envelope.data),
        tap((catalog) => this.catalogSignal.set(catalog)),
      );
  }

  /**
   * True if the user holds `permissionKey` outright, OR — when `permissionKey` is
   * the coarser `module.action` form nav items and route guards use (PRD §13: "nav
   * items hidden without read permission", no particular scope named) — holds it at
   * *any* scope (own/team/branch/all). Real granted permissions are always the full
   * `module.action.scope` triple (§20(4)/§21), so an exact-only match would make
   * every 2-segment nav/guard check permanently false regardless of what the user
   * was actually granted.
   */
  has(permissionKey: string): boolean {
    const set = this.permissionSet();
    if (set.has(permissionKey)) {
      return true;
    }

    const prefix = `${permissionKey}.`;
    for (const granted of set) {
      if (granted.startsWith(prefix)) {
        return true;
      }
    }

    return false;
  }

  hasAny(permissionKeys: string[]): boolean {
    return permissionKeys.some((key) => this.has(key));
  }

  clear(): void {
    this.currentUserSignal.set(null);
    this.catalogSignal.set([]);
  }
}
