import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import {
  Client,
  ClientsService,
  ConfirmDialogComponent,
  DunningService,
  EmptyStateComponent,
  Invoice,
  InvoicesService,
  LfCurrencyPipe,
} from 'shared';
import {
  CreditNoteDialogComponent,
  CreditNoteDialogData,
} from './dialogs/credit-note-dialog.component';
import {
  PaymentRecordDialogComponent,
  PaymentRecordDialogData,
} from './dialogs/payment-record-dialog.component';

/**
 * Billing hub (PRD Module 8 UI Components: "Billing hub (tabs: WIP | Draft
 * Invoices | Sent | Overdue | Payments | Credit Notes | Trust)"). An
 * "Approvals" tab is added too — the PRD's UI Components list separately
 * calls out an "approval inbox," and the only real way to build one is
 * `GET /invoices?status=Submitted` (no dedicated approval-inbox endpoint
 * exists). The WIP, Payments, and Credit Notes tabs are all documented gaps:
 * there is no unbilled-time/expense listing endpoint, no aggregate payments
 * list endpoint, and no aggregate credit-notes list endpoint — each shows an
 * honest empty state with the closest real workflow instead of fake data.
 */
@Component({
  selector: 'lf-billing-hub-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTabsModule,
    RouterLink,
    EmptyStateComponent,
    LfCurrencyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './billing-hub.page.html',
  styleUrl: './billing-hub.page.scss',
})
export class BillingHubPage {
  private readonly invoicesService = inject(InvoicesService);
  private readonly clientsService = inject(ClientsService);
  private readonly dunningService = inject(DunningService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  readonly draftInvoices = signal<Invoice[]>([]);
  readonly sentInvoices = signal<Invoice[]>([]);
  readonly overdueInvoices = signal<Invoice[]>([]);
  readonly submittedInvoices = signal<Invoice[]>([]);
  readonly loading = signal(true);

  readonly clientSearchControl = new FormControl('', { nonNullable: true });
  readonly clientResults = signal<Client[]>([]);

  constructor() {
    this.loadAll();

    this.clientSearchControl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => {
        if (!q) {
          this.clientResults.set([]);
          return;
        }
        this.clientsService.list({ q }).subscribe((clients) => this.clientResults.set(clients));
      });
  }

  loadAll(): void {
    this.loading.set(true);
    this.invoicesService
      .list({ status: 'Draft' })
      .subscribe((invoices) => this.draftInvoices.set(invoices));
    this.invoicesService
      .list({ status: 'Sent' })
      .subscribe((invoices) => this.sentInvoices.set(invoices));
    this.invoicesService
      .list({ overdueOnly: true })
      .subscribe((invoices) => this.overdueInvoices.set(invoices));
    this.invoicesService.list({ status: 'Submitted' }).subscribe({
      next: (invoices) => {
        this.submittedInvoices.set(invoices);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  newInvoice(): void {
    this.router.navigate(['/billing/invoices/new']);
  }

  openInvoice(invoice: Invoice): void {
    this.router.navigate(['/billing/invoices', invoice.id]);
  }

  openStatement(client: Client): void {
    this.router.navigate(['/billing/statement', client.id]);
  }

  openTrustLedger(client: Client): void {
    this.router.navigate(['/billing/trust', client.id]);
  }

  approve(invoice: Invoice): void {
    this.invoicesService.approve(invoice.id).subscribe(() => this.loadAll());
  }

  reject(invoice: Invoice): void {
    const reason = window.prompt('Reason for rejecting this invoice?');
    if (!reason) return;
    this.invoicesService.reject(invoice.id, reason).subscribe(() => this.loadAll());
  }

  submit(invoice: Invoice): void {
    this.invoicesService.submit(invoice.id).subscribe(() => this.loadAll());
  }

  voidInvoice(invoice: Invoice): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Void invoice',
          message: `Void invoice ${invoice.number ?? invoice.id}? This is irreversible — the number is never reused.`,
          destructive: true,
          confirmLabel: 'Void',
          typedConfirmationText: invoice.number ?? invoice.id,
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        const reason = window.prompt('Reason for voiding this invoice?') ?? '';
        this.invoicesService.void(invoice.id, reason).subscribe(() => this.loadAll());
      });
  }

  muteReminders(invoice: Invoice): void {
    this.dunningService.muteInvoice(invoice.id).subscribe();
  }

  recordPayment(invoice?: Invoice): void {
    this.dialog
      .open<PaymentRecordDialogComponent, PaymentRecordDialogData>(PaymentRecordDialogComponent, {
        data: { invoice },
      })
      .afterClosed()
      .subscribe((created) => {
        if (created) this.loadAll();
      });
  }

  createCreditNote(invoice: Invoice): void {
    this.dialog
      .open<CreditNoteDialogComponent, CreditNoteDialogData>(CreditNoteDialogComponent, {
        data: { invoice },
      })
      .afterClosed()
      .subscribe((created) => {
        if (created) this.loadAll();
      });
  }
}
