import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { Court, CourtCase, CourtLookupsService, MattersService } from 'shared';

export interface CreateCaseDialogData {
  matterId: string;
}

/** "attach/create Court Case records (Module 5)" (PRD Module 4 User Flow step 2). */
@Component({
  selector: 'lf-create-case-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Add court case</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="create-case-form">
        @if (courts().length > 0) {
          <mat-form-field appearance="outline">
            <mat-label>Court</mat-label>
            <mat-select formControlName="courtId">
              @for (court of courts(); track court.id) {
                <mat-option [value]="court.id">{{ court.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        } @else {
          <mat-form-field appearance="outline">
            <mat-label>Court ID</mat-label>
            <input matInput formControlName="courtId" />
          </mat-form-field>
        }

        <mat-form-field appearance="outline">
          <mat-label>Case type</mat-label>
          <input matInput formControlName="caseType" placeholder="e.g. CS, WP, CRL.A" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Case number</mat-label>
          <input matInput formControlName="caseNumber" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Year</mat-label>
          <input matInput type="number" formControlName="caseYear" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Filing date</mat-label>
          <input matInput [matDatepicker]="filingPicker" [formControl]="filingDateControl" />
          <mat-datepicker-toggle matIconSuffix [for]="filingPicker" />
          <mat-datepicker #filingPicker />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Courtroom</mat-label>
          <input matInput formControlName="courtroom" />
        </mat-form-field>

        @if (errorMessage()) {
          <p class="create-case-form__error" role="alert">{{ errorMessage() }}</p>
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
          Add case
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .create-case-form {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0 var(--lf-space-2);
      min-width: 440px;
    }

    .create-case-form__error {
      grid-column: 1 / -1;
      color: var(--lf-error);
      font-size: var(--lf-text-sm);
    }
  `,
})
export class CreateCaseDialogComponent {
  private readonly mattersService = inject(MattersService);
  private readonly courtLookupsService = inject(CourtLookupsService);
  private readonly dialogRef =
    inject<MatDialogRef<CreateCaseDialogComponent, CourtCase | undefined>>(MatDialogRef);
  readonly data = inject<CreateCaseDialogData>(MAT_DIALOG_DATA);

  readonly courts = signal<Court[]>([]);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly filingDateControl = new FormControl<Date | null>(null);

  readonly form = new FormGroup({
    courtId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    caseType: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    caseNumber: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    caseYear: new FormControl(new Date().getFullYear(), { nonNullable: true }),
    courtroom: new FormControl(''),
  });

  constructor() {
    this.courtLookupsService.courts().subscribe((courts) => this.courts.set(courts));
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    const value = this.form.getRawValue();

    this.mattersService
      .createCase(this.data.matterId, {
        courtId: value.courtId,
        caseType: value.caseType,
        caseNumber: value.caseNumber,
        caseYear: value.caseYear,
        courtroom: value.courtroom || null,
        filingDate: this.filingDateControl.value
          ? this.filingDateControl.value.toISOString().slice(0, 10)
          : null,
      })
      .subscribe({
        next: (courtCase) => {
          this.saving.set(false);
          this.dialogRef.close(courtCase);
        },
        error: () => {
          this.saving.set(false);
          this.errorMessage.set('Something went wrong. Please try again.');
        },
      });
  }
}
