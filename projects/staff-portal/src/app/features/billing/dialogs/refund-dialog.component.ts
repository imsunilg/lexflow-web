import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ConfirmDialogComponent, LfCurrencyPipe, Payment, PaymentsService, Refund } from 'shared';

export interface RefundDialogData {
  payment: Payment;
}

/**
 * Not wired into any page in this pass — the Client Statement page (built in
 * parallel) will open this for its payment rows. Refunds are the same class
 * of irreversible financial action as voiding an invoice (PRD §12), so this
 * requires the same typed-confirmation `ConfirmDialogComponent` step before
 * calling the API.
 */
@Component({
  selector: 'lf-refund-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    LfCurrencyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './refund-dialog.component.html',
  styleUrl: './refund-dialog.component.scss',
})
export class RefundDialogComponent {
  readonly data = inject<RefundDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<RefundDialogComponent>);
  private readonly paymentsService = inject(PaymentsService);
  private readonly dialog = inject(MatDialog);

  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = new FormGroup({
    amount: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.min(0.01), Validators.max(this.data.payment.amount)],
    }),
    reason: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    if (value.amount > this.data.payment.amount) {
      this.errorMessage.set('Refund amount cannot exceed the original payment amount.');
      return;
    }

    const confirmationText = this.data.payment.receiptNumber ?? this.data.payment.id;

    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Refund payment',
          message: `Refund ${value.amount} against payment ${confirmationText}? This is irreversible.`,
          destructive: true,
          confirmLabel: 'Refund',
          typedConfirmationText: confirmationText,
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.issueRefund(value.amount, value.reason);
      });
  }

  private issueRefund(amount: number, reason: string): void {
    this.saving.set(true);
    this.errorMessage.set(null);

    this.paymentsService
      .createRefund({
        paymentId: this.data.payment.id,
        amount,
        reason,
      })
      .subscribe({
        next: (refund: Refund) => {
          this.saving.set(false);
          this.dialogRef.close(refund);
        },
        error: () => {
          this.saving.set(false);
          this.errorMessage.set('Something went wrong issuing the refund. Please try again.');
        },
      });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
