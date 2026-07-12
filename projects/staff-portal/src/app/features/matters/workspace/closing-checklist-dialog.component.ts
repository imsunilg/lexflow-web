import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import {
  ApiErrorEnvelope,
  LfCurrencyPipe,
  MATTER_OUTCOMES,
  Matter,
  MatterFinancialSummary,
  MatterOutcome,
  MattersService,
} from 'shared';

export interface ClosingChecklistDialogData {
  matter: Matter;
}

/**
 * Closing checklist dialog (PRD Module 4 User Flow step 5, AC-M3): "no
 * running timers, unbilled time decision (bill/write-off), trust balance
 * disposition, closure summary note." Only 2 of these 4 items are actually
 * enforced server-side today (`MatterService.ChangeStatusAsync` blocks on a
 * missing closure note and on running timers via 409 `TIMERS_RUNNING`) — the
 * unbilled-time and trust-balance items have no backend gate at all (no API
 * exists to even query running timers for a matter, or to record a
 * bill/write-off decision), so this dialog surfaces them as self-attested
 * checklist items informed by `financial-summary`, not as hard blocks the
 * server will itself refuse. That's a documented gap, not a bug: closing
 * still round-trips through the real `changeStatus` call and will correctly
 * fail with 409 if timers are in fact running.
 */
@Component({
  selector: 'lf-closing-checklist-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatRadioModule,
    MatSelectModule,
    LfCurrencyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title i18n="@@matters.closingChecklistDialog.title">Close matter — checklist</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="checklist">
        <mat-checkbox
          [formControl]="noRunningTimersControl"
          i18n="@@matters.closingChecklistDialog.noRunningTimersCheckbox"
        >
          No running timers remain on this matter
        </mat-checkbox>

        @if (summary(); as fin) {
          @if (fin.wip > 0) {
            <div class="checklist__item">
              <p i18n="@@matters.closingChecklistDialog.wipLabel">
                Unbilled time (WIP): <strong>{{ fin.wip | lfCurrency }}</strong>
              </p>
              <mat-radio-group [formControl]="wipDecisionControl">
                <mat-radio-button value="bill" i18n="@@matters.closingChecklistDialog.billOption"
                  >Bill this time</mat-radio-button
                >
                <mat-radio-button
                  value="writeOff"
                  i18n="@@matters.closingChecklistDialog.writeOffOption"
                  >Write it off</mat-radio-button
                >
              </mat-radio-group>
            </div>
          }

          @if (fin.trustBalance > 0) {
            <div class="checklist__item">
              <p i18n="@@matters.closingChecklistDialog.trustBalanceLabel">
                Trust balance: <strong>{{ fin.trustBalance | lfCurrency }}</strong>
              </p>
              <mat-checkbox
                [formControl]="trustDisposedControl"
                i18n="@@matters.closingChecklistDialog.trustDisposedCheckbox"
              >
                Trust funds have been disbursed/accounted for
              </mat-checkbox>
            </div>
          }
        }

        <mat-form-field appearance="outline">
          <mat-label i18n="@@matters.closingChecklistDialog.outcomeLabel">Outcome</mat-label>
          <mat-select formControlName="outcome">
            @for (outcome of outcomes; track outcome) {
              <mat-option [value]="outcome">{{ outcome }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label i18n="@@matters.closingChecklistDialog.closureNoteLabel"
            >Closure summary note</mat-label
          >
          <textarea matInput formControlName="closureNote" rows="3"></textarea>
          @if (
            form.controls.closureNote.hasError('required') && form.controls.closureNote.touched
          ) {
            <mat-error i18n="@@matters.closingChecklistDialog.closureNoteRequiredError"
              >A closure summary note is required.</mat-error
            >
          }
        </mat-form-field>

        @if (errorMessage()) {
          <p class="checklist__error" role="alert">{{ errorMessage() }}</p>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-button
        type="button"
        [mat-dialog-close]="undefined"
        i18n="@@matters.closingChecklistDialog.cancelButton"
      >
        Cancel
      </button>
      <button
        mat-flat-button
        color="warn"
        type="button"
        [disabled]="!canClose() || closing()"
        (click)="submit()"
      >
        @if (closing()) {
          <mat-spinner diameter="20" />
        } @else {
          <span i18n="@@matters.closingChecklistDialog.closeButton">Close matter</span>
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .checklist {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-2);
      min-width: 400px;
    }

    .checklist__item {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-1);
      padding: var(--lf-space-1);
      background: var(--lf-surface-variant);
      border-radius: 8px;
    }

    .checklist__item p {
      margin: 0;
    }

    .checklist__error {
      margin: 0;
      color: var(--lf-error);
      font-size: var(--lf-text-sm);
    }
  `,
})
export class ClosingChecklistDialogComponent {
  private readonly mattersService = inject(MattersService);
  private readonly dialogRef =
    inject<MatDialogRef<ClosingChecklistDialogComponent, Matter | undefined>>(MatDialogRef);
  readonly data = inject<ClosingChecklistDialogData>(MAT_DIALOG_DATA);

  readonly outcomes = MATTER_OUTCOMES;
  readonly summary = signal<MatterFinancialSummary | null>(null);
  readonly closing = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly noRunningTimersControl = new FormControl(false, { nonNullable: true });
  readonly wipDecisionControl = new FormControl<'bill' | 'writeOff' | null>(null);
  readonly trustDisposedControl = new FormControl(false, { nonNullable: true });

  readonly form = new FormGroup({
    outcome: new FormControl<MatterOutcome>('Won', { nonNullable: true }),
    closureNote: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  constructor() {
    this.mattersService.financialSummary(this.data.matter.id).subscribe({
      next: (summary) => this.summary.set(summary),
      error: () => undefined,
    });
  }

  canClose(): boolean {
    if (this.form.invalid || !this.noRunningTimersControl.value) {
      return false;
    }
    const fin = this.summary();
    if (fin && fin.wip > 0 && !this.wipDecisionControl.value) {
      return false;
    }
    if (fin && fin.trustBalance > 0 && !this.trustDisposedControl.value) {
      return false;
    }
    return true;
  }

  submit(): void {
    if (!this.canClose()) {
      this.form.markAllAsTouched();
      return;
    }

    this.closing.set(true);
    this.errorMessage.set(null);
    const value = this.form.getRawValue();

    this.mattersService
      .changeStatus(this.data.matter.id, {
        toStatus: 'Closed',
        outcome: value.outcome,
        closureNote: value.closureNote,
      })
      .subscribe({
        next: (matter) => {
          this.closing.set(false);
          this.dialogRef.close(matter);
        },
        error: (error: unknown) => {
          this.closing.set(false);
          this.errorMessage.set(this.messageFor(error));
        },
      });
  }

  private messageFor(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Something went wrong. Please try again.';
    }
    const envelope = error.error as Partial<ApiErrorEnvelope> | null;
    if (envelope?.error?.code === 'TIMERS_RUNNING') {
      return envelope.error.message || 'Running timers must be stopped before closing.';
    }
    return envelope?.error?.message ?? 'Something went wrong. Please try again.';
  }
}
