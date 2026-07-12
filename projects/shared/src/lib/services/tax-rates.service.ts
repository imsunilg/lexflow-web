import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import { TaxRateDto, UpsertTaxRateRequest } from '../models/settings.models';
import { API_BASE_URL } from './api-base-url.token';

/** `TaxRatesController` (`api/v1/settings/tax-rates`, PRD Module 15 §8). `countryCode`/`taxType` are free strings — no first-class HSN/SAC or place-of-supply fields exist. */
@Injectable({ providedIn: 'root' })
export class TaxRatesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  list() {
    return this.http
      .get<ApiSuccessEnvelope<TaxRateDto[]>>(`${this.baseUrl}/settings/tax-rates`)
      .pipe(map((envelope) => envelope.data));
  }

  create(request: UpsertTaxRateRequest) {
    return this.http
      .post<ApiSuccessEnvelope<TaxRateDto>>(`${this.baseUrl}/settings/tax-rates`, request)
      .pipe(map((envelope) => envelope.data));
  }

  update(id: string, request: UpsertTaxRateRequest) {
    return this.http
      .put<ApiSuccessEnvelope<TaxRateDto>>(`${this.baseUrl}/settings/tax-rates/${id}`, request)
      .pipe(map((envelope) => envelope.data));
  }

  delete(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/settings/tax-rates/${id}`);
  }
}
