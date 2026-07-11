import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import {
  DocumentTemplate,
  GenerateFromTemplateRequest,
  LfDocument,
} from '../models/document.models';
import { API_BASE_URL } from './api-base-url.token';

/** `GET /documents/templates*` + generate (PRD Module 7 §User Flow 5). */
@Injectable({ providedIn: 'root' })
export class DocumentTemplatesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  list(): Observable<DocumentTemplate[]> {
    return this.http
      .get<ApiSuccessEnvelope<DocumentTemplate[]>>(`${this.baseUrl}/documents/templates`)
      .pipe(map((envelope) => envelope.data));
  }

  get(id: string): Observable<DocumentTemplate> {
    return this.http
      .get<ApiSuccessEnvelope<DocumentTemplate>>(`${this.baseUrl}/documents/templates/${id}`)
      .pipe(map((envelope) => envelope.data));
  }

  generate(id: string, request: GenerateFromTemplateRequest): Observable<LfDocument> {
    return this.http
      .post<ApiSuccessEnvelope<LfDocument>>(
        `${this.baseUrl}/documents/templates/${id}/generate`,
        request,
      )
      .pipe(map((envelope) => envelope.data));
  }
}
