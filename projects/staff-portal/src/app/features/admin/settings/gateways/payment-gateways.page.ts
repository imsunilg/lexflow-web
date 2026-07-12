import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  ApiErrorEnvelope,
  GatewayConfigDto,
  PaymentGatewayProvider,
  SettingsService,
} from 'shared';
import { AdminTabsComponent } from '../../admin-tabs.component';

const PROVIDERS: { provider: PaymentGatewayProvider; label: string }[] = [
  { provider: 'stripe', label: 'Stripe' },
  { provider: 'razorpay', label: 'Razorpay' },
  { provider: 'paypal', label: 'PayPal' },
];

interface ProviderState {
  provider: PaymentGatewayProvider;
  label: string;
  config: GatewayConfigDto | null;
  form: FormGroup<{
    configJson: FormControl<string>;
    secret: FormControl<string>;
    isTestMode: FormControl<boolean>;
  }>;
  verifying: boolean;
  saving: boolean;
}

/**
 * Payment gateways (PRD Module 15 §9, `SettingsController` gateway routes).
 * `verifyGateway` with `save: false` is a pure verification round-trip; a
 * failed verify throws a 422 (caught below, never treated as saved — AC-S1:
 * an invalid key must never be persisted). The actual secret is never shown
 * back, only `hasSecret`.
 */
@Component({
  selector: 'lf-payment-gateways-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    AdminTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './payment-gateways.page.html',
  styleUrl: './payment-gateways.page.scss',
})
export class PaymentGatewaysPage {
  private readonly settingsService = inject(SettingsService);
  private readonly snackBar = inject(MatSnackBar);

  readonly loading = signal(true);
  readonly providerStates = signal<ProviderState[]>(
    PROVIDERS.map(({ provider, label }) => ({
      provider,
      label,
      config: null,
      form: new FormGroup({
        configJson: new FormControl('{}', { nonNullable: true, validators: [Validators.required] }),
        secret: new FormControl('', { nonNullable: true }),
        isTestMode: new FormControl(true, { nonNullable: true }),
      }),
      verifying: false,
      saving: false,
    })),
  );

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.settingsService.listGateways().subscribe({
      next: (configs) => {
        this.providerStates.update((states) =>
          states.map((state) => {
            const config = configs.find((c) => c.provider === state.provider) ?? null;
            if (config) {
              state.form.patchValue({
                configJson: config.configJson,
                isTestMode: config.isTestMode,
              });
            }
            return { ...state, config };
          }),
        );
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private extractErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      const envelope = err.error as Partial<ApiErrorEnvelope> | null;
      return envelope?.error?.message ?? fallback;
    }
    return fallback;
  }

  private setState(provider: PaymentGatewayProvider, patch: Partial<ProviderState>): void {
    this.providerStates.update((states) =>
      states.map((state) => (state.provider === provider ? { ...state, ...patch } : state)),
    );
  }

  private validateJson(state: ProviderState): boolean {
    try {
      JSON.parse(state.form.controls.configJson.value);
      return true;
    } catch {
      this.snackBar.open('Config must be valid JSON.', 'Dismiss', { duration: 5000 });
      return false;
    }
  }

  verify(state: ProviderState, save: boolean): void {
    state.form.markAllAsTouched();
    if (state.form.invalid || !this.validateJson(state)) return;
    const v = state.form.getRawValue();

    this.setState(state.provider, { verifying: !save, saving: save });
    this.settingsService
      .verifyGateway(state.provider, {
        configJson: v.configJson,
        secret: v.secret || null,
        isTestMode: v.isTestMode,
        save,
      })
      .subscribe({
        next: (config) => {
          this.setState(state.provider, { verifying: false, saving: false });
          if (save && config) {
            this.load();
            this.snackBar.open(`${state.label} gateway saved.`, 'Dismiss', { duration: 4000 });
          } else {
            this.snackBar.open(`${state.label} verification succeeded.`, 'Dismiss', {
              duration: 4000,
            });
          }
        },
        error: (err: unknown) => {
          this.setState(state.provider, { verifying: false, saving: false });
          this.snackBar.open(
            this.extractErrorMessage(err, `${state.label} verification failed.`),
            'Dismiss',
            { duration: 6000 },
          );
        },
      });
  }
}
