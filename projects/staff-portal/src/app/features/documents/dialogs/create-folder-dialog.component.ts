import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { CreateFolderRequest, Folder, FoldersService } from 'shared';

export interface CreateFolderDialogData {
  parentId: string | null;
  matterId?: string | null;
}

/** PRD Module 7 User Flow 1: "user folders/subfolders (depth ≤ 10)" — depth is enforced server-side. */
@Component({
  selector: 'lf-create-folder-dialog',
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
    <h2 mat-dialog-title i18n="@@documents.createFolderDialog.title">New folder</h2>
    <mat-dialog-content>
      <form [formGroup]="form">
        <mat-form-field appearance="outline" style="width: 100%">
          <mat-label i18n="@@documents.createFolderDialog.nameLabel">Folder name</mat-label>
          <input matInput formControlName="name" />
        </mat-form-field>
        @if (errorMessage) {
          <p style="color: var(--lf-error)">{{ errorMessage }}</p>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-button
        type="button"
        [mat-dialog-close]="undefined"
        i18n="@@documents.createFolderDialog.cancelButton"
      >
        Cancel
      </button>
      <button
        mat-flat-button
        color="primary"
        type="button"
        [disabled]="form.invalid"
        (click)="submit()"
        i18n="@@documents.createFolderDialog.createButton"
      >
        Create
      </button>
    </mat-dialog-actions>
  `,
})
export class CreateFolderDialogComponent {
  private readonly foldersService = inject(FoldersService);
  private readonly dialogRef =
    inject<MatDialogRef<CreateFolderDialogComponent, Folder | undefined>>(MatDialogRef);
  readonly data = inject<CreateFolderDialogData>(MAT_DIALOG_DATA);

  errorMessage: string | null = null;

  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  submit(): void {
    if (this.form.invalid) return;
    const request: CreateFolderRequest = {
      name: this.form.getRawValue().name,
      parentId: this.data.parentId,
      matterId: this.data.matterId,
    };
    this.foldersService.create(request).subscribe({
      next: (folder) => this.dialogRef.close(folder),
      error: () => (this.errorMessage = 'Something went wrong. Please try again.'),
    });
  }
}
