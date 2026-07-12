import { HttpClient, HttpEvent, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL, ApiSuccessEnvelope } from 'shared';
import { PortalDocument, PortalDocumentDownload } from '../models/portal.models';

/**
 * `PortalDocumentsController` (`api/portal/v1/documents*`). List/download are
 * scoped server-side to `Document.PortalPublished == true` and
 * `Confidentiality != "Privileged"` — this app can never see a document the
 * firm hasn't explicitly published to the portal. Upload lands in the
 * matter's "Client Uploads" folder and notifies the responsible lawyer
 * (confirmed server-side; reuses the same AV-scan pipeline as staff uploads).
 */
@Injectable({ providedIn: 'root' })
export class PortalDocumentsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/portal/v1';

  list(matterId?: string): Observable<PortalDocument[]> {
    const params = matterId ? new HttpParams().set('matterId', matterId) : undefined;
    return this.http
      .get<ApiSuccessEnvelope<PortalDocument[]>>(`${this.baseUrl}/documents`, { params })
      .pipe(map((envelope) => envelope.data));
  }

  /** Returns a signed/temporary download URL — not a direct streaming endpoint like staff's `DocumentsService.downloadUrl()`. */
  getDownloadUrl(documentId: string): Observable<PortalDocumentDownload> {
    return this.http
      .get<ApiSuccessEnvelope<PortalDocumentDownload>>(
        `${this.baseUrl}/documents/${documentId}/download`,
      )
      .pipe(map((envelope) => envelope.data));
  }

  upload(
    file: File,
    metadata: { matterId: string; title: string },
  ): Observable<HttpEvent<ApiSuccessEnvelope<PortalDocument>>> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('MatterId', metadata.matterId);
    formData.append('Title', metadata.title);
    return this.http.post<ApiSuccessEnvelope<PortalDocument>>(
      `${this.baseUrl}/documents`,
      formData,
      {
        reportProgress: true,
        observe: 'events',
      },
    );
  }
}
