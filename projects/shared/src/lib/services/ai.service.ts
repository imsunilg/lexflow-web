import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import {
  AiChatRequest,
  AiChatResponse,
  AiContractReviewResponse,
  AiDraftRequest,
  AiDraftResponse,
  AiFeedbackRequest,
  AiResearchRequest,
  AiResearchResponse,
} from '../models/ai.models';
import { API_BASE_URL } from './api-base-url.token';

/**
 * `AiController` (`api/v1/ai`, PRD Module 16) — scoped to the 4 features this
 * build covers (chat, contract review, draft, research) plus feedback. See
 * `ai.models.ts`'s file-header comment for the full list of confirmed gaps
 * vs the PRD (no SSE streaming, no server-side slash commands, no redline
 * docx, no template-grounded drafting, no per-section regenerate).
 */
@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  chat(request: AiChatRequest) {
    return this.http
      .post<ApiSuccessEnvelope<AiChatResponse>>(`${this.baseUrl}/ai/chat`, request)
      .pipe(map((envelope) => envelope.data));
  }

  reviewContract(documentId: string) {
    return this.http
      .post<ApiSuccessEnvelope<AiContractReviewResponse>>(
        `${this.baseUrl}/ai/contracts/${documentId}/review`,
        {},
      )
      .pipe(map((envelope) => envelope.data));
  }

  draft(request: AiDraftRequest) {
    return this.http
      .post<ApiSuccessEnvelope<AiDraftResponse>>(`${this.baseUrl}/ai/draft`, request)
      .pipe(map((envelope) => envelope.data));
  }

  research(request: AiResearchRequest) {
    return this.http
      .post<ApiSuccessEnvelope<AiResearchResponse>>(`${this.baseUrl}/ai/research`, request)
      .pipe(map((envelope) => envelope.data));
  }

  sendFeedback(interactionId: string, request: AiFeedbackRequest) {
    return this.http.post<void>(
      `${this.baseUrl}/ai/interactions/${interactionId}/feedback`,
      request,
    );
  }
}
