import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import { CourtCase, CreateCourtCaseRequest } from '../models/court-case.models';
import {
  ChangeMatterStatusRequest,
  ConflictMatch,
  CreateMatterRequest,
  Matter,
  MatterExpense,
  MatterExpenseInput,
  MatterFilter,
  MatterFinancialSummary,
  MatterImportantDate,
  MatterImportantDateInput,
  MatterParty,
  MatterPartyInput,
  MatterRelated,
  MatterRelationType,
  MatterTeamMember,
  MatterTimelineEntry,
  UpdateMatterRequest,
} from '../models/matter.models';
import { API_BASE_URL } from './api-base-url.token';

function filterParams(filter: MatterFilter): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(filter)) {
    if (value !== undefined && value !== null && value !== '') {
      params = params.set(key, String(value));
    }
  }
  return params;
}

/** `GET/POST/PUT /matters*` (PRD Module 4 §16/§17). */
@Injectable({ providedIn: 'root' })
export class MattersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  list(filter: MatterFilter = {}): Observable<Matter[]> {
    return this.http
      .get<ApiSuccessEnvelope<Matter[]>>(`${this.baseUrl}/matters`, {
        params: filterParams(filter),
      })
      .pipe(map((envelope) => envelope.data));
  }

  get(id: string): Observable<Matter> {
    return this.http
      .get<ApiSuccessEnvelope<Matter>>(`${this.baseUrl}/matters/${id}`)
      .pipe(map((envelope) => envelope.data));
  }

  create(request: CreateMatterRequest): Observable<Matter> {
    return this.http
      .post<ApiSuccessEnvelope<Matter>>(`${this.baseUrl}/matters`, request)
      .pipe(map((envelope) => envelope.data));
  }

  update(id: string, request: UpdateMatterRequest): Observable<Matter> {
    return this.http
      .put<ApiSuccessEnvelope<Matter>>(`${this.baseUrl}/matters/${id}`, request)
      .pipe(map((envelope) => envelope.data));
  }

  /** AC-M3: 409 `TIMERS_RUNNING` if running timers block the close; closureNote required. */
  changeStatus(id: string, request: ChangeMatterStatusRequest): Observable<Matter> {
    return this.http
      .post<ApiSuccessEnvelope<Matter>>(`${this.baseUrl}/matters/${id}/status`, request)
      .pipe(map((envelope) => envelope.data));
  }

  // Team

  listTeam(matterId: string): Observable<MatterTeamMember[]> {
    return this.http
      .get<ApiSuccessEnvelope<MatterTeamMember[]>>(`${this.baseUrl}/matters/${matterId}/team`)
      .pipe(map((envelope) => envelope.data));
  }

  addTeamMember(
    matterId: string,
    userId: string,
    roleInMatter?: string | null,
  ): Observable<MatterTeamMember> {
    return this.http
      .post<ApiSuccessEnvelope<MatterTeamMember>>(`${this.baseUrl}/matters/${matterId}/team`, {
        userId,
        roleInMatter,
      })
      .pipe(map((envelope) => envelope.data));
  }

  removeTeamMember(matterId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/matters/${matterId}/team/${userId}`);
  }

  // Parties

  listParties(matterId: string): Observable<MatterParty[]> {
    return this.http
      .get<ApiSuccessEnvelope<MatterParty[]>>(`${this.baseUrl}/matters/${matterId}/parties`)
      .pipe(map((envelope) => envelope.data));
  }

  addParty(matterId: string, input: MatterPartyInput): Observable<MatterParty> {
    return this.http
      .post<ApiSuccessEnvelope<MatterParty>>(`${this.baseUrl}/matters/${matterId}/parties`, input)
      .pipe(map((envelope) => envelope.data));
  }

  updateParty(matterId: string, partyId: string, input: MatterPartyInput): Observable<MatterParty> {
    return this.http
      .put<ApiSuccessEnvelope<MatterParty>>(
        `${this.baseUrl}/matters/${matterId}/parties/${partyId}`,
        input,
      )
      .pipe(map((envelope) => envelope.data));
  }

  deleteParty(matterId: string, partyId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/matters/${matterId}/parties/${partyId}`);
  }

  // Important dates

  listImportantDates(matterId: string): Observable<MatterImportantDate[]> {
    return this.http
      .get<ApiSuccessEnvelope<MatterImportantDate[]>>(
        `${this.baseUrl}/matters/${matterId}/important-dates`,
      )
      .pipe(map((envelope) => envelope.data));
  }

  addImportantDate(
    matterId: string,
    input: MatterImportantDateInput,
  ): Observable<MatterImportantDate> {
    return this.http
      .post<ApiSuccessEnvelope<MatterImportantDate>>(
        `${this.baseUrl}/matters/${matterId}/important-dates`,
        input,
      )
      .pipe(map((envelope) => envelope.data));
  }

  updateImportantDate(
    matterId: string,
    dateId: string,
    input: MatterImportantDateInput,
  ): Observable<MatterImportantDate> {
    return this.http
      .put<ApiSuccessEnvelope<MatterImportantDate>>(
        `${this.baseUrl}/matters/${matterId}/important-dates/${dateId}`,
        input,
      )
      .pipe(map((envelope) => envelope.data));
  }

  deleteImportantDate(matterId: string, dateId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/matters/${matterId}/important-dates/${dateId}`);
  }

  // Expenses

  listExpenses(matterId: string): Observable<MatterExpense[]> {
    return this.http
      .get<ApiSuccessEnvelope<MatterExpense[]>>(`${this.baseUrl}/matters/${matterId}/expenses`)
      .pipe(map((envelope) => envelope.data));
  }

  addExpense(matterId: string, input: MatterExpenseInput): Observable<MatterExpense> {
    return this.http
      .post<ApiSuccessEnvelope<MatterExpense>>(
        `${this.baseUrl}/matters/${matterId}/expenses`,
        input,
      )
      .pipe(map((envelope) => envelope.data));
  }

  // Related matters

  addRelated(
    matterId: string,
    relatedMatterId: string,
    relationType: MatterRelationType,
  ): Observable<MatterRelated> {
    return this.http
      .post<ApiSuccessEnvelope<MatterRelated>>(`${this.baseUrl}/matters/${matterId}/related`, {
        relatedMatterId,
        relationType,
      })
      .pipe(map((envelope) => envelope.data));
  }

  // Timeline (AC-M2)

  timeline(matterId: string, types?: string, cursor?: string): Observable<MatterTimelineEntry[]> {
    let params = new HttpParams();
    if (types) params = params.set('types', types);
    if (cursor) params = params.set('cursor', cursor);
    return this.http
      .get<ApiSuccessEnvelope<MatterTimelineEntry[]>>(
        `${this.baseUrl}/matters/${matterId}/timeline`,
        { params },
      )
      .pipe(map((envelope) => envelope.data));
  }

  // Financial summary (AC-M4)

  financialSummary(matterId: string): Observable<MatterFinancialSummary> {
    return this.http
      .get<ApiSuccessEnvelope<MatterFinancialSummary>>(
        `${this.baseUrl}/matters/${matterId}/financial-summary`,
      )
      .pipe(map((envelope) => envelope.data));
  }

  // Conflict check (AC-M1)

  checkConflicts(partyNames: string[]): Observable<ConflictMatch[]> {
    return this.http
      .post<ApiSuccessEnvelope<ConflictMatch[]>>(`${this.baseUrl}/matters/conflict-check`, {
        partyNames,
      })
      .pipe(map((envelope) => envelope.data));
  }

  // Court cases (Module 5 entry point)

  listCases(matterId: string): Observable<CourtCase[]> {
    return this.http
      .get<ApiSuccessEnvelope<CourtCase[]>>(`${this.baseUrl}/matters/${matterId}/cases`)
      .pipe(map((envelope) => envelope.data));
  }

  createCase(matterId: string, request: CreateCourtCaseRequest): Observable<CourtCase> {
    return this.http
      .post<ApiSuccessEnvelope<CourtCase>>(`${this.baseUrl}/matters/${matterId}/cases`, request)
      .pipe(map((envelope) => envelope.data));
  }
}
