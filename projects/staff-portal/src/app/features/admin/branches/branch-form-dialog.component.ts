import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { BranchDto, BranchesService, UpsertBranchRequest } from 'shared';

export interface BranchFormDialogData {
  branch?: BranchDto;
}

/** Best-effort parse of the opaque `addressJson` blob into a single free-text block for editing. */
function addressJsonToText(addressJson: string | null): string {
  if (!addressJson) return '';
  try {
    const parsed = JSON.parse(addressJson);
    if (typeof parsed === 'string') return parsed;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return addressJson;
  }
}

/**
 * Create/edit dialog for `BranchesController` (PRD Module 14). There's no
 * holiday-calendar sub-resource on branches — Module 15 covers holidays
 * separately at the settings-blob level, so it's not built here.
 * `addressJson` is opaque on the backend, so this deliberately uses a single
 * free-text "address" textarea rather than a structured address form: the
 * text is JSON.stringify'd on submit and best-effort JSON.parse'd (falling
 * back to the raw string) when editing.
 */
@Component({
  selector: 'lf-branch-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ isEdit ? 'Edit branch' : 'New branch' }}</h2>

    <mat-dialog-content class="branch-form">
      <mat-form-field appearance="outline">
        <mat-label>Name</mat-label>
        <input matInput [formControl]="name" required />
        @if (name.invalid && name.touched) {
          <mat-error>Name is required.</mat-error>
        }
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Code</mat-label>
        <input matInput [formControl]="code" required />
        @if (code.invalid && code.touched) {
          <mat-error>Code is required.</mat-error>
        }
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Timezone</mat-label>
        <input matInput [formControl]="tz" required placeholder="e.g. Asia/Kolkata" />
        @if (tz.invalid && tz.touched) {
          <mat-error>Timezone is required.</mat-error>
        }
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>GSTIN</mat-label>
        <input matInput [formControl]="gstin" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Series prefix</mat-label>
        <input matInput [formControl]="seriesPrefix" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Address</mat-label>
        <textarea matInput [formControl]="address" rows="3"></textarea>
      </mat-form-field>

      @if (error) {
        <p class="branch-form__error">{{ error }}</p>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="cancel()">Cancel</button>
      <button
        mat-flat-button
        color="primary"
        type="button"
        [disabled]="submitting"
        (click)="submit()"
      >
        {{ isEdit ? 'Save' : 'Create branch' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .branch-form {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-1);
      min-width: 420px;
    }

    .branch-form__error {
      color: var(--lf-error);
      font-size: var(--lf-text-sm);
      margin: 0;
    }
  `,
})
export class BranchFormDialogComponent {
  private readonly dialogRef =
    inject<MatDialogRef<BranchFormDialogComponent, BranchDto | undefined>>(MatDialogRef);
  private readonly branchesService = inject(BranchesService);
  readonly data = inject<BranchFormDialogData>(MAT_DIALOG_DATA);

  readonly isEdit = !!this.data.branch;

  readonly name = new FormControl(this.data.branch?.name ?? '', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(200)],
  });
  readonly code = new FormControl(this.data.branch?.code ?? '', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(50)],
  });
  readonly tz = new FormControl(this.data.branch?.tz ?? '', {
    nonNullable: true,
    validators: [Validators.required],
  });
  readonly gstin = new FormControl(this.data.branch?.gstin ?? '', { nonNullable: true });
  readonly seriesPrefix = new FormControl(this.data.branch?.seriesPrefix ?? '', {
    nonNullable: true,
  });
  readonly address = new FormControl(addressJsonToText(this.data.branch?.addressJson ?? null), {
    nonNullable: true,
  });

  submitting = false;
  error: string | null = null;

  cancel(): void {
    this.dialogRef.close(undefined);
  }

  submit(): void {
    this.name.markAsTouched();
    this.code.markAsTouched();
    this.tz.markAsTouched();
    if (this.name.invalid || this.code.invalid || this.tz.invalid) return;

    const addressText = this.address.value.trim();
    const request: UpsertBranchRequest = {
      name: this.name.value,
      code: this.code.value,
      tz: this.tz.value,
      gstin: this.gstin.value.trim() || null,
      seriesPrefix: this.seriesPrefix.value.trim() || null,
      addressJson: addressText ? JSON.stringify(addressText) : null,
    };

    this.submitting = true;
    this.error = null;
    const request$ = this.data.branch
      ? this.branchesService.update(this.data.branch.id, request)
      : this.branchesService.create(request);

    request$.subscribe({
      next: (branch) => this.dialogRef.close(branch),
      error: () => {
        this.submitting = false;
        this.error = `Could not ${this.isEdit ? 'update' : 'create'} the branch — please try again.`;
      },
    });
  }
}
