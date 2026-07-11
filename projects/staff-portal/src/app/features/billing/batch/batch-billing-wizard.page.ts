import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatStepperModule } from '@angular/material/stepper';
import { RouterLink } from '@angular/router';
import { BatchInvoiceRequest, Invoice, InvoicesService, LfCurrencyPipe } from 'shared';

/**
 * PRD Module 8 UI Components: "batch-billing wizard". AC-B1: batch billing
 * 200 matters must generate drafts in ≤ 60 s — the review step shows a
 * loading spinner (not a skeleton) for the duration of that call since it's
 * a long-running job, not a page load.
 */
@Component({
  selector: 'lf-batch-billing-wizard-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatStepperModule,
    RouterLink,
    LfCurrencyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './batch-billing-wizard.page.html',
  styleUrl: './batch-billing-wizard.page.scss',
})
export class BatchBillingWizardPage {
  private readonly invoicesService = inject(InvoicesService);

  readonly generating = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly createdInvoices = signal<Invoice[] | null>(null);

  readonly filterForm = new FormGroup({
    minWip: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(0)],
    }),
    branchId: new FormControl(''),
    matterTypeId: new FormControl(''),
  });
  readonly asOfControl = new FormControl<Date | null>(new Date(), {
    validators: [Validators.required],
  });

  readonly totalGenerated = signal(0);

  generate(): void {
    if (this.filterForm.invalid || this.asOfControl.invalid) {
      this.filterForm.markAllAsTouched();
      this.asOfControl.markAsTouched();
      return;
    }

    const value = this.filterForm.getRawValue();
    const request: BatchInvoiceRequest = {
      minWip: value.minWip!,
      branchId: value.branchId || null,
      matterTypeId: value.matterTypeId || null,
      asOf: this.asOfControl.value!.toISOString().slice(0, 10),
    };

    this.generating.set(true);
    this.errorMessage.set(null);
    this.createdInvoices.set(null);

    this.invoicesService.batch(request).subscribe({
      next: (invoices) => {
        this.generating.set(false);
        this.createdInvoices.set(invoices);
        this.totalGenerated.set(invoices.reduce((sum, invoice) => sum + invoice.grandTotal, 0));
      },
      error: () => {
        this.generating.set(false);
        this.errorMessage.set('Batch billing failed. Please check the filter and try again.');
      },
    });
  }

  asOfLabel(): string {
    const date = this.asOfControl.value;
    return date ? date.toISOString().slice(0, 10) : '';
  }
}
