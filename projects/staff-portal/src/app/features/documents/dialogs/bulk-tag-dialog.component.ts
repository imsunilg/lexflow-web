import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

/** Comma-separated tag entry for the bulk "tag" action. */
@Component({
  selector: 'lf-bulk-tag-dialog',
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
    <h2 mat-dialog-title>Add tags</h2>
    <mat-dialog-content>
      <form [formGroup]="form">
        <mat-form-field appearance="outline" style="width: 100%">
          <mat-label>Tags (comma-separated)</mat-label>
          <input matInput formControlName="tags" placeholder="Evidence, Reviewed" />
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="undefined">Cancel</button>
      <button mat-flat-button color="primary" type="button" (click)="submit()">Apply</button>
    </mat-dialog-actions>
  `,
})
export class BulkTagDialogComponent {
  private readonly dialogRef =
    inject<MatDialogRef<BulkTagDialogComponent, string[] | undefined>>(MatDialogRef);

  readonly form = new FormGroup({
    tags: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  submit(): void {
    if (this.form.invalid) return;
    const tags = this.form
      .getRawValue()
      .tags.split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    this.dialogRef.close(tags);
  }
}
