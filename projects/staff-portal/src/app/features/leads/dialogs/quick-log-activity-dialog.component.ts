import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { AddLeadActivityRequest, LeadActivity, LeadsService } from 'shared';

export type QuickLogActivityType = 'call' | 'meeting' | 'note';

export interface QuickLogActivityDialogData {
  leadId: string;
  activityType: QuickLogActivityType;
}

/** Quick-log call/note/meeting dialog (PRD Module 2 UI Components: "quick-log call/note dialogs" — a meeting variant is included alongside per the same pattern). One shared form whose visible fields switch on `activityType`. */
@Component({
  selector: 'lf-quick-log-activity-dialog',
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
    <h2 mat-dialog-title>{{ title() }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="quick-log-form">
        @switch (data.activityType) {
          @case ('call') {
            <mat-form-field appearance="outline">
              <mat-label>Direction</mat-label>
              <mat-select formControlName="direction">
                <mat-option value="Inbound">Inbound</mat-option>
                <mat-option value="Outbound">Outbound</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Duration (min)</mat-label>
              <input matInput type="number" formControlName="durationMin" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="quick-log-form__wide">
              <mat-label>Outcome</mat-label>
              <input
                matInput
                formControlName="outcome"
                placeholder="e.g. Connected, No answer, Voicemail"
              />
            </mat-form-field>

            <mat-form-field appearance="outline" class="quick-log-form__wide">
              <mat-label>Notes (optional)</mat-label>
              <textarea matInput formControlName="body" rows="3"></textarea>
            </mat-form-field>
          }
          @case ('meeting') {
            <mat-form-field appearance="outline" class="quick-log-form__wide">
              <mat-label>Subject</mat-label>
              <input matInput formControlName="subject" />
              @if (form.controls.subject.hasError('required') && form.controls.subject.touched) {
                <mat-error>Subject is required.</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Duration (min)</mat-label>
              <input matInput type="number" formControlName="durationMin" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="quick-log-form__wide">
              <mat-label>Notes (optional)</mat-label>
              <textarea matInput formControlName="body" rows="3"></textarea>
            </mat-form-field>
          }
          @case ('note') {
            <mat-form-field appearance="outline" class="quick-log-form__wide">
              <mat-label>Note</mat-label>
              <textarea matInput formControlName="body" rows="4"></textarea>
              @if (form.controls.body.hasError('required') && form.controls.body.touched) {
                <mat-error>Note content is required.</mat-error>
              }
            </mat-form-field>
          }
        }

        @if (errorMessage()) {
          <p class="quick-log-form__error" role="alert">{{ errorMessage() }}</p>
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
    .quick-log-form {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0 var(--lf-space-2);
      min-width: 420px;
    }

    .quick-log-form__wide {
      grid-column: 1 / -1;
    }

    .quick-log-form__error {
      grid-column: 1 / -1;
      margin: 0 0 var(--lf-space-1);
      color: var(--lf-error);
      font-size: var(--lf-text-sm);
    }
  `,
})
export class QuickLogActivityDialogComponent {
  private readonly leadsService = inject(LeadsService);
  private readonly dialogRef =
    inject<MatDialogRef<QuickLogActivityDialogComponent, LeadActivity>>(MatDialogRef);
  readonly data = inject<QuickLogActivityDialogData>(MAT_DIALOG_DATA);

  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly title = computed(() => {
    switch (this.data.activityType) {
      case 'call':
        return 'Log a call';
      case 'meeting':
        return 'Log a meeting';
      case 'note':
        return 'Add a note';
    }
  });

  readonly form = new FormGroup({
    direction: new FormControl<string | null>(null),
    durationMin: new FormControl<number | null>(null),
    outcome: new FormControl(''),
    subject: new FormControl(''),
    body: new FormControl(''),
  });

  constructor() {
    if (this.data.activityType === 'meeting') {
      this.form.controls.subject.addValidators(Validators.required);
    } else if (this.data.activityType === 'note') {
      this.form.controls.body.addValidators(Validators.required);
    }
    this.form.controls.subject.updateValueAndValidity();
    this.form.controls.body.updateValueAndValidity();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    const value = this.form.getRawValue();

    const request: AddLeadActivityRequest = {
      type: this.data.activityType,
      direction: this.data.activityType === 'call' ? value.direction || null : null,
      durationMin: this.data.activityType === 'note' ? null : value.durationMin,
      subject: this.data.activityType === 'meeting' ? value.subject || null : null,
      body: value.body || null,
      outcome: this.data.activityType === 'call' ? value.outcome || null : null,
    };

    this.leadsService.addActivity(this.data.leadId, request).subscribe({
      next: (activity) => this.dialogRef.close(activity),
      error: () => {
        this.saving.set(false);
        this.errorMessage.set('Something went wrong. Please try again.');
      },
    });
  }
}
