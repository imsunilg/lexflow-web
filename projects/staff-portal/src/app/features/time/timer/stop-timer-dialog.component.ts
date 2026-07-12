import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ROUNDING_INCREMENT_MINUTES, StopTimerRequest } from 'shared';

export interface StopTimerDialogData {
  elapsedSeconds: number;
}

/**
 * "Stop→entry dialog (duration editable, rounded per firm rule: up to
 * nearest 6 min default; narrative required for billable)" — PRD Module 9
 * User Flow 1. The server, not this dialog, computes the authoritative
 * elapsed duration and rounding (see `StopTimerRequest`'s doc comment) — the
 * "rounding preview" here is a client-side mirror of that same 6-minute
 * increment against the locally-ticked elapsed time, purely so the user
 * isn't surprised by the value the server returns; it is not submitted.
 */
@Component({
  selector: 'lf-stop-timer-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title i18n="@@time.stopTimerDialog.title">Stop timer</h2>
    <mat-dialog-content>
      <p class="stop-timer__elapsed" i18n="@@time.stopTimerDialog.elapsed">
        Elapsed: <strong>{{ elapsedLabel() }}</strong>
      </p>
      <p class="stop-timer__rounding" i18n="@@time.stopTimerDialog.roundingNote">
        Rounds up to <strong>{{ roundedMinutes() }} min</strong> ({{
          ROUNDING_INCREMENT_MINUTES
        }}-min increment — the server computes the final value from its own clock).
      </p>

      <form [formGroup]="form" class="stop-timer__form">
        <mat-slide-toggle formControlName="billable" i18n="@@time.stopTimerDialog.billableToggle">
          Billable
        </mat-slide-toggle>

        <mat-form-field appearance="outline">
          <mat-label i18n="@@time.stopTimerDialog.narrativeLabel">
            Narrative{{ form.controls.billable.value ? ' (required)' : '' }}
          </mat-label>
          <textarea matInput formControlName="narrative" rows="3"></textarea>
          @if (form.controls.narrative.invalid && form.controls.narrative.touched) {
            <mat-error i18n="@@time.stopTimerDialog.narrativeError">
              5–2000 characters required for billable time.
            </mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label i18n="@@time.stopTimerDialog.internalNoteLabel">
            Internal note (never leaves the firm)
          </mat-label>
          <textarea matInput formControlName="internalNote" rows="2"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-button
        type="button"
        [mat-dialog-close]="undefined"
        i18n="@@time.stopTimerDialog.cancelButton"
      >
        Cancel
      </button>
      <button
        mat-flat-button
        color="primary"
        type="button"
        [disabled]="form.invalid"
        (click)="submit()"
        i18n="@@time.stopTimerDialog.stopSaveButton"
      >
        Stop &amp; save
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .stop-timer__elapsed,
    .stop-timer__rounding {
      margin: 0 0 var(--lf-space-1);
    }

    .stop-timer__rounding {
      color: var(--lf-on-surface-variant);
      font-size: var(--lf-text-sm);
    }

    .stop-timer__form {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-1);
      min-width: 360px;
    }
  `,
})
export class StopTimerDialogComponent {
  private readonly dialogRef =
    inject<MatDialogRef<StopTimerDialogComponent, StopTimerRequest | undefined>>(MatDialogRef);
  readonly data = inject<StopTimerDialogData>(MAT_DIALOG_DATA);

  readonly ROUNDING_INCREMENT_MINUTES = ROUNDING_INCREMENT_MINUTES;

  readonly form = new FormGroup({
    billable: new FormControl(true, { nonNullable: true }),
    narrative: new FormControl('', { nonNullable: true }),
    internalNote: new FormControl('', { nonNullable: true }),
  });

  readonly elapsedLabel = computed(() => {
    const totalSeconds = this.data.elapsedSeconds;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  });

  readonly roundedMinutes = computed(() => {
    const minutes = this.data.elapsedSeconds / 60;
    return Math.ceil(minutes / ROUNDING_INCREMENT_MINUTES) * ROUNDING_INCREMENT_MINUTES;
  });

  constructor() {
    const applyNarrativeValidators = (billable: boolean) => {
      const narrative = this.form.controls.narrative;
      narrative.setValidators(
        billable ? [Validators.required, Validators.minLength(5), Validators.maxLength(2000)] : [],
      );
      narrative.updateValueAndValidity();
    };
    this.form.controls.billable.valueChanges.subscribe(applyNarrativeValidators);
    applyNarrativeValidators(this.form.controls.billable.value);
  }

  submit(): void {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const request: StopTimerRequest = {
      billable: value.billable,
      narrative: value.narrative || null,
      internalNote: value.internalNote || null,
    };
    this.dialogRef.close(request);
  }
}
