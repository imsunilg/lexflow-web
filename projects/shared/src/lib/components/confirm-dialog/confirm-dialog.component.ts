import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive actions require typed confirmation per PRD §12 (e.g. void invoice). */
  destructive?: boolean;
  /** Required literal text the user must type to enable confirm, when `destructive` is set. */
  typedConfirmationText?: string;
}

/** Generic confirm dialog, opened via `MatDialog.open(ConfirmDialogComponent, { data })`. */
@Component({
  selector: 'lf-confirm-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
      @if (data.destructive && data.typedConfirmationText) {
        <p class="lf-confirm-dialog__hint">
          Type "<strong>{{ data.typedConfirmationText }}</strong
          >" to confirm.
        </p>
        <input
          class="lf-confirm-dialog__input"
          type="text"
          [attr.aria-label]="'Type ' + data.typedConfirmationText + ' to confirm'"
          (input)="typedValue = $any($event.target).value"
        />
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="false">
        {{ data.cancelLabel ?? 'Cancel' }}
      </button>
      <button
        mat-flat-button
        type="button"
        [color]="data.destructive ? 'warn' : 'primary'"
        [disabled]="!canConfirm()"
        [mat-dialog-close]="true"
      >
        {{ data.confirmLabel ?? 'Confirm' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .lf-confirm-dialog__hint {
      color: var(--lf-on-surface-variant);
      font-size: var(--lf-text-sm);
    }

    .lf-confirm-dialog__input {
      width: 100%;
      padding: 8px;
      border-radius: var(--lf-radius);
      border: 1px solid var(--lf-outline);
    }
  `,
})
export class ConfirmDialogComponent {
  readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ConfirmDialogComponent>);

  typedValue = '';

  canConfirm(): boolean {
    if (!this.data.destructive || !this.data.typedConfirmationText) {
      return true;
    }

    return this.typedValue === this.data.typedConfirmationText;
  }
}
