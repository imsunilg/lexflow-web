import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { DepartmentDto, DepartmentsService, UpsertDepartmentRequest, UserSummary } from 'shared';

export interface DepartmentFormDialogData {
  department?: DepartmentDto;
  users: UserSummary[];
}

/**
 * Create/edit dialog for `DepartmentsController` (PRD Module 14). Departments
 * are flat here — a single `headUserId`, no reporting-manager chain or parent
 * department, since the backend doesn't model one. Closes with the resulting
 * `DepartmentDto` (or `undefined` on cancel) so the list page can reload.
 */
@Component({
  selector: 'lf-department-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ isEdit ? 'Edit department' : 'New department' }}</h2>

    <mat-dialog-content class="department-form">
      <mat-form-field appearance="outline">
        <mat-label>Name</mat-label>
        <input matInput [formControl]="name" required />
        @if (name.invalid && name.touched) {
          <mat-error>Name is required.</mat-error>
        }
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Code</mat-label>
        <input matInput [formControl]="code" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Head</mat-label>
        <mat-select [formControl]="headUserId">
          <mat-option [value]="null">None</mat-option>
          @for (user of users; track user.id) {
            <mat-option [value]="user.id">{{ user.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      @if (error) {
        <p class="department-form__error">{{ error }}</p>
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
        {{ isEdit ? 'Save' : 'Create department' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .department-form {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-1);
      min-width: 420px;
    }

    .department-form__error {
      color: var(--lf-error);
      font-size: var(--lf-text-sm);
      margin: 0;
    }
  `,
})
export class DepartmentFormDialogComponent {
  private readonly dialogRef =
    inject<MatDialogRef<DepartmentFormDialogComponent, DepartmentDto | undefined>>(MatDialogRef);
  private readonly departmentsService = inject(DepartmentsService);
  readonly data = inject<DepartmentFormDialogData>(MAT_DIALOG_DATA);

  readonly isEdit = !!this.data.department;
  readonly users = this.data.users;

  readonly name = new FormControl(this.data.department?.name ?? '', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(200)],
  });
  readonly code = new FormControl(this.data.department?.code ?? '', { nonNullable: true });
  readonly headUserId = new FormControl<string | null>(this.data.department?.headUserId ?? null);

  submitting = false;
  error: string | null = null;

  cancel(): void {
    this.dialogRef.close(undefined);
  }

  submit(): void {
    this.name.markAsTouched();
    if (this.name.invalid) return;

    const request: UpsertDepartmentRequest = {
      name: this.name.value,
      code: this.code.value.trim() || null,
      headUserId: this.headUserId.value,
    };

    this.submitting = true;
    this.error = null;
    const request$ = this.data.department
      ? this.departmentsService.update(this.data.department.id, request)
      : this.departmentsService.create(request);

    request$.subscribe({
      next: (department) => this.dialogRef.close(department),
      error: () => {
        this.submitting = false;
        this.error = `Could not ${this.isEdit ? 'update' : 'create'} the department — please try again.`;
      },
    });
  }
}
