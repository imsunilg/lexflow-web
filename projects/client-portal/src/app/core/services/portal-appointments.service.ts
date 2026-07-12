import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL, ApiSuccessEnvelope } from 'shared';
import { PortalAppointment, PortalAppointmentRequest } from '../models/portal.models';

/**
 * `PortalAppointmentsController` (`api/portal/v1/appointments`). The backend
 * enforces a >=24h lead time server-side (`APPOINTMENT_TOO_SOON`) and matter
 * ownership, but there is NO lawyer-lookup or availability-publishing
 * endpoint anywhere — `lawyerId` is a required raw GUID with no portal-facing
 * way to resolve it (`GET /me/matters` only exposes the responsible lawyer's
 * *name*). Confirm/reschedule also has zero wired endpoints (the domain
 * methods exist but nothing calls them) — appointments only ever reach
 * "Requested" status through this API today.
 */
@Injectable({ providedIn: 'root' })
export class PortalAppointmentsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/portal/v1';

  list(): Observable<PortalAppointment[]> {
    return this.http
      .get<ApiSuccessEnvelope<PortalAppointment[]>>(`${this.baseUrl}/appointments`)
      .pipe(map((envelope) => envelope.data));
  }

  request(request: PortalAppointmentRequest): Observable<PortalAppointment> {
    return this.http
      .post<ApiSuccessEnvelope<PortalAppointment>>(`${this.baseUrl}/appointments`, request)
      .pipe(map((envelope) => envelope.data));
  }
}
