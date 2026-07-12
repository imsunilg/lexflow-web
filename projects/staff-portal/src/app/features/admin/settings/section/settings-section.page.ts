import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';
import {
  ApiErrorEnvelope,
  BranchDto,
  BranchesService,
  SETTINGS_SECTIONS,
  SettingsSectionValue,
  SettingsService,
} from 'shared';
import { AdminTabsComponent } from '../../admin-tabs.component';

interface HolidayGroup {
  date: FormControl<string>;
  name: FormControl<string>;
  branchId: FormControl<string | null>;
}

function buildHolidayGroup(): FormGroup<HolidayGroup> {
  return new FormGroup<HolidayGroup>({
    date: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    branchId: new FormControl<string | null>(null),
  });
}

/**
 * Generic editor for the 9 non-collection `SETTINGS_SECTIONS` (PRD Module 15).
 * Reads `:section` from the route and renders a dedicated form per section —
 * see `settings.models.ts`'s file-header comment for exactly which fields
 * each section supports server-side (deliberately not building UI for the
 * documented gaps: logo upload, portal branding, per-user theme override,
 * import/export/backup, HSN/SAC/place-of-supply, IP allowlist array, etc.).
 *
 * Password/secret fields (`smtp.password`, `sms_gateway.authToken`,
 * `whatsapp.accessToken`) are never pre-filled from `getSection` (the backend
 * strips secrets before returning), and are only sent back on save if the
 * user actually typed something — otherwise the previously-saved secret is
 * preserved by re-merging the last-loaded raw value.
 */
@Component({
  selector: 'lf-settings-section-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    AdminTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-section.page.html',
  styleUrl: './settings-section.page.scss',
})
export class SettingsSectionPage {
  private readonly route = inject(ActivatedRoute);
  private readonly settingsService = inject(SettingsService);
  private readonly branchesService = inject(BranchesService);
  private readonly snackBar = inject(MatSnackBar);

  readonly fiscalMonths = Array.from({ length: 12 }, (_, i) => i + 1);
  readonly branches = signal<BranchDto[]>([]);

  readonly sectionKey = signal('');
  readonly sectionLabel = computed(
    () => SETTINGS_SECTIONS.find((s) => s.key === this.sectionKey())?.label ?? this.sectionKey(),
  );
  readonly isKnownSection = computed(() =>
    SETTINGS_SECTIONS.some((s) => s.key === this.sectionKey()),
  );

  readonly loading = signal(true);
  readonly saving = signal(false);

  private rawValue: SettingsSectionValue = {};

