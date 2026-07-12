import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import {
  ApiErrorEnvelope,
  CourtHoliday,
  CourtLookupsService,
  Hearing,
  HearingsService,
  RecordHearingOutcomeResult,
} from 'shared';

export interface HearingOutcomeDialogData {
  hearing: Hearing;
  courtId: string;
}

type OutcomeDecision = 'nextDate' | 'sineDie' | 'disposed';

function minLengthTrimmed(min: number): ValidatorFn {
  return (control): ValidationErrors | null =>
    (control.value ?? '').trim().length < min ? { minlength: { requiredLength: min } } : null;
}

/**
 * Hearing-outcome dialog (PRD Module 5 UI Components): transpired summary,
 * next-date picker aware of court holidays, order metadata, adjournment
 * reason, and a one-click "create compliance task" toggle. Exactly one of
 * {next date | sine die | disposed} must be chosen, mirroring
 * `RecordHearingOutcomeCommandValidator` and the DB's BR-6 deferred
 * constraint (AC-CC1/AC-CC3).
 */
@Component({
  selector: 'lf-hearing-outcome-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatRadioModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title i18n="@@matters.hearingOutcomeDialog.title">Record hearing outcome</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="outcome-form">
        <mat-form-field appearance="outline" class="outcome-form__wide">
          <mat-label i18n="@@matters.hearingOutcomeDialog.summaryLabel">What transpired</mat-label>
          <textarea matInput formControlName="summary" rows="3"></textarea>
          @if (form.controls.summary.hasError('minlength') && form.controls.summary.touched) {
            <mat-error i18n="@@matters.hearingOutcomeDialog.summaryMinLengthError"
              >At least 10 characters.</mat-error
            >
          }
        </mat-form-field>

        <mat-radio-group [formControl]="decisionControl" class="outcome-form__decision">
          <mat-radio-button value="nextDate" i18n="@@matters.hearingOutcomeDialog.nextDateOption"
            >Next hearing date</mat-radio-button
          >
          <mat-radio-button value="sineDie" i18n="@@matters.hearingOutcomeDialog.sineDieOption"
            >Adjourned sine die</mat-radio-button
          >
          <mat-radio-button value="disposed" i18n="@@matters.hearingOutcomeDialog.disposedOption"
            >Disposed</mat-radio-button
          >
        </mat-radio-group>

        @if (decisionControl.value === 'nextDate') {
          <mat-form-field appearance="outline">
            <mat-label i18n="@@matters.hearingOutcomeDialog.nextDateLabel"
              >Next hearing date</mat-label
            >
            <input
              matInput
              [matDatepicker]="nextDatePicker"
              [formControl]="nextDateControl"
              [matDatepickerFilter]="isNotPastFilter"
            />
            <mat-datepicker-toggle matIconSuffix [for]="nextDatePicker" />
            <mat-datepicker #nextDatePicker [dateClass]="holidayDateClass" />
          </mat-form-field>

          @if (selectedDateIsHoliday()) {
            <p
              class="outcome-form__warning"
              role="alert"
              i18n="@@matters.hearingOutcomeDialog.holidayWarning"
            >
              {{ selectedHolidayName() }} falls on a court holiday. Nearest working day:
              {{ nearestWorkingDayLabel() }}.
            </p>
          }

          <mat-form-field appearance="outline">
            <mat-label i18n="@@matters.hearingOutcomeDialog.purposeLabel">Purpose</mat-label>
            <input matInput formControlName="nextPurpose" />
          </mat-form-field>
        }

        <mat-form-field appearance="outline" class="outcome-form__wide">
          <mat-label i18n="@@matters.hearingOutcomeDialog.adjournReasonLabel"
            >Adjournment reason (optional)</mat-label
          >
          <input matInput formControlName="adjournReason" />
        </mat-form-field>

        <mat-checkbox
          [formControl]="createComplianceTaskControl"
          i18n="@@matters.hearingOutcomeDialog.complianceTaskCheckbox"
        >
          Create a compliance task from this outcome
        </mat-checkbox>

        @if (errorMessage()) {
          <p class="outcome-form__error" role="alert">{{ errorMessage() }}</p>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-button
        type="button"
        [mat-dialog-close]="undefined"
        i18n="@@matters.hearingOutcomeDialog.cancelButton"
      >
        Cancel
      </button>
      <button
        mat-flat-button
        color="primary"
        type="button"
        [disabled]="submitting() || !canSubmit()"
        (click)="submit()"
      >
        @if (submitting()) {
          <mat-spinner diameter="20" />
        } @else {
          <span i18n="@@matters.hearingOutcomeDialog.saveButton">Save outcome</span>
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .outcome-form {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-1);
      min-width: 420px;
    }

    .outcome-form__wide {
      width: 100%;
    }

    .outcome-form__decision {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-1);
      padding: var(--lf-space-1) 0;
    }

    .outcome-form__warning {
      margin: 0;
      color: var(--lf-warn);
      font-size: var(--lf-text-sm);
    }

    .outcome-form__error {
      margin: 0;
      color: var(--lf-error);
      font-size: var(--lf-text-sm);
    }
  `,
})
export class HearingOutcomeDialogComponent {
  private readonly hearingsService = inject(HearingsService);
  private readonly courtLookupsService = inject(CourtLookupsService);
  private readonly dialogRef =
    inject<MatDialogRef<HearingOutcomeDialogComponent, RecordHearingOutcomeResult | undefined>>(
      MatDialogRef,
    );
  readonly data = inject<HearingOutcomeDialogData>(MAT_DIALOG_DATA);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly holidays = signal<CourtHoliday[]>([]);

  readonly decisionControl = new FormControl<OutcomeDecision>('nextDate', { nonNullable: true });
  readonly nextDateControl = new FormControl<Date | null>(null);
  readonly createComplianceTaskControl = new FormControl(false, { nonNullable: true });

  readonly form = new FormGroup({
    summary: new FormControl('', { nonNullable: true, validators: [minLengthTrimmed(10)] }),
    nextPurpose: new FormControl(''),
    adjournReason: new FormControl(''),
  });

  private readonly holidayDates = computed(
    () => new Set(this.holidays().map((holiday) => holiday.holidayDate)),
  );

  readonly selectedDateIsHoliday = computed(() => {
    const date = this.nextDateControl.value;
    return !!date && this.holidayDates().has(toIsoDate(date));
  });

  readonly selectedHolidayName = computed(() => {
    const date = this.nextDateControl.value;
    if (!date) return '';
    const iso = toIsoDate(date);
    return this.holidays().find((holiday) => holiday.holidayDate === iso)?.name ?? 'This date';
  });

  readonly nearestWorkingDayLabel = computed(() => {
    const date = this.nextDateControl.value;
    if (!date) return '';
    const nearest = nearestWorkingDay(date, this.holidayDates());
    return nearest.toLocaleDateString();
  });

  readonly isNotPastFilter = (date: Date | null): boolean => {
    if (!date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date.getTime() >= today.getTime();
  };

  readonly holidayDateClass = (date: Date): string => {
    return this.holidayDates().has(toIsoDate(date)) ? 'hearing-outcome-holiday' : '';
  };

  constructor() {
    const year = new Date().getFullYear();
    this.courtLookupsService.holidays(this.data.courtId, year).subscribe((holidays) => {
      this.holidays.set(holidays);
    });
  }

  canSubmit(): boolean {
    if (this.form.invalid) {
      return false;
    }
    return this.decisionControl.value !== 'nextDate' || !!this.nextDateControl.value;
  }

  submit(): void {
    if (!this.canSubmit()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    const value = this.form.getRawValue();
    const decision = this.decisionControl.value;

    this.hearingsService
      .recordOutcome(this.data.hearing.id, {
        summary: value.summary,
        adjournReason: value.adjournReason || null,
        nextHearing:
          decision === 'nextDate' && this.nextDateControl.value
            ? { date: toIsoDate(this.nextDateControl.value), purpose: value.nextPurpose || null }
            : null,
        sineDie: decision === 'sineDie',
        disposed: decision === 'disposed',
        createComplianceTask: this.createComplianceTaskControl.value,
      })
      .subscribe({
        next: (result) => {
          this.submitting.set(false);
          this.dialogRef.close(result);
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
    if (envelope?.error?.code === 'OUTCOME_DECISION_REQUIRED') {
      return 'Choose exactly one of next hearing date, sine die, or disposed.';
    }
    return envelope?.error?.message ?? 'Something went wrong. Please try again.';
  }
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function nearestWorkingDay(date: Date, holidayDates: Set<string>): Date {
  const candidate = new Date(date);
  for (let i = 0; i < 30; i++) {
    candidate.setDate(candidate.getDate() + 1);
    if (!holidayDates.has(toIsoDate(candidate))) {
      return candidate;
    }
  }
  return candidate;
}
