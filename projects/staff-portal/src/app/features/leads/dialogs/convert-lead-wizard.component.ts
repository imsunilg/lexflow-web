import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatStepperModule } from '@angular/material/stepper';
import {
  ApiErrorEnvelope,
  ConvertLeadResult,
  Lead,
  LeadsService,
  requiredCatalogValidators,
} from 'shared';

export interface ConvertLeadWizardData {
  lead: Lead;
}

/**
 * 3-step conversion wizard (PRD Module 2 UI Components: "conversion wizard
 * (3 steps: Client → Matter (optional) → Fees (optional))"). The lexflow-api
 * backend today only implements client-only conversion — `LeadService.ConvertAsync`
 * throws `MODULE_NOT_AVAILABLE` if `createMatter` or an invoice payload is
 * sent, because the Legal/Fin modules haven't shipped yet. Steps 2 and 3 are
 * still fully built per the PRD's spec (so the wizard is complete once those
 * modules ship) but are clearly marked "not available yet," and submitting
 * with either enabled surfaces the server's real error rather than faking success.
 */
@Component({
  selector: 'lf-convert-lead-wizard',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatStepperModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title i18n="@@leads.convertLeadWizard.title">Convert lead to client</h2>
    <mat-dialog-content>
      @if (result()) {
        <p class="convert-wizard__success" i18n="@@leads.convertLeadWizard.successMessage">
          Converted. Client created{{ result()!.matterId ? ' with matter' : '' }}.
        </p>
      } @else {
        <mat-stepper linear>
          <mat-step
            [stepControl]="clientForm"
            label="Client"
            i18n-label="@@leads.convertLeadWizard.clientStepLabel"
          >
            <form [formGroup]="clientForm" class="convert-wizard__form">
              <mat-form-field appearance="outline">
                <mat-label i18n="@@leads.convertLeadWizard.firstNameLabel">First name</mat-label>
                <input matInput formControlName="firstName" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label i18n="@@leads.convertLeadWizard.lastNameLabel">Last name</mat-label>
                <input matInput formControlName="lastName" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label i18n="@@leads.convertLeadWizard.emailLabel">Email</mat-label>
                <input matInput formControlName="email" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label i18n="@@leads.convertLeadWizard.phoneLabel">Phone</mat-label>
                <input matInput formControlName="phone" />
              </mat-form-field>
            </form>
            <div class="convert-wizard__step-actions">
              <button
                mat-flat-button
                color="primary"
                matStepperNext
                type="button"
                i18n="@@leads.convertLeadWizard.nextButton"
              >
                Next
              </button>
            </div>
          </mat-step>

          <mat-step
            label="Matter (optional)"
            i18n-label="@@leads.convertLeadWizard.matterStepLabel"
          >
            <mat-checkbox
              [formControl]="createMatterControl"
              i18n="@@leads.convertLeadWizard.createMatterCheckbox"
              >Create a matter</mat-checkbox
            >
            @if (createMatterControl.value) {
              <p
                class="convert-wizard__hint"
                i18n="@@leads.convertLeadWizard.matterUnavailableHint"
              >
                Matter creation isn't available in this environment yet (the Legal module hasn't
                shipped) — submitting with this enabled will show that error.
              </p>
              <form [formGroup]="matterForm" class="convert-wizard__form">
                <mat-form-field appearance="outline" class="convert-wizard__wide">
                  <mat-label i18n="@@leads.convertLeadWizard.matterTitleLabel"
                    >Matter title</mat-label
                  >
                  <input matInput formControlName="title" />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label i18n="@@leads.convertLeadWizard.oppositePartyLabel"
                    >Opposing party</mat-label
                  >
                  <input matInput formControlName="oppositeParty" />
                </mat-form-field>
              </form>
            }
            <div class="convert-wizard__step-actions">
              <button
                mat-button
                matStepperPrevious
                type="button"
                i18n="@@leads.convertLeadWizard.backButton"
              >
                Back
              </button>
              <button
                mat-flat-button
                color="primary"
                matStepperNext
                type="button"
                i18n="@@leads.convertLeadWizard.nextButton"
              >
                Next
              </button>
            </div>
          </mat-step>

          <mat-step label="Fees (optional)" i18n-label="@@leads.convertLeadWizard.feesStepLabel">
            <mat-checkbox [formControl]="createInvoiceControl"
              ><span i18n="@@leads.convertLeadWizard.createInvoiceCheckbox"
                >Create a consultation invoice</span
              ></mat-checkbox
            >
            @if (createInvoiceControl.value) {
              <p
                class="convert-wizard__hint"
                i18n="@@leads.convertLeadWizard.billingUnavailableHint"
              >
                Billing isn't available in this environment yet (the Fin module hasn't shipped) —
                submitting with this enabled will show that error.
              </p>
              <form [formGroup]="invoiceForm" class="convert-wizard__form">
                <mat-form-field appearance="outline">
                  <mat-label i18n="@@leads.convertLeadWizard.amountLabel">Amount</mat-label>
                  <input matInput type="number" formControlName="amount" />
                </mat-form-field>
              </form>
            }

            @if (errorMessage()) {
              <p class="convert-wizard__error" role="alert">{{ errorMessage() }}</p>
            }

            <div class="convert-wizard__step-actions">
              <button
                mat-button
                matStepperPrevious
                type="button"
                i18n="@@leads.convertLeadWizard.backButton"
              >
                Back
              </button>
              <button
                mat-flat-button
                color="primary"
                type="button"
                [disabled]="clientForm.invalid || submitting()"
                (click)="submit()"
              >
                @if (submitting()) {
                  <mat-spinner diameter="20" />
                } @else {
                  <span i18n="@@leads.convertLeadWizard.convertButton">Convert</span>
                }
              </button>
            </div>
          </mat-step>
        </mat-stepper>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="result()">
        {{ result() ? 'Done' : 'Cancel' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .convert-wizard__form {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0 var(--lf-space-2);
      padding-top: var(--lf-space-2);
      min-width: 420px;
    }

    .convert-wizard__wide {
      grid-column: 1 / -1;
    }

    .convert-wizard__step-actions {
      display: flex;
      gap: var(--lf-space-1);
      margin-top: var(--lf-space-2);
    }

    .convert-wizard__hint {
      color: var(--lf-on-surface-variant);
      font-size: var(--lf-text-sm);
    }

    .convert-wizard__error {
      color: var(--lf-error);
      font-size: var(--lf-text-sm);
    }

    .convert-wizard__success {
      color: var(--lf-success);
      font-weight: 600;
    }
  `,
})
export class ConvertLeadWizardComponent {
  private readonly leadsService = inject(LeadsService);
  private readonly dialogRef =
    inject<MatDialogRef<ConvertLeadWizardComponent, ConvertLeadResult | undefined>>(MatDialogRef);
  readonly data = inject<ConvertLeadWizardData>(MAT_DIALOG_DATA);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly result = signal<ConvertLeadResult | null>(null);

  readonly createMatterControl = new FormControl(false, { nonNullable: true });
  readonly createInvoiceControl = new FormControl(false, { nonNullable: true });

  readonly clientForm = new FormGroup({
    firstName: new FormControl(this.data.lead.firstName, {
      nonNullable: true,
      validators: requiredCatalogValidators('name'),
    }),
    lastName: new FormControl(this.data.lead.lastName ?? '', { nonNullable: true }),
    email: new FormControl(this.data.lead.email ?? '', { nonNullable: true }),
    phone: new FormControl(this.data.lead.phoneE164 ?? '', { nonNullable: true }),
  });

  readonly matterForm = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    oppositeParty: new FormControl('', { nonNullable: true }),
  });

  readonly invoiceForm = new FormGroup({
    amount: new FormControl<number | null>(null),
  });

  submit(): void {
    if (this.clientForm.invalid) {
      this.clientForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    const createMatter = this.createMatterControl.value;
    const matter = this.matterForm.getRawValue();

    this.leadsService
      .convert(this.data.lead.id, {
        createMatter,
        matter: createMatter
          ? {
              title: matter.title,
              oppositeParties: matter.oppositeParty ? [{ name: matter.oppositeParty }] : [],
            }
          : null,
        invoicePayload: this.createInvoiceControl.value ? this.invoiceForm.getRawValue() : null,
      })
      .subscribe({
        next: (result) => {
          this.submitting.set(false);
          this.result.set(result);
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.errorMessage.set(this.messageFor(error));
        },
      });
  }

  private messageFor(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Something went wrong. Please try again.';
    }
    const envelope = error.error as Partial<ApiErrorEnvelope> | null;
    switch (envelope?.error?.code) {
      case 'MODULE_NOT_AVAILABLE':
        return "Matter/Invoice creation isn't available in this environment yet. Uncheck those steps and convert with Client only.";
      case 'CONFLICT_OF_INTEREST_SUSPECTED':
        return 'A potential conflict of interest was found against an existing matter. This needs review before converting.';
      case 'CONVERT_STAGE_TOO_EARLY':
        return "This lead hasn't reached Consultation Done yet — ask an admin to force-convert if needed.";
      case 'LEAD_NOT_OPEN':
        return 'This lead has already been converted or marked lost.';
      default:
        return envelope?.error?.message ?? 'Something went wrong. Please try again.';
    }
  }
}
