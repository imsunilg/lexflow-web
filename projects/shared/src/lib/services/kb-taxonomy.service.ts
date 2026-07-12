import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import {
  CreateKbCollectionRequest,
  KbBookmark,
  KbCollection,
  KbCollectionItem,
  KbRefRequest,
  KbTag,
  KbTagRefRequest,
} from '../models/kb.models';
import { API_BASE_URL } from './api-base-url.token';

/**
 * PRD Module 12 — tags, collections, bookmarks. All three reference KB items
 * polymorphically via a `(kbRefKind, kbRefId)` pair, not a discriminated
 * single ref string — none of these `kbRefKind` values are validated
 * server-side against an allow-list (unlike matter pins), so a typo'd kind
 * would be silently accepted; keep callers restricted to `KB_REF_KINDS`.
 * There is no endpoint to list which tags are attached to a given item
 * (the service method exists server-side but isn't wired to any controller).
 */
@Injectable({ providedIn: 'root' })
export class KbTaxonomyService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  listTags() {
    return this.http
      .get<ApiSuccessEnvelope<KbTag[]>>(`${this.baseUrl}/kb/tags`)
      .pipe(map((envelope) => envelope.data));
  }

  /** Get-or-create by name — attaching a never-seen tag name silently creates it. */
  attachTag(request: KbTagRefRequest) {
    return this.http.post<void>(`${this.baseUrl}/kb/tags/attach`, request);
  }

  detachTag(request: KbTagRefRequest) {
    return this.http.post<void>(`${this.baseUrl}/kb/tags/detach`, request);
  }

  listCollections() {
    return this.http
      .get<ApiSuccessEnvelope<KbCollection[]>>(`${this.baseUrl}/kb/collections`)
      .pipe(map((envelope) => envelope.data));
  }

  createCollection(request: CreateKbCollectionRequest) {
    return this.http
      .post<ApiSuccessEnvelope<KbCollection>>(`${this.baseUrl}/kb/collections`, request)
      .pipe(map((envelope) => envelope.data));
  }

  listCollectionItems(collectionId: string) {
    return this.http
      .get<ApiSuccessEnvelope<KbCollectionItem[]>>(
        `${this.baseUrl}/kb/collections/${collectionId}/items`,
      )
      .pipe(map((envelope) => envelope.data));
  }

  addCollectionItem(collectionId: string, request: KbRefRequest) {
    return this.http
      .post<ApiSuccessEnvelope<KbCollectionItem>>(
        `${this.baseUrl}/kb/collections/${collectionId}/items`,
        request,
      )
      .pipe(map((envelope) => envelope.data));
  }

  /** Per-user, not tenant-wide (unlike collections/tags). */
  listBookmarks() {
    return this.http
      .get<ApiSuccessEnvelope<KbBookmark[]>>(`${this.baseUrl}/kb/bookmarks`)
      .pipe(map((envelope) => envelope.data));
  }

  addBookmark(request: KbRefRequest) {
    return this.http
      .post<ApiSuccessEnvelope<KbBookmark>>(`${this.baseUrl}/kb/bookmarks`, request)
      .pipe(map((envelope) => envelope.data));
  }

  removeBookmark(kbRefKind: string, kbRefId: string) {
    return this.http.delete<void>(`${this.baseUrl}/kb/bookmarks`, {
      params: { kbRefKind, kbRefId },
    });
  }
}
