import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CreditNote, Invoice, LfCurrencyPipe, PaymentsService } from 'shared';

export interface CreditNoteDialogData {
  invoice: Invoice;
}

/** PRD Module 8 UI Components: credit note issuance against an invoice's row action. */
@Component({
  selector: 'lf-credit-note-dialog',
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
  templateUrl: './credit-note-dialog.component.html',
  styleUrl: './credit-note-dialog.component.scss',
})
export class CreditNoteDialogComponent {
  readonly data = inject<CreditNoteDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<CreditNoteDialogComponent>);
  private readonly paymentsService = inject(PaymentsService);

  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = new FormGroup({
    amount: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.min(0.01), Validators.max(this.data.invoice.grandTotal)],
    }),
    reason: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    if (value.amount > this.data.invoice.grandTotal) {
      this.errorMessage.set('Credit note amount cannot exceed the invoice grand total.');
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    this.paymentsService
      .createCreditNote({
        invoiceId: this.data.invoice.id,
        amount: value.amount,
        reason: value.reason,
      })
      .subscribe({
        next: (creditNote: CreditNote) => {
          this.saving.set(false);
          this.dialogRef.close(creditNote);
        },
        error: () => {
          this.saving.set(false);
          this.errorMessage.set('Something went wrong issuing the credit note. Please try again.');
        },
      });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
