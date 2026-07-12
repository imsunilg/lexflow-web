import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiSuccessEnvelope } from '../models/api-envelope.models';
import {
  ExternalCallResult,
  GatewayConfigDto,
  PaymentGatewayProvider,
  SettingsAuditEntryDto,
  SettingsSectionKey,
  SettingsSectionValue,
  SyncWhatsAppTemplatesRequest,
  TestSmsRequest,
  TestSmtpRequest,
  TestWhatsAppRequest,
  VerifyGatewayRequest,
} from '../models/settings.models';
import { API_BASE_URL } from './api-base-url.token';

/**
 * `SettingsController` (PRD Module 15). Generic `GET/PUT /settings/{section}`
 * covers the 9 non-collection sections in `SETTINGS_SECTIONS`; `taxes`,
 * `document_templates`, `number_series`, `email_templates`, `workflow_rules`
 * are collection sections with their own dedicated services (`PUT` on the
 * generic route 409s for those). See `settings.models.ts`'s file-header
 * comment for the full list of confirmed gaps per section.
 */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  getSection(section: SettingsSectionKey | string) {
    return this.http
      .get<ApiSuccessEnvelope<SettingsSectionValue>>(`${this.baseUrl}/settings/${section}`)
      .pipe(map((envelope) => envelope.data));
  }

  updateSection(section: SettingsSectionKey | string, value: SettingsSectionValue) {
    return this.http
      .put<ApiSuccessEnvelope<SettingsSectionValue>>(`${this.baseUrl}/settings/${section}`, value)
      .pipe(map((envelope) => envelope.data));
  }

  testSmtp(request: TestSmtpRequest) {
    return this.http
      .post<ApiSuccessEnvelope<ExternalCallResult>>(`${this.baseUrl}/settings/smtp/test`, request)
      .pipe(map((envelope) => envelope.data));
  }

  testSms(request: TestSmsRequest) {
    return this.http
      .post<ApiSuccessEnvelope<ExternalCallResult>>(`${this.baseUrl}/settings/sms/test`, request)
      .pipe(map((envelope) => envelope.data));
  }

  syncWhatsAppTemplates(request: SyncWhatsAppTemplatesRequest) {
    return this.http
      .post<ApiSuccessEnvelope<ExternalCallResult>>(
        `${this.baseUrl}/settings/whatsapp/sync-templates`,
        request,
      )
      .pipe(map((envelope) => envelope.data));
  }

  testWhatsApp(request: TestWhatsAppRequest) {
    return this.http
      .post<ApiSuccessEnvelope<ExternalCallResult>>(
        `${this.baseUrl}/settings/whatsapp/test`,
        request,
      )
      .pipe(map((envelope) => envelope.data));
  }

  listGateways() {
    return this.http
      .get<ApiSuccessEnvelope<GatewayConfigDto[]>>(`${this.baseUrl}/settings/gateways`)
      .pipe(map((envelope) => envelope.data));
  }

  verifyGateway(provider: PaymentGatewayProvider | string, request: VerifyGatewayRequest) {
    return this.http
      .post<ApiSuccessEnvelope<GatewayConfigDto | null>>(
        `${this.baseUrl}/settings/gateways/${provider}/verify`,
        request,
      )
      .pipe(map((envelope) => envelope.data));
  }

  /** Scoped to settings/gateway changes only (`section` filters by the payload's own `Key`/`Provider`) — not a general audit browser. See file-header comment on `SettingsAuditEntryDto`. */
  audit(section?: string) {
    let params = new HttpParams();
    if (section) params = params.set('section', section);
    return this.http
      .get<ApiSuccessEnvelope<SettingsAuditEntryDto[]>>(`${this.baseUrl}/settings/audit`, {
        params,
      })
      .pipe(map((envelope) => envelope.data));
  }
}
