import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import {
  CreateTrustReconciliationRequest,
  TrustAccount,
  TrustDepositRequest,
  TrustDisbursementRequest,
  TrustLedgerEntry,
  TrustReconciliation,
  TrustReconciliationItem,
} from '../models/billing.models';
import { API_BASE_URL } from './api-base-url.token';

/** `POST/GET /trust/*` (PRD Module 8 §User Flow 8 — trust accounting). */
@Injectable({ providedIn: 'root' })
export class TrustService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  getAccount(clientId: string): Observable<TrustAccount> {
    return this.http
      .get<ApiSuccessEnvelope<TrustAccount>>(`${this.baseUrl}/trust/${clientId}`)
      .pipe(map((envelope) => envelope.data));
  }

  ledger(clientId: string): Observable<TrustLedgerEntry[]> {
    return this.http
      .get<ApiSuccessEnvelope<TrustLedgerEntry[]>>(`${this.baseUrl}/trust/${clientId}/ledger`)
      .pipe(map((envelope) => envelope.data));
  }

  deposit(clientId: string, request: TrustDepositRequest): Observable<TrustLedgerEntry> {
    return this.http
      .post<ApiSuccessEnvelope<TrustLedgerEntry>>(
        `${this.baseUrl}/trust/${clientId}/deposits`,
        request,
      )
      .pipe(map((envelope) => envelope.data));
  }

  /** AC-B4: disbursement exceeding balance is rejected server-side (hard, DB-checked). */
  disburse(clientId: string, request: TrustDisbursementRequest): Observable<TrustLedgerEntry> {
    return this.http
      .post<ApiSuccessEnvelope<TrustLedgerEntry>>(
        `${this.baseUrl}/trust/${clientId}/disbursements`,
        request,
      )
      .pipe(map((envelope) => envelope.data));
  }

  /** Entries are append-only (DB trigger blocks UPDATE/DELETE) — corrections are reversing entries only. */
  reverseEntry(entryId: string, reason: string): Observable<TrustLedgerEntry> {
    return this.http
      .post<ApiSuccessEnvelope<TrustLedgerEntry>>(
        `${this.baseUrl}/trust/entries/${entryId}/reverse`,
        { reason },
      )
      .pipe(map((envelope) => envelope.data));
  }

  /**
   * No multipart/CSV endpoint exists — CSV parsing happens client-side and
   * this sends the already-parsed `lines[]` as JSON.
   */
  createReconciliation(request: CreateTrustReconciliationRequest): Observable<TrustReconciliation> {
    return this.http
      .post<ApiSuccessEnvelope<TrustReconciliation>>(
        `${this.baseUrl}/trust/reconciliations`,
        request,
      )
      .pipe(map((envelope) => envelope.data));
  }

  reconciliationExceptions(id: string): Observable<TrustReconciliationItem[]> {
    return this.http
      .get<ApiSuccessEnvelope<TrustReconciliationItem[]>>(
        `${this.baseUrl}/trust/reconciliations/${id}/exceptions`,
      )
      .pipe(map((envelope) => envelope.data));
  }

  signoffReconciliation(id: string, notes?: string): Observable<TrustReconciliation> {
    return this.http
      .post<ApiSuccessEnvelope<TrustReconciliation>>(
        `${this.baseUrl}/trust/reconciliations/${id}/signoff`,
        { notes },
      )
      .pipe(map((envelope) => envelope.data));
  }
}
