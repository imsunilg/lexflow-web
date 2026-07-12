import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { Lead, LeadLookupsService, LeadsService, LostReason } from 'shared';

export interface LostReasonDialogData {
  lead: Lead;
}

/** Lost-reason dialog (PRD Module 2: "mark Lost (mandatory lost-reason from configurable list + free text)", AC-L6). */
@Component({
  selector: 'lf-lost-reason-dialog',
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
    <h2 mat-dialog-title i18n="@@leads.lostReasonDialog.title">Mark lead as lost</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="lost-reason-form">
        <mat-form-field appearance="outline">
          <mat-label i18n="@@leads.lostReasonDialog.reasonLabel">Reason</mat-label>
          <mat-select formControlName="reasonId">
            @for (reason of reasons(); track reason.id) {
              <mat-option [value]="reason.id">{{ reason.name }}</mat-option>
            }
          </mat-select>
          @if (form.controls.reasonId.hasError('required') && form.controls.reasonId.touched) {
            <mat-error i18n="@@leads.lostReasonDialog.reasonRequiredError"
              >A reason is required.</mat-error
            >
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label i18n="@@leads.lostReasonDialog.notesLabel">Notes (optional)</mat-label>
          <textarea matInput formControlName="note" rows="3"></textarea>
        </mat-form-field>

        @if (errorMessage()) {
          <p class="lost-reason-form__error" role="alert">{{ errorMessage() }}</p>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-button
        type="button"
        [mat-dialog-close]="undefined"
        i18n="@@leads.lostReasonDialog.cancelButton"
      >
        Cancel
      </button>
      <button
        mat-flat-button
        color="warn"
        type="button"
        [disabled]="form.invalid || saving()"
        (click)="submit()"
      >
        @if (saving()) {
          <mat-spinner diameter="20" />
        } @else {
          <span i18n="@@leads.lostReasonDialog.markLostButton">Mark lost</span>
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .lost-reason-form {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-1);
      min-width: 360px;
    }

    .lost-reason-form__error {
      margin: 0;
      color: var(--lf-error);
      font-size: var(--lf-text-sm);
    }
  `,
})
export class LostReasonDialogComponent {
  private readonly leadsService = inject(LeadsService);
  private readonly lookupsService = inject(LeadLookupsService);
  private readonly dialogRef =
    inject<MatDialogRef<LostReasonDialogComponent, boolean>>(MatDialogRef);
  readonly data = inject<LostReasonDialogData>(MAT_DIALOG_DATA);

  readonly reasons = signal<LostReason[]>([]);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = new FormGroup({
    reasonId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    note: new FormControl(''),
  });

  constructor() {
    this.lookupsService.lostReasons().subscribe((reasons) => this.reasons.set(reasons));
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    const value = this.form.getRawValue();

    this.leadsService
      .markLost(this.data.lead.id, { reasonId: value.reasonId, note: value.note || null })
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: () => {
          this.saving.set(false);
          this.errorMessage.set('Something went wrong. Please try again.');
        },
      });
  }
}
