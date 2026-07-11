import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import {
  ArgumentNote,
  ArgumentNoteInput,
  CaseParty,
  CasePartyInput,
  CourtCase,
  CourtOrder,
  CreateHearingRequest,
  EvidenceCustodyLogEntry,
  EvidenceCustodyLogInput,
  EvidenceItem,
  EvidenceItemInput,
  FileAppealRequest,
  Hearing,
  OrderInput,
  Witness,
  WitnessInput,
} from '../models/court-case.models';
import { API_BASE_URL } from './api-base-url.token';

/** `GET/PUT /cases/{id}*` (PRD Module 5 §16/§17). */
@Injectable({ providedIn: 'root' })
export class CourtCasesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  get(id: string): Observable<CourtCase> {
    return this.http
      .get<ApiSuccessEnvelope<CourtCase>>(`${this.baseUrl}/cases/${id}`)
      .pipe(map((envelope) => envelope.data));
  }

  update(id: string, request: Partial<CourtCase>): Observable<CourtCase> {
    return this.http
      .put<ApiSuccessEnvelope<CourtCase>>(`${this.baseUrl}/cases/${id}`, request)
      .pipe(map((envelope) => envelope.data));
  }

  /** `case.stage.update` — a distinct permission from `matters.read`/`matters.manage` (PRD Security Rules). */
  changeStage(id: string, toStage: string): Observable<CourtCase> {
    return this.http
      .post<ApiSuccessEnvelope<CourtCase>>(`${this.baseUrl}/cases/${id}/stage`, { toStage })
      .pipe(map((envelope) => envelope.data));
  }

  /** AC-CC4: links both cases bidirectionally, copies selected documents by reference. */
  fileAppeal(id: string, request: FileAppealRequest): Observable<CourtCase> {
    return this.http
      .post<ApiSuccessEnvelope<CourtCase>>(`${this.baseUrl}/cases/${id}/appeal`, request)
      .pipe(map((envelope) => envelope.data));
  }

  // Parties & advocates

  listParties(caseId: string): Observable<CaseParty[]> {
    return this.http
      .get<ApiSuccessEnvelope<CaseParty[]>>(`${this.baseUrl}/cases/${caseId}/parties`)
      .pipe(map((envelope) => envelope.data));
  }

  addParty(caseId: string, input: CasePartyInput): Observable<CaseParty> {
    return this.http
      .post<ApiSuccessEnvelope<CaseParty>>(`${this.baseUrl}/cases/${caseId}/parties`, input)
      .pipe(map((envelope) => envelope.data));
  }

  updateParty(caseId: string, partyId: string, input: CasePartyInput): Observable<CaseParty> {
    return this.http
      .put<ApiSuccessEnvelope<CaseParty>>(
        `${this.baseUrl}/cases/${caseId}/parties/${partyId}`,
        input,
      )
      .pipe(map((envelope) => envelope.data));
  }

  deleteParty(caseId: string, partyId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/cases/${caseId}/parties/${partyId}`);
  }

  // Hearings

  listHearings(caseId: string): Observable<Hearing[]> {
    return this.http
      .get<ApiSuccessEnvelope<Hearing[]>>(`${this.baseUrl}/cases/${caseId}/hearings`)
      .pipe(map((envelope) => envelope.data));
  }

  scheduleHearing(caseId: string, request: CreateHearingRequest): Observable<Hearing> {
    return this.http
      .post<ApiSuccessEnvelope<Hearing>>(`${this.baseUrl}/cases/${caseId}/hearings`, request)
      .pipe(map((envelope) => envelope.data));
  }

  // Orders

  listOrders(caseId: string): Observable<CourtOrder[]> {
    return this.http
      .get<ApiSuccessEnvelope<CourtOrder[]>>(`${this.baseUrl}/cases/${caseId}/orders`)
      .pipe(map((envelope) => envelope.data));
  }

  uploadOrder(caseId: string, file: File, input: OrderInput): Observable<CourtOrder> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('OrderDate', input.orderDate);
    if (input.gist) formData.append('Gist', input.gist);
    if (input.complianceDue) formData.append('ComplianceDue', input.complianceDue);
    return this.http
      .post<ApiSuccessEnvelope<CourtOrder>>(`${this.baseUrl}/cases/${caseId}/orders`, formData)
      .pipe(map((envelope) => envelope.data));
  }

  // Evidence

  listEvidence(caseId: string): Observable<EvidenceItem[]> {
    return this.http
      .get<ApiSuccessEnvelope<EvidenceItem[]>>(`${this.baseUrl}/cases/${caseId}/evidence`)
      .pipe(map((envelope) => envelope.data));
  }

  addEvidence(caseId: string, input: EvidenceItemInput): Observable<EvidenceItem> {
    return this.http
      .post<ApiSuccessEnvelope<EvidenceItem>>(`${this.baseUrl}/cases/${caseId}/evidence`, input)
      .pipe(map((envelope) => envelope.data));
  }

  /** AC-CC5: append-only custody chain. */
  listCustodyLog(evidenceId: string): Observable<EvidenceCustodyLogEntry[]> {
    return this.http
      .get<ApiSuccessEnvelope<EvidenceCustodyLogEntry[]>>(
        `${this.baseUrl}/evidence/${evidenceId}/custody`,
      )
      .pipe(map((envelope) => envelope.data));
  }

  addCustodyLogEntry(
    evidenceId: string,
    input: EvidenceCustodyLogInput,
  ): Observable<EvidenceCustodyLogEntry> {
    return this.http
      .post<ApiSuccessEnvelope<EvidenceCustodyLogEntry>>(
        `${this.baseUrl}/evidence/${evidenceId}/custody`,
        input,
      )
      .pipe(map((envelope) => envelope.data));
  }

  // Witnesses

  listWitnesses(caseId: string): Observable<Witness[]> {
    return this.http
      .get<ApiSuccessEnvelope<Witness[]>>(`${this.baseUrl}/cases/${caseId}/witnesses`)
      .pipe(map((envelope) => envelope.data));
  }

  addWitness(caseId: string, input: WitnessInput): Observable<Witness> {
    return this.http
      .post<ApiSuccessEnvelope<Witness>>(`${this.baseUrl}/cases/${caseId}/witnesses`, input)
      .pipe(map((envelope) => envelope.data));
  }

  updateWitness(
    caseId: string,
    witnessId: string,
    input: Partial<WitnessInput & { examStatus: string }>,
  ): Observable<Witness> {
    return this.http
      .put<ApiSuccessEnvelope<Witness>>(
        `${this.baseUrl}/cases/${caseId}/witnesses/${witnessId}`,
        input,
      )
      .pipe(map((envelope) => envelope.data));
  }

  // Arguments

  listArguments(caseId: string): Observable<ArgumentNote[]> {
    return this.http
      .get<ApiSuccessEnvelope<ArgumentNote[]>>(`${this.baseUrl}/cases/${caseId}/arguments`)
      .pipe(map((envelope) => envelope.data));
  }

  addArgument(caseId: string, input: ArgumentNoteInput): Observable<ArgumentNote> {
    return this.http
      .post<ApiSuccessEnvelope<ArgumentNote>>(`${this.baseUrl}/cases/${caseId}/arguments`, input)
      .pipe(map((envelope) => envelope.data));
  }
}
