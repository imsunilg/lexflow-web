import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { CalendarEditScope } from 'shared';

export interface RescheduleScopeDialogData {
  title: string;
}

/** AC-CAL3: editing/moving "this occurrence only" leaves the series intact. */
@Component({
  selector: 'lf-reschedule-scope-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Move recurring event</h2>
    <mat-dialog-content>
      <p>"{{ data.title }}" repeats. What would you like to reschedule?</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="undefined">Cancel</button>
      <button mat-stroked-button type="button" (click)="close('occurrence')">
        This occurrence only
      </button>
      <button mat-flat-button color="primary" type="button" (click)="close('series')">
        Entire series
      </button>
    </mat-dialog-actions>
  `,
})
export class RescheduleScopeDialogComponent {
  private readonly dialogRef =
    inject<MatDialogRef<RescheduleScopeDialogComponent, CalendarEditScope | undefined>>(
      MatDialogRef,
    );
  readonly data = inject<RescheduleScopeDialogData>(MAT_DIALOG_DATA);

  close(scope: CalendarEditScope): void {
    this.dialogRef.close(scope);
  }
}
