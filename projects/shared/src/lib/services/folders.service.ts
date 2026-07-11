import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import { CreateFolderRequest, Folder } from '../models/document.models';
import { API_BASE_URL } from './api-base-url.token';

/** `GET/POST/PUT/DELETE /folders*` (PRD Module 7 §APIs). */
@Injectable({ providedIn: 'root' })
export class FoldersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  list(parentId?: string, matterId?: string): Observable<Folder[]> {
    let params = new HttpParams();
    if (parentId) params = params.set('parentId', parentId);
    if (matterId) params = params.set('matterId', matterId);
    return this.http
      .get<ApiSuccessEnvelope<Folder[]>>(`${this.baseUrl}/folders`, { params })
      .pipe(map((envelope) => envelope.data));
  }

  get(id: string): Observable<Folder> {
    return this.http
      .get<ApiSuccessEnvelope<Folder>>(`${this.baseUrl}/folders/${id}`)
      .pipe(map((envelope) => envelope.data));
  }

  create(request: CreateFolderRequest): Observable<Folder> {
    return this.http
      .post<ApiSuccessEnvelope<Folder>>(`${this.baseUrl}/folders`, request)
      .pipe(map((envelope) => envelope.data));
  }

  rename(id: string, name: string): Observable<Folder> {
    return this.http
      .put<ApiSuccessEnvelope<Folder>>(`${this.baseUrl}/folders/${id}`, { name })
      .pipe(map((envelope) => envelope.data));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/folders/${id}`);
  }

  move(id: string, newParentId: string | null): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/folders/${id}/move`, { newParentId });
  }
}
