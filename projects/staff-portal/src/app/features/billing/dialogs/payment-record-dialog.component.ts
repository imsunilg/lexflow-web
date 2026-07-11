import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import {
  Client,
  ClientsService,
  CreatePaymentRequest,
  Invoice,
  PAYMENT_MODES,
  Payment,
  PaymentAllocation,
  PaymentMode,
  PaymentsService,
} from 'shared';

export interface PaymentRecordDialogData {
  invoice?: Invoice;
}

interface AllocationRow {
  invoiceId: FormControl<string>;
  amount: FormControl<number>;
}

/**
 * PRD Module 8 UI Components: "payment-record dialog with allocation grid".
 * There is no "list open invoices for a client" endpoint, so allocation rows
 * take a free-text invoice id rather than a fake picker — the hint below the
 * grid says so.
 */
@Component({
  selector: 'lf-payment-record-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './payment-record-dialog.component.html',
  styleUrl: './payment-record-dialog.component.scss',
})
export class PaymentRecordDialogComponent {
  readonly data = inject<PaymentRecordDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<PaymentRecordDialogComponent>);
  private readonly clientsService = inject(ClientsService);
  private readonly paymentsService = inject(PaymentsService);

  readonly paymentModes = PAYMENT_MODES;
  readonly lockClient = !!this.data.invoice;
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly clientControl = new FormControl('', { nonNullable: true });
  readonly clientResults = signal<Client[]>([]);
  readonly selectedClientId = signal<string | null>(this.data.invoice?.clientId ?? null);

  readonly form = new FormGroup({
    amount: new FormControl(0, { nonNullable: true, validators: [Validators.min(0.01)] }),
    mode: new FormControl<PaymentMode>('Cash', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    gateway: new FormControl(''),
    gatewayRef: new FormControl(''),
    onAccount: new FormControl(false, { nonNullable: true }),
  });
  readonly receivedOnControl = new FormControl<Date | null>(new Date());

  readonly allocations = new FormArray<FormGroup<AllocationRow>>([]);

  constructor() {
    const invoice = this.data.invoice;
    if (invoice) {
      const outstanding = invoice.grandTotal - invoice.amountPaid;
      this.addAllocation(invoice.id, outstanding);
      this.form.patchValue({ amount: outstanding });
    } else {
      this.addAllocation();
    }

    this.clientControl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => {
        if (!q) {
          this.clientResults.set([]);
          return;
        }
        this.clientsService.list({ q }).subscribe((clients) => this.clientResults.set(clients));
      });
  }

  selectClient(client: Client): void {
    this.selectedClientId.set(client.id);
    this.clientControl.setValue(client.displayName ?? client.legalName ?? client.id, {
      emitEvent: false,
    });
    this.clientResults.set([]);
  }

  onClientSelected(event: MatAutocompleteSelectedEvent): void {
    const label = event.option.value as string;
    const client = this.clientResults().find(
      (c) => (c.displayName ?? c.legalName ?? c.id) === label,
    );
    if (client) this.selectClient(client);
  }

  addAllocation(invoiceId = '', amount = 0): void {
    this.allocations.push(
      new FormGroup({
        invoiceId: new FormControl(invoiceId, {
          nonNullable: true,
          validators: [Validators.required],
        }),
        amount: new FormControl(amount, { nonNullable: true, validators: [Validators.min(0.01)] }),
      }),
    );
  }

  removeAllocation(index: number): void {
    this.allocations.removeAt(index);
  }

  allocationTotal(): number {
    return this.allocations.controls.reduce((sum, row) => sum + (row.getRawValue().amount || 0), 0);
  }

  canSubmit(): boolean {
    if (this.saving()) return false;
    if (!this.selectedClientId()) return false;
    const value = this.form.getRawValue();
    if (value.amount <= 0) return false;
    if (this.allocations.length === 0) return false;
    if (!value.onAccount && value.amount > this.allocationTotal()) return false;
    return true;
  }

  submit(): void {
    const clientId = this.selectedClientId();
    if (!clientId) {
      this.errorMessage.set('Select a client.');
      return;
    }

    const value = this.form.getRawValue();
    if (!value.onAccount && value.amount > this.allocationTotal()) {
      this.errorMessage.set(
        'Payment amount exceeds the sum of allocations. Check "On account" to record the excess unallocated.',
      );
      return;
    }

    const allocations: PaymentAllocation[] = this.allocations.controls.map((row) => {
      const raw = row.getRawValue();
      return { invoiceId: raw.invoiceId, amount: raw.amount };
    });

    const request: CreatePaymentRequest = {
      clientId,
      amount: value.amount,
      mode: value.mode,
      gateway: value.gateway || null,
      gatewayRef: value.gatewayRef || null,
      receivedOn:
        this.receivedOnControl.value?.toISOString().slice(0, 10) ??
        new Date().toISOString().slice(0, 10),
      allocations,
      idempotencyKey: crypto.randomUUID(),
    };

    this.saving.set(true);
    this.errorMessage.set(null);

    this.paymentsService.create(request).subscribe({
      next: (payment: Payment) => {
        this.saving.set(false);
        this.dialogRef.close(payment);
      },
      error: () => {
        this.saving.set(false);
        this.errorMessage.set('Something went wrong recording the payment. Please try again.');
      },
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
