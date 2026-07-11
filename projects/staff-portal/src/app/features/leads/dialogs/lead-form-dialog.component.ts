import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { Observable, catchError, of, switchMap } from 'rxjs';
import {
  Lead,
  LeadLookupsService,
  LeadSource,
  LeadsService,
  atLeastOneRequired,
  catalogValidators,
  requiredCatalogValidators,
} from 'shared';
import {
  DuplicateResolutionDialogComponent,
  DuplicateResolutionDialogData,
  DuplicateResolutionResult,
} from './duplicate-resolution-dialog.component';

export interface LeadFormDialogData {
  lead?: Lead;
}

export type LeadFormDialogResult =
  { outcome: 'saved'; lead: Lead } | { outcome: 'attached-to-existing'; leadId: string };

/**
 * Create/Edit lead screen (PRD Module 2 Screen List). On create, runs the
 * duplicate check (User Flow step 2) before committing; on edit, saves
 * directly — re-running a duplicate check against a lead's own unchanged
 * phone/email on every edit would just re-surface itself as a "duplicate."
 */
@Component({
  selector: 'lf-lead-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ isEdit ? 'Edit lead' : 'New lead' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="lead-form">
        <mat-form-field appearance="outline">
          <mat-label>First name</mat-label>
          <input matInput formControlName="firstName" />
          @if (form.controls.firstName.hasError('required') && form.controls.firstName.touched) {
            <mat-error>First name is required.</mat-error>
          }
          @if (form.controls.firstName.hasError('minlength') && form.controls.firstName.touched) {
            <mat-error>At least 2 characters.</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Last name</mat-label>
          <input matInput formControlName="lastName" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Company</mat-label>
          <input matInput formControlName="company" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput type="email" formControlName="email" />
          @if (form.controls.email.hasError('pattern') && form.controls.email.touched) {
            <mat-error>Enter a valid email address.</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Phone</mat-label>
          <input matInput formControlName="phoneE164" placeholder="+919812345678" />
          @if (form.controls.phoneE164.hasError('pattern') && form.controls.phoneE164.touched) {
            <mat-error>Use international format, e.g. +919812345678.</mat-error>
          }
        </mat-form-field>

        @if (
          form.hasError('atLeastOneRequired') &&
          (form.controls.email.touched || form.controls.phoneE164.touched)
        ) {
          <p class="lead-form__error" role="alert">At least one of phone or email is required.</p>
        }

        <mat-form-field appearance="outline">
          <mat-label>Source</mat-label>
          <mat-select formControlName="sourceId">
            <mat-option [value]="null">Direct</mat-option>
            @for (source of sources(); track source.id) {
              <mat-option [value]="source.id">{{ source.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="lead-form__wide">
          <mat-label>Issue summary</mat-label>
          <textarea matInput formControlName="issueSummary" rows="3"></textarea>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Opposing party</mat-label>
          <input matInput formControlName="opposingParty" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Budget band</mat-label>
          <input matInput formControlName="budgetBand" placeholder="e.g. ₹50k–2L" />
        </mat-form-field>

        @if (errorMessage()) {
          <p class="lead-form__error" role="alert">{{ errorMessage() }}</p>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="undefined">Cancel</button>
      <button
        mat-flat-button
        color="primary"
        type="button"
        [disabled]="form.invalid || saving()"
        (click)="submit()"
      >
        @if (saving()) {
          <mat-spinner diameter="20" />
        } @else {
          Save
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .lead-form {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0 var(--lf-space-2);
      min-width: 480px;
    }

    .lead-form__wide {
      grid-column: 1 / -1;
    }

    .lead-form__error {
      grid-column: 1 / -1;
      margin: 0 0 var(--lf-space-1);
      color: var(--lf-error);
      font-size: var(--lf-text-sm);
    }
  `,
})
export class LeadFormDialogComponent {
  private readonly leadsService = inject(LeadsService);
  private readonly lookupsService = inject(LeadLookupsService);
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef =
    inject<MatDialogRef<LeadFormDialogComponent, LeadFormDialogResult>>(MatDialogRef);
  readonly data = inject<LeadFormDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};

  readonly isEdit = !!this.data.lead;
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly sources = signal<LeadSource[]>([]);

  readonly form = new FormGroup(
    {
      firstName: new FormControl(this.data.lead?.firstName ?? '', {
        nonNullable: true,
        validators: requiredCatalogValidators('name'),
      }),
      lastName: new FormControl(this.data.lead?.lastName ?? ''),
      company: new FormControl(this.data.lead?.company ?? ''),
      email: new FormControl(this.data.lead?.email ?? '', {
        validators: catalogValidators('email'),
      }),
      phoneE164: new FormControl(this.data.lead?.phoneE164 ?? '', {
        validators: catalogValidators('phoneE164'),
      }),
      sourceId: new FormControl<string | null>(this.data.lead?.sourceId ?? null),
      issueSummary: new FormControl(this.data.lead?.issueSummary ?? ''),
      opposingParty: new FormControl(this.data.lead?.opposingParty ?? ''),
      budgetBand: new FormControl(this.data.lead?.budgetBand ?? ''),
    },
    { validators: atLeastOneRequired('email', 'phoneE164') },
  );

  constructor() {
    this.lookupsService.sources().subscribe((sources) => this.sources.set(sources));
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    const value = this.form.getRawValue();

    const proceed = this.isEdit
      ? of<DuplicateResolutionResult>({ action: 'create-anyway' })
      : this.leadsService
          .checkDuplicates({
            name: `${value.firstName} ${value.lastName ?? ''}`.trim(),
            email: value.email || undefined,
            phoneE164: value.phoneE164 || undefined,
          })
          .pipe(
            switchMap((matches) => {
              if (matches.length === 0) {
                return of<DuplicateResolutionResult>({ action: 'create-anyway' });
              }
              return this.dialog
                .open<
                  DuplicateResolutionDialogComponent,
                  DuplicateResolutionDialogData,
                  DuplicateResolutionResult
                >(DuplicateResolutionDialogComponent, { data: { matches } })
                .afterClosed();
            }),
          );

    proceed.subscribe((resolution) => {
      if (!resolution) {
        this.saving.set(false);
        return;
      }
      if (resolution.action === 'attach-to-existing') {
        this.dialogRef.close({ outcome: 'attached-to-existing', leadId: resolution.leadId });
        return;
      }
      this.save(value);
    });
  }

  private save(value: ReturnType<typeof this.form.getRawValue>): void {
    const request = {
      firstName: value.firstName,
      lastName: value.lastName || null,
      company: value.company || null,
      email: value.email || null,
      phoneE164: value.phoneE164 || null,
      sourceId: value.sourceId || null,
      issueSummary: value.issueSummary || null,
      opposingParty: value.opposingParty || null,
      budgetBand: value.budgetBand || null,
    };

    const save$: Observable<Lead> = this.data.lead
      ? this.leadsService.update(this.data.lead.id, request)
      : this.leadsService.create(request);

    save$
      .pipe(
        catchError((error: unknown) => {
          this.saving.set(false);
          this.errorMessage.set(
            error instanceof HttpErrorResponse && error.status === 400
              ? 'Check the highlighted fields and try again.'
              : 'Something went wrong. Please try again.',
          );
          return of(null);
        }),
      )
      .subscribe((lead) => {
        if (lead) {
          this.dialogRef.close({ outcome: 'saved', lead });
        }
      });
  }
}
