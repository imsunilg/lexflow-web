import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import {
  ApproveKbArticleRequest,
  AssignKbArticleReviewerRequest,
  CreateKbArticleRequest,
  KbArticle,
  KbArticleVersion,
} from '../models/kb.models';
import { API_BASE_URL } from './api-base-url.token';

/**
 * PRD Module 12 — articles (`kb.contribute.all` for authoring, `kb.review.all`
 * for the peer-review workflow). "Reviewer ≠ author" and "≥1 tag to publish"
 * are both genuinely enforced server-side — see `kb.models.ts`'s doc comment
 * for the exact enforcement layers.
 */
@Injectable({ providedIn: 'root' })
export class KbArticlesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  list() {
    return this.http
      .get<ApiSuccessEnvelope<KbArticle[]>>(`${this.baseUrl}/kb/articles`)
      .pipe(map((envelope) => envelope.data));
  }

  get(id: string) {
    return this.http
      .get<ApiSuccessEnvelope<KbArticle>>(`${this.baseUrl}/kb/articles/${id}`)
      .pipe(map((envelope) => envelope.data));
  }

  create(request: CreateKbArticleRequest) {
    return this.http
      .post<ApiSuccessEnvelope<KbArticle>>(`${this.baseUrl}/kb/articles`, request)
      .pipe(map((envelope) => envelope.data));
  }

  update(id: string, request: CreateKbArticleRequest) {
    return this.http
      .put<ApiSuccessEnvelope<KbArticle>>(`${this.baseUrl}/kb/articles/${id}`, request)
      .pipe(map((envelope) => envelope.data));
  }

  submit(id: string) {
    return this.http
      .post<ApiSuccessEnvelope<KbArticle>>(`${this.baseUrl}/kb/articles/${id}/submit`, {})
      .pipe(map((envelope) => envelope.data));
  }

  assignReviewer(id: string, request: AssignKbArticleReviewerRequest) {
    return this.http
      .post<ApiSuccessEnvelope<KbArticle>>(
        `${this.baseUrl}/kb/articles/${id}/assign-reviewer`,
        request,
      )
      .pipe(map((envelope) => envelope.data));
  }

  /** Convenience wrapper: assigns the reviewer and publishes in one call. */
  approve(id: string, request: ApproveKbArticleRequest) {
    return this.http
      .post<ApiSuccessEnvelope<KbArticle>>(`${this.baseUrl}/kb/articles/${id}/approve`, request)
      .pipe(map((envelope) => envelope.data));
  }

  /** Requires the article already be InReview with a reviewer assigned. */
  publish(id: string) {
    return this.http
      .post<ApiSuccessEnvelope<KbArticle>>(`${this.baseUrl}/kb/articles/${id}/publish`, {})
      .pipe(map((envelope) => envelope.data));
  }

  sendBack(id: string) {
    return this.http
      .post<ApiSuccessEnvelope<KbArticle>>(`${this.baseUrl}/kb/articles/${id}/send-back`, {})
      .pipe(map((envelope) => envelope.data));
  }

  /** Snapshots are written at publish time only — a flat history list, not a diff endpoint. */
  versions(id: string) {
    return this.http
      .get<ApiSuccessEnvelope<KbArticleVersion[]>>(`${this.baseUrl}/kb/articles/${id}/versions`)
      .pipe(map((envelope) => envelope.data));
  }
}
