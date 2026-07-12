import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import {
  AddClientRelationshipRequest,
  Client,
  ClientAddress,
  ClientAddressInput,
  ClientContact,
  ClientContactInput,
  ClientFilter,
  ClientIdentityDocument,
  ClientPortalUser,
  ClientRelationship,
  ClientSummary,
  CreateClientRequest,
  MergeClientsRequest,
  UpdateClientRequest,
} from '../models/client.models';
import { API_BASE_URL } from './api-base-url.token';

function filterParams(filter: ClientFilter): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(filter)) {
    if (value !== undefined && value !== null && value !== '') {
      params = params.set(key, String(value));
    }
  }
  return params;
}

/**
 * `GET/POST/PUT/DELETE /clients*` (PRD Module 3 §16/§17). Note the live
 * `ClientsController` gates mutating/portal/KYC endpoints with
 * `clients.manage.all` / `clients.portal.manage` / `clients.kyc.read`
 * permission keys that aren't present in the seeded permission catalog
 * (`clients.create.all`/`clients.update.all`/`clients_kyc.read.*` are the
 * seeded ones) — a backend reconciliation gap, not something fixed here.
 */
@Injectable({ providedIn: 'root' })
export class ClientsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  list(filter: ClientFilter = {}): Observable<Client[]> {
    return this.http
      .get<ApiSuccessEnvelope<Client[]>>(`${this.baseUrl}/clients`, {
        params: filterParams(filter),
      })
      .pipe(map((envelope) => envelope.data));
  }

  /** AC-C3: if the returned client's `mergedIntoClientId` is non-null, the caller must redirect there. */
  get(id: string): Observable<Client> {
    return this.http
      .get<ApiSuccessEnvelope<Client>>(`${this.baseUrl}/clients/${id}`)
      .pipe(map((envelope) => envelope.data));
  }

  create(request: CreateClientRequest): Observable<Client> {
    return this.http
      .post<ApiSuccessEnvelope<Client>>(`${this.baseUrl}/clients`, request)
      .pipe(map((envelope) => envelope.data));
  }

  update(id: string, request: UpdateClientRequest): Observable<Client> {
    return this.http
      .put<ApiSuccessEnvelope<Client>>(`${this.baseUrl}/clients/${id}`, request)
      .pipe(map((envelope) => envelope.data));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/clients/${id}`);
  }

  summary(id: string): Observable<ClientSummary> {
    return this.http
      .get<ApiSuccessEnvelope<ClientSummary>>(`${this.baseUrl}/clients/${id}/summary`)
      .pipe(map((envelope) => envelope.data));
  }

  // Contacts

  listContacts(clientId: string): Observable<ClientContact[]> {
    return this.http
      .get<ApiSuccessEnvelope<ClientContact[]>>(`${this.baseUrl}/clients/${clientId}/contacts`)
      .pipe(map((envelope) => envelope.data));
  }

  addContact(clientId: string, input: ClientContactInput): Observable<ClientContact> {
    return this.http
      .post<ApiSuccessEnvelope<ClientContact>>(
        `${this.baseUrl}/clients/${clientId}/contacts`,
        input,
      )
      .pipe(map((envelope) => envelope.data));
  }

  updateContact(
    clientId: string,
    contactId: string,
    input: ClientContactInput,
  ): Observable<ClientContact> {
    return this.http
      .put<ApiSuccessEnvelope<ClientContact>>(
        `${this.baseUrl}/clients/${clientId}/contacts/${contactId}`,
        input,
      )
      .pipe(map((envelope) => envelope.data));
  }

  deleteContact(clientId: string, contactId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/clients/${clientId}/contacts/${contactId}`);
  }

  // Addresses

  listAddresses(clientId: string): Observable<ClientAddress[]> {
    return this.http
      .get<ApiSuccessEnvelope<ClientAddress[]>>(`${this.baseUrl}/clients/${clientId}/addresses`)
      .pipe(map((envelope) => envelope.data));
  }

  addAddress(clientId: string, input: ClientAddressInput): Observable<ClientAddress> {
    return this.http
      .post<ApiSuccessEnvelope<ClientAddress>>(
        `${this.baseUrl}/clients/${clientId}/addresses`,
        input,
      )
      .pipe(map((envelope) => envelope.data));
  }

  updateAddress(
    clientId: string,
    addressId: string,
    input: ClientAddressInput,
  ): Observable<ClientAddress> {
    return this.http
      .put<ApiSuccessEnvelope<ClientAddress>>(
        `${this.baseUrl}/clients/${clientId}/addresses/${addressId}`,
        input,
      )
      .pipe(map((envelope) => envelope.data));
  }

  deleteAddress(clientId: string, addressId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/clients/${clientId}/addresses/${addressId}`);
  }

  // KYC identity documents

  listIdentityDocuments(clientId: string): Observable<ClientIdentityDocument[]> {
    return this.http
      .get<ApiSuccessEnvelope<ClientIdentityDocument[]>>(
        `${this.baseUrl}/clients/${clientId}/identity-documents`,
      )
      .pipe(map((envelope) => envelope.data));
  }

  uploadIdentityDocument(
    clientId: string,
    file: File,
    docKind: string,
    docNumber: string,
    expiryDate: string | null,
  ): Observable<ClientIdentityDocument> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('DocKind', docKind);
    formData.append('DocNumber', docNumber);
    if (expiryDate) {
      formData.append('ExpiryDate', expiryDate);
    }
    return this.http
      .post<ApiSuccessEnvelope<ClientIdentityDocument>>(
        `${this.baseUrl}/clients/${clientId}/identity-documents`,
        formData,
      )
      .pipe(map((envelope) => envelope.data));
  }

  verifyIdentityDocument(
    clientId: string,
    docId: string,
    approve: boolean,
  ): Observable<ClientIdentityDocument> {
    return this.http
      .patch<ApiSuccessEnvelope<ClientIdentityDocument>>(
        `${this.baseUrl}/clients/${clientId}/identity-documents/${docId}/verify`,
        { approve },
      )
      .pipe(map((envelope) => envelope.data));
  }

  // Relationships

  listRelationships(clientId: string): Observable<ClientRelationship[]> {
    return this.http
      .get<ApiSuccessEnvelope<ClientRelationship[]>>(
        `${this.baseUrl}/clients/${clientId}/relationships`,
      )
      .pipe(map((envelope) => envelope.data));
  }

  addRelationship(
    clientId: string,
    request: AddClientRelationshipRequest,
  ): Observable<ClientRelationship> {
    return this.http
      .post<ApiSuccessEnvelope<ClientRelationship>>(
        `${this.baseUrl}/clients/${clientId}/relationships`,
        request,
      )
      .pipe(map((envelope) => envelope.data));
  }

  // Portal access

  setPortalAccess(clientId: string, enable: boolean): Observable<Client> {
    return this.http
      .post<ApiSuccessEnvelope<Client>>(`${this.baseUrl}/clients/${clientId}/portal-access`, {
        enable,
      })
      .pipe(map((envelope) => envelope.data));
  }

  resendPortalInvite(clientId: string): Observable<void> {
    return this.http.post<void>(
      `${this.baseUrl}/clients/${clientId}/portal-access/resend-invite`,
      {},
    );
  }

  /**
   * ASSUMPTION: no documented endpoint lists a client's portal users
   * directly (only the enable/resend actions) — the PRD's Portal tab needs a
   * list to render (email/status/2FA per §Module 17's multi-user-per-corporate-client
   * model), so this calls the natural counterpart route. If the real API
   * differs, only this method needs to change.
   */
  listPortalUsers(clientId: string): Observable<ClientPortalUser[]> {
    return this.http
      .get<ApiSuccessEnvelope<ClientPortalUser[]>>(
        `${this.baseUrl}/clients/${clientId}/portal-users`,
      )
      .pipe(map((envelope) => envelope.data));
  }

  // Merge

  merge(request: MergeClientsRequest): Observable<Client> {
    return this.http
      .post<ApiSuccessEnvelope<Client>>(`${this.baseUrl}/clients/merge`, request)
      .pipe(map((envelope) => envelope.data));
  }
}
