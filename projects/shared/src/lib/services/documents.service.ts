import { HttpClient, HttpEvent, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import {
  BulkDocumentActionRequest,
  CreateShareLinkRequest,
  CreateShareLinkResult,
  DocumentSearchHit,
  DocumentVersion,
  LfDocument,
  SendForSignatureRequest,
  SignatureEnvelope,
  UpdateDocumentMetadataRequest,
  UploadDocumentMetadata,
} from '../models/document.models';
import { API_BASE_URL } from './api-base-url.token';

function metadataFormData(file: File, metadata: UploadDocumentMetadata): FormData {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('Title', metadata.title);
  formData.append('DocType', metadata.docType);
  formData.append('Confidentiality', metadata.confidentiality);
  if (metadata.folderId) formData.append('FolderId', metadata.folderId);
  if (metadata.matterId) formData.append('MatterId', metadata.matterId);
  if (metadata.clientId) formData.append('ClientId', metadata.clientId);
  if (metadata.caseId) formData.append('CaseId', metadata.caseId);
  for (const tag of metadata.tags ?? []) {
    formData.append('Tags', tag);
  }
  return formData;
}

/** `GET/POST/PATCH/DELETE /documents*` (PRD Module 7 §APIs). */
@Injectable({ providedIn: 'root' })
export class DocumentsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  list(
    filter: {
      matterId?: string;
      folderId?: string;
      docType?: string;
      q?: string;
    } = {},
  ): Observable<LfDocument[]> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filter)) {
      if (value) params = params.set(key, value);
    }
    return this.http
      .get<ApiSuccessEnvelope<LfDocument[]>>(`${this.baseUrl}/documents`, { params })
      .pipe(map((envelope) => envelope.data));
  }

  get(id: string): Observable<LfDocument> {
    return this.http
      .get<ApiSuccessEnvelope<LfDocument>>(`${this.baseUrl}/documents/${id}`)
      .pipe(map((envelope) => envelope.data));
  }

  /** Uses `reportProgress` so the uploader can show a real per-file progress bar. */
  upload(
    file: File,
    metadata: UploadDocumentMetadata,
  ): Observable<HttpEvent<ApiSuccessEnvelope<LfDocument>>> {
    return this.http.post<ApiSuccessEnvelope<LfDocument>>(
      `${this.baseUrl}/documents`,
      metadataFormData(file, metadata),
      { reportProgress: true, observe: 'events' },
    );
  }

  updateMetadata(id: string, request: UpdateDocumentMetadataRequest): Observable<LfDocument> {
    return this.http
      .patch<ApiSuccessEnvelope<LfDocument>>(`${this.baseUrl}/documents/${id}`, request)
      .pipe(map((envelope) => envelope.data));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/documents/${id}`);
  }

  listVersions(id: string): Observable<DocumentVersion[]> {
    return this.http
      .get<ApiSuccessEnvelope<DocumentVersion[]>>(`${this.baseUrl}/documents/${id}/versions`)
      .pipe(map((envelope) => envelope.data));
  }

  uploadVersion(
    id: string,
    file: File,
  ): Observable<HttpEvent<ApiSuccessEnvelope<DocumentVersion>>> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ApiSuccessEnvelope<DocumentVersion>>(
      `${this.baseUrl}/documents/${id}/versions`,
      formData,
      { reportProgress: true, observe: 'events' },
    );
  }

  restoreVersion(id: string, versionNo: number): Observable<DocumentVersion> {
    return this.http
      .post<ApiSuccessEnvelope<DocumentVersion>>(
        `${this.baseUrl}/documents/${id}/versions/${versionNo}/restore`,
        {},
      )
      .pipe(map((envelope) => envelope.data));
  }

  downloadUrl(id: string): string {
    return `${this.baseUrl}/documents/${id}/download`;
  }

  previewUrl(id: string): string {
    return `${this.baseUrl}/documents/${id}/preview`;
  }

  search(params: {
    q: string;
    matterId?: string;
    type?: string;
    tag?: string;
    from?: string;
    to?: string;
  }): Observable<DocumentSearchHit[]> {
    let httpParams = new HttpParams().set('q', params.q);
    for (const key of ['matterId', 'type', 'tag', 'from', 'to'] as const) {
      const value = params[key];
      if (value) httpParams = httpParams.set(key, value);
    }
    return this.http
      .get<ApiSuccessEnvelope<DocumentSearchHit[]>>(`${this.baseUrl}/documents/search`, {
        params: httpParams,
      })
      .pipe(map((envelope) => envelope.data));
  }

  createShareLink(id: string, request: CreateShareLinkRequest): Observable<CreateShareLinkResult> {
    return this.http
      .post<ApiSuccessEnvelope<CreateShareLinkResult>>(
        `${this.baseUrl}/documents/${id}/share-links`,
        request,
      )
      .pipe(map((envelope) => envelope.data));
  }

  deleteShareLink(shareLinkId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/share-links/${shareLinkId}`);
  }

  sendForSignature(id: string, request: SendForSignatureRequest): Observable<SignatureEnvelope> {
    return this.http
      .post<ApiSuccessEnvelope<SignatureEnvelope>>(
        `${this.baseUrl}/documents/${id}/signature`,
        request,
      )
      .pipe(map((envelope) => envelope.data));
  }

  bulkAction(request: BulkDocumentActionRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/documents/bulk`, request);
  }
}
