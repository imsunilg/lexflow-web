import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import {
  AddLeadActivityRequest,
  AssignLeadRequest,
  ChangeLeadStageRequest,
  ConvertLeadRequest,
  ConvertLeadResult,
  CreateLeadRequest,
  DuplicateMatch,
  Lead,
  LeadActivity,
  LeadDetail,
  LeadImportBatch,
  LeadListFilter,
  MarkLeadLostRequest,
  UpdateLeadRequest,
} from '../models/lead.models';
import { API_BASE_URL } from './api-base-url.token';

function filterParams(filter: LeadListFilter): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(filter)) {
    if (value !== undefined && value !== null && value !== '') {
      params = params.set(key, String(value));
    }
  }
  return params;
}

/**
 * `GET/POST/PUT/DELETE /leads*` (PRD Module 2 §16/§17). `convert()`'s
 * `matterPayload`/`invoicePayload` travel as JSON-encoded strings, not nested
 * objects — that's the literal shape of the backend's `ConvertLeadRequest`
 * record (`bool CreateMatter, string? MatterPayload, string? InvoicePayload`).
 */
@Injectable({ providedIn: 'root' })
export class LeadsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  list(filter: LeadListFilter = {}): Observable<Lead[]> {
    return this.http
      .get<ApiSuccessEnvelope<Lead[]>>(`${this.baseUrl}/leads`, { params: filterParams(filter) })
      .pipe(map((envelope) => envelope.data));
  }

  get(id: string): Observable<LeadDetail> {
    return this.http
      .get<ApiSuccessEnvelope<LeadDetail>>(`${this.baseUrl}/leads/${id}`)
      .pipe(map((envelope) => envelope.data));
  }

  create(request: CreateLeadRequest): Observable<Lead> {
    return this.http
      .post<ApiSuccessEnvelope<Lead>>(`${this.baseUrl}/leads`, request)
      .pipe(map((envelope) => envelope.data));
  }

  update(id: string, request: UpdateLeadRequest): Observable<Lead> {
    return this.http
      .put<ApiSuccessEnvelope<Lead>>(`${this.baseUrl}/leads/${id}`, request)
      .pipe(map((envelope) => envelope.data));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/leads/${id}`);
  }

  changeStage(id: string, request: ChangeLeadStageRequest): Observable<Lead> {
    return this.http
      .post<ApiSuccessEnvelope<Lead>>(`${this.baseUrl}/leads/${id}/stage`, request)
      .pipe(map((envelope) => envelope.data));
  }

  addActivity(id: string, request: AddLeadActivityRequest): Observable<LeadActivity> {
    return this.http
      .post<ApiSuccessEnvelope<LeadActivity>>(`${this.baseUrl}/leads/${id}/activities`, request)
      .pipe(map((envelope) => envelope.data));
  }

  assign(id: string, request: AssignLeadRequest): Observable<Lead> {
    return this.http
      .post<ApiSuccessEnvelope<Lead>>(`${this.baseUrl}/leads/${id}/assign`, request)
      .pipe(map((envelope) => envelope.data));
  }

  convert(id: string, request: ConvertLeadRequest): Observable<ConvertLeadResult> {
    const body = {
      createMatter: request.createMatter,
      matterPayload: request.matter ? JSON.stringify(request.matter) : null,
      invoicePayload: request.invoicePayload ? JSON.stringify(request.invoicePayload) : null,
    };
    return this.http
      .post<ApiSuccessEnvelope<ConvertLeadResult>>(`${this.baseUrl}/leads/${id}/convert`, body)
      .pipe(map((envelope) => envelope.data));
  }

  markLost(id: string, request: MarkLeadLostRequest): Observable<Lead> {
    return this.http
      .post<ApiSuccessEnvelope<Lead>>(`${this.baseUrl}/leads/${id}/lost`, request)
      .pipe(map((envelope) => envelope.data));
  }

  checkDuplicates(params: {
    name?: string;
    email?: string;
    phoneE164?: string;
  }): Observable<DuplicateMatch[]> {
    return this.http
      .post<ApiSuccessEnvelope<DuplicateMatch[]>>(`${this.baseUrl}/leads/check-duplicates`, params)
      .pipe(map((envelope) => envelope.data));
  }

  /** `LeadImportBatch` is returned so the import wizard can start polling `getImportBatch()` immediately. */
  importFile(file: File): Observable<LeadImportBatch> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http
      .post<ApiSuccessEnvelope<LeadImportBatch>>(`${this.baseUrl}/leads/import`, formData)
      .pipe(map((envelope) => envelope.data));
  }

  getImportBatch(batchId: string): Observable<LeadImportBatch> {
    return this.http
      .get<ApiSuccessEnvelope<LeadImportBatch>>(`${this.baseUrl}/leads/import/${batchId}`)
      .pipe(map((envelope) => envelope.data));
  }

  /**
   * Downloads the per-row error CSV for a completed import batch (AC-L5).
   * ASSUMPTION: `LeadImportBatch.errorFileBlobPath` is a blob-storage path,
   * not a public URL, and no dedicated "fetch this batch's error file"
   * endpoint is documented anywhere in the PRD or `LeadsController` — this
   * route is a best guess at the natural counterpart to `GET /leads/import/{batchId}`.
   * If the real endpoint differs, only this method needs to change.
   */
  downloadImportErrors(batchId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/leads/import/${batchId}/errors`, {
      responseType: 'blob',
    });
  }

  export(filter: LeadListFilter, format: 'csv' | 'xlsx'): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/leads/export`, {
      params: filterParams(filter).set('format', format),
      responseType: 'blob',
    });
  }
}