  // firm_details
  readonly firmDetailsForm = new FormGroup({
    legalName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    displayName: new FormControl('', { nonNullable: true }),
    registrationNumbers: new FormControl('{}', { nonNullable: true }),
    gstinOrPan: new FormControl('', { nonNullable: true }),
    fiscalYearStartMonth: new FormControl(4, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), Validators.max(12)],
    }),
    locale: new FormControl('', { nonNullable: true }),
    currency: new FormControl('', { nonNullable: true }),
    timezone: new FormControl('', { nonNullable: true }),
  });

  // branding
  readonly brandingForm = new FormGroup({
    logoLightUrl: new FormControl('', { nonNullable: true }),
    logoDarkUrl: new FormControl('', { nonNullable: true }),
    primaryColor: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)],
    }),
    accentColor: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)],
    }),
    letterheadMarginsMm: new FormControl('{}', { nonNullable: true }),
    emailFooter: new FormControl('', { nonNullable: true }),
  });

  // theme
  readonly themeForm = new FormGroup({
    default: new FormControl<'Light' | 'Dark' | 'System'>('System', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    allowUserOverride: new FormControl(false, { nonNullable: true }),
  });

  // smtp
  readonly smtpForm = new FormGroup({
    host: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    port: new FormControl(587, { nonNullable: true, validators: [Validators.required] }),
    tlsMode: new FormControl<'None' | 'StartTls' | 'Ssl' | 'Tls'>('StartTls', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    username: new FormControl('', { nonNullable: true }),
    password: new FormControl('', { nonNullable: true }),
    fromName: new FormControl('', { nonNullable: true }),
    fromAddress: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    useFallbackPlatformMailer: new FormControl(false, { nonNullable: true }),
  });
  readonly smtpTestAddress = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  readonly smtpTesting = signal(false);
  readonly showSmtpTestField = signal(false);

  // sms_gateway
  readonly smsForm = new FormGroup({
    provider: new FormControl<'sms_twilio' | 'sms_msg91'>('sms_twilio', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    senderId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    accountSid: new FormControl('', { nonNullable: true }),
    authToken: new FormControl('', { nonNullable: true }),
    dltEntityId: new FormControl('', { nonNullable: true }),
  });
  readonly smsTestPhone = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  readonly smsTesting = signal(false);
  readonly showSmsTestField = signal(false);

  // whatsapp
  readonly whatsappForm = new FormGroup({
    wabaId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    phoneNumberId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    accessToken: new FormControl('', { nonNullable: true }),
  });
  readonly whatsappTestPhone = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  readonly whatsappSyncing = signal(false);
  readonly whatsappTesting = signal(false);
  readonly showWhatsappTestField = signal(false);

  // business_hours
  readonly businessHoursForm = new FormGroup({
    weeklyHours: new FormControl('{}', { nonNullable: true }),
    holidays: new FormArray<FormGroup<HolidayGroup>>([]),
  });

  // data
  readonly dataForm = new FormGroup({
    retentionYears: new FormControl(7, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
    legalHold: new FormControl(false, { nonNullable: true }),
  });

  // security
  readonly securityForm = new FormGroup({
    passwordMinLength: new FormControl(12, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(10)],
    }),
    twoFactorEnforcement: new FormControl<'off' | 'optional' | 'required-per-role'>('optional', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    sessionTimeoutMinutes: new FormControl(30, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
    ipAllowlistEnabled: new FormControl(false, { nonNullable: true }),
  });

  constructor() {
    this.branchesService.list().subscribe({
      next: (branches) => this.branches.set(branches),
      error: () => this.branches.set([]),
    });

    this.route.paramMap.subscribe((params) => {
      const key = params.get('section') ?? '';
      this.sectionKey.set(key);
      this.load(key);
    });
  }

  get holidays(): FormArray<FormGroup<HolidayGroup>> {
    return this.businessHoursForm.controls.holidays;
  }

  addHoliday(): void {
    this.holidays.push(buildHolidayGroup());
  }

  removeHoliday(index: number): void {
    this.holidays.removeAt(index);
  }

  private load(key: string): void {
    this.loading.set(true);
    this.settingsService.getSection(key).subscribe({
      next: (value) => {
        this.rawValue = value;
        this.patchForm(key, value);
        this.loading.set(false);
      },
      error: () => {
        this.rawValue = {};
        this.loading.set(false);
      },
    });
  }

  private patchForm(key: string, value: SettingsSectionValue): void {
    switch (key) {
      case 'firm_details':
        this.firmDetailsForm.patchValue({
          legalName: (value['legalName'] as string) ?? '',
          displayName: (value['displayName'] as string) ?? '',
          registrationNumbers: value['registrationNumbers']
            ? JSON.stringify(value['registrationNumbers'], null, 2)
            : '{}',
          gstinOrPan: (value['gstinOrPan'] as string) ?? '',
          fiscalYearStartMonth: (value['fiscalYearStartMonth'] as number) ?? 4,
          locale: (value['locale'] as string) ?? '',
          currency: (value['currency'] as string) ?? '',
          timezone: (value['timezone'] as string) ?? '',
        });
        break;
      case 'branding':
        this.brandingForm.patchValue({
          logoLightUrl: (value['logoLightUrl'] as string) ?? '',
          logoDarkUrl: (value['logoDarkUrl'] as string) ?? '',
          primaryColor: (value['primaryColor'] as string) ?? '',
          accentColor: (value['accentColor'] as string) ?? '',
          letterheadMarginsMm: value['letterheadMarginsMm']
            ? JSON.stringify(value['letterheadMarginsMm'], null, 2)
            : '{}',
          emailFooter: (value['emailFooter'] as string) ?? '',
        });
        break;
      case 'theme':
        this.themeForm.patchValue({
          default: (value['default'] as 'Light' | 'Dark' | 'System') ?? 'System',
          allowUserOverride: Boolean(value['allowUserOverride']),
        });
        break;
      case 'smtp':
        this.smtpForm.patchValue({
          host: (value['host'] as string) ?? '',
          port: (value['port'] as number) ?? 587,
          tlsMode: (value['tlsMode'] as 'None' | 'StartTls' | 'Ssl' | 'Tls') ?? 'StartTls',
          username: (value['username'] as string) ?? '',
          fromName: (value['fromName'] as string) ?? '',
          fromAddress: (value['fromAddress'] as string) ?? '',
          useFallbackPlatformMailer: Boolean(value['useFallbackPlatformMailer']),
        });
        break;
      case 'sms_gateway':
        this.smsForm.patchValue({
          provider: (value['provider'] as 'sms_twilio' | 'sms_msg91') ?? 'sms_twilio',
          senderId: (value['senderId'] as string) ?? '',
          accountSid: (value['accountSid'] as string) ?? '',
          dltEntityId: (value['dltEntityId'] as string) ?? '',
        });
        break;
      case 'whatsapp':
        this.whatsappForm.patchValue({
          wabaId: (value['wabaId'] as string) ?? '',
          phoneNumberId: (value['phoneNumberId'] as string) ?? '',
        });
        break;
      case 'business_hours': {
        this.holidays.clear();
        const holidays = Array.isArray(value['holidays'])
          ? (value['holidays'] as Array<{ date: string; name: string; branchId?: string | null }>)
          : [];
        for (const holiday of holidays) {
          const group = buildHolidayGroup();
          group.patchValue({
            date: holiday.date ?? '',
            name: holiday.name ?? '',
            branchId: holiday.branchId ?? null,
          });
          this.holidays.push(group);
        }
        this.businessHoursForm.patchValue({
          weeklyHours: value['weeklyHours'] ? JSON.stringify(value['weeklyHours'], null, 2) : '{}',
        });
        break;
      }
      case 'data':
        this.dataForm.patchValue({
          retentionYears: (value['retentionYears'] as number) ?? 7,
          legalHold: Boolean(value['legalHold']),
        });
        break;
      case 'security':
        this.securityForm.patchValue({
          passwordMinLength: (value['passwordMinLength'] as number) ?? 12,
          twoFactorEnforcement:
            (value['twoFactorEnforcement'] as 'off' | 'optional' | 'required-per-role') ??
            'optional',
          sessionTimeoutMinutes: (value['sessionTimeoutMinutes'] as number) ?? 30,
          ipAllowlistEnabled: Boolean(value['ipAllowlistEnabled']),
        });
        break;
    }
  }

  private parseJson(text: string, label: string): { ok: true; value: unknown } | { ok: false } {
    const trimmed = text.trim();
    if (!trimmed) return { ok: true, value: {} };
    try {
      return { ok: true, value: JSON.parse(trimmed) };
    } catch {
      this.snackBar.open(`${label} must be valid JSON.`, 'Dismiss', { duration: 5000 });
      return { ok: false };
    }
  }

  /** Restores previously-saved secret keys when the user leaves a password field blank. */
  private mergeSecrets(
    payload: SettingsSectionValue,
    formValue: Record<string, unknown>,
    secretKeys: string[],
  ): SettingsSectionValue {
    for (const key of secretKeys) {
      if (!formValue[key]) {
        if (this.rawValue[key] !== undefined) payload[key] = this.rawValue[key];
        else delete payload[key];
      }
    }
    return payload;
  }

  private extractErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      const envelope = err.error as Partial<ApiErrorEnvelope> | null;
      return envelope?.error?.message ?? fallback;
    }
    return fallback;
  }

  private save(payload: SettingsSectionValue): void {
    this.saving.set(true);
    this.settingsService.updateSection(this.sectionKey(), payload).subscribe({
      next: (value) => {
        this.rawValue = value;
        this.saving.set(false);
        this.snackBar.open('Settings saved.', 'Dismiss', { duration: 3000 });
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snackBar.open(this.extractErrorMessage(err, 'Could not save settings.'), 'Dismiss', {
          duration: 6000,
        });
      },
    });
  }

  saveFirmDetails(): void {
    this.firmDetailsForm.markAllAsTouched();
    if (this.firmDetailsForm.invalid) return;
    const v = this.firmDetailsForm.getRawValue();
    const registrationNumbers = this.parseJson(v.registrationNumbers, 'Registration numbers');
    if (!registrationNumbers.ok) return;
    this.save({
      legalName: v.legalName,
      displayName: v.displayName || null,
      registrationNumbers: registrationNumbers.value,
      gstinOrPan: v.gstinOrPan || null,
      fiscalYearStartMonth: v.fiscalYearStartMonth,
      locale: v.locale || null,
      currency: v.currency || null,
      timezone: v.timezone || null,
    });
  }

  saveBranding(): void {
    this.brandingForm.markAllAsTouched();
    if (this.brandingForm.invalid) return;
    const v = this.brandingForm.getRawValue();
    const letterheadMarginsMm = this.parseJson(v.letterheadMarginsMm, 'Letterhead margins');
    if (!letterheadMarginsMm.ok) return;
    this.save({
      logoLightUrl: v.logoLightUrl || null,
      logoDarkUrl: v.logoDarkUrl || null,
      primaryColor: v.primaryColor || null,
      accentColor: v.accentColor || null,
      letterheadMarginsMm: letterheadMarginsMm.value,
      emailFooter: v.emailFooter || null,
    });
  }

  saveTheme(): void {
    this.themeForm.markAllAsTouched();
    if (this.themeForm.invalid) return;
    this.save({ ...this.themeForm.getRawValue() });
  }

  saveSmtp(): void {
    this.smtpForm.markAllAsTouched();
    if (this.smtpForm.invalid) return;
    const v = this.smtpForm.getRawValue();
    let payload: SettingsSectionValue = {
      host: v.host,
      port: v.port,
      tlsMode: v.tlsMode,
      username: v.username || null,
      password: v.password || null,
      fromName: v.fromName || null,
      fromAddress: v.fromAddress,
      useFallbackPlatformMailer: v.useFallbackPlatformMailer,
    };
    payload = this.mergeSecrets(payload, v, ['password']);
    this.save(payload);
  }

  toggleSmtpTestField(): void {
    this.showSmtpTestField.update((v) => !v);
  }

  sendSmtpTest(): void {
    this.smtpTestAddress.markAsTouched();
    if (this.smtpTestAddress.invalid) return;
    const v = this.smtpForm.getRawValue();
    this.smtpTesting.set(true);
    this.settingsService
      .testSmtp({
        host: v.host,
        port: v.port,
        tlsMode: v.tlsMode,
        username: v.username || null,
        password: v.password || null,
        fromName: v.fromName || null,
        fromAddress: v.fromAddress,
        toAddress: this.smtpTestAddress.value,
      })
      .subscribe({
        next: (result) => {
          this.smtpTesting.set(false);
          this.snackBar.open(result.message, 'Dismiss', { duration: 6000 });
        },
        error: (err: unknown) => {
          this.smtpTesting.set(false);
          this.snackBar.open(this.extractErrorMessage(err, 'SMTP test failed.'), 'Dismiss', {
            duration: 6000,
          });
        },
      });
  }

  saveSms(): void {
    this.smsForm.markAllAsTouched();
    if (this.smsForm.invalid) return;
    const v = this.smsForm.getRawValue();
    let payload: SettingsSectionValue = {
      provider: v.provider,
      senderId: v.senderId,
      accountSid: v.accountSid || null,
      authToken: v.authToken || null,
      dltEntityId: v.dltEntityId || null,
    };
    payload = this.mergeSecrets(payload, v, ['authToken']);
    this.save(payload);
  }

  toggleSmsTestField(): void {
    this.showSmsTestField.update((v) => !v);
  }

  sendSmsTest(): void {
    this.smsTestPhone.markAsTouched();
    if (this.smsTestPhone.invalid) return;
    const v = this.smsForm.getRawValue();
    this.smsTesting.set(true);
    this.settingsService
      .testSms({
        provider: v.provider,
        accountSid: v.accountSid || null,
        authToken: v.authToken || null,
        senderId: v.senderId,
        dltEntityId: v.dltEntityId || null,
        toPhoneNumber: this.smsTestPhone.value,
      })
      .subscribe({
        next: (result) => {
          this.smsTesting.set(false);
          this.snackBar.open(result.message, 'Dismiss', { duration: 6000 });
        },
        error: (err: unknown) => {
          this.smsTesting.set(false);
          this.snackBar.open(this.extractErrorMessage(err, 'SMS test failed.'), 'Dismiss', {
            duration: 6000,
          });
        },
      });
  }

  saveWhatsapp(): void {
    this.whatsappForm.markAllAsTouched();
    if (this.whatsappForm.invalid) return;
    const v = this.whatsappForm.getRawValue();
    let payload: SettingsSectionValue = {
      wabaId: v.wabaId,
      phoneNumberId: v.phoneNumberId,
      accessToken: v.accessToken || null,
    };
    payload = this.mergeSecrets(payload, v, ['accessToken']);
    this.save(payload);
  }

  syncWhatsappTemplates(): void {
    this.whatsappForm.markAllAsTouched();
    if (
      this.whatsappForm.controls.wabaId.invalid ||
      this.whatsappForm.controls.phoneNumberId.invalid
    ) {
      return;
    }
    const v = this.whatsappForm.getRawValue();
    if (!v.accessToken) {
      this.snackBar.open('Enter an access token to sync templates.', 'Dismiss', { duration: 5000 });
      return;
    }
    this.whatsappSyncing.set(true);
    this.settingsService
      .syncWhatsAppTemplates({
        wabaId: v.wabaId,
        phoneNumberId: v.phoneNumberId,
        accessToken: v.accessToken,
      })
      .subscribe({
        next: (result) => {
          this.whatsappSyncing.set(false);
          this.snackBar.open(result.message, 'Dismiss', { duration: 6000 });
        },
        error: (err: unknown) => {
          this.whatsappSyncing.set(false);
          this.snackBar.open(this.extractErrorMessage(err, 'Template sync failed.'), 'Dismiss', {
            duration: 6000,
          });
        },
      });
  }

  toggleWhatsappTestField(): void {
    this.showWhatsappTestField.update((v) => !v);
  }

  sendWhatsappTest(): void {
    this.whatsappTestPhone.markAsTouched();
    if (this.whatsappTestPhone.invalid) return;
    const v = this.whatsappForm.getRawValue();
    if (!v.accessToken) {
      this.snackBar.open('Enter an access token to send a test message.', 'Dismiss', {
        duration: 5000,
      });
      return;
    }
    this.whatsappTesting.set(true);
    this.settingsService
      .testWhatsApp({
        wabaId: v.wabaId,
        phoneNumberId: v.phoneNumberId,
        accessToken: v.accessToken,
        toPhoneNumber: this.whatsappTestPhone.value,
      })
      .subscribe({
        next: (result) => {
          this.whatsappTesting.set(false);
          this.snackBar.open(result.message, 'Dismiss', { duration: 6000 });
        },
        error: (err: unknown) => {
          this.whatsappTesting.set(false);
          this.snackBar.open(this.extractErrorMessage(err, 'WhatsApp test failed.'), 'Dismiss', {
            duration: 6000,
          });
        },
      });
  }

  saveBusinessHours(): void {
    this.businessHoursForm.markAllAsTouched();
    if (this.businessHoursForm.invalid) return;
    const v = this.businessHoursForm.getRawValue();
    const weeklyHours = this.parseJson(v.weeklyHours, 'Weekly hours');
    if (!weeklyHours.ok) return;
    this.save({
      weeklyHours: weeklyHours.value,
      holidays: v.holidays,
    });
  }

  saveData(): void {
    this.dataForm.markAllAsTouched();
    if (this.dataForm.invalid) return;
    this.save({ ...this.dataForm.getRawValue() });
  }

  saveSecurity(): void {
    this.securityForm.markAllAsTouched();
    if (this.securityForm.invalid) return;
    this.save({ ...this.securityForm.getRawValue() });
  }
}
