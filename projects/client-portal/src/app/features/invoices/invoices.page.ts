import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EmptyStateComponent, LfCurrencyPipe, StatusChipComponent } from 'shared';
import { PortalInvoiceSummary } from '../../core/models/portal.models';
import { PortalInvoicesService } from '../../core/services/portal-invoices.service';

/**
 * Invoices + Pay Now (PRD Module 17 step 4). "Pay Now" opens a real gateway
 * checkout session (Razorpay/Stripe/PayPal, tenant-configured) in a new tab —
 * there's no embedded/iframe checkout mode server-side. There is NO PDF
 * download or receipt/statement download endpoint for the portal (confirmed
 * — only this JSON list/detail exists), so this page doesn't offer a
 * download button; it discloses that gap inline instead of linking to a
 * route that doesn't exist.
 */
@Component({
  selector: 'lf-portal-invoices-page',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    EmptyStateComponent,
    StatusChipComponent,
    LfCurrencyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invoices.page.html',
  styleUrl: './invoices.page.scss',
})
export class InvoicesPage {
  private readonly invoicesService = inject(PortalInvoicesService);
  private readonly snackBar = inject(MatSnackBar);

  readonly loading = signal(true);
  readonly invoices = signal<PortalInvoiceSummary[]>([]);
  readonly payingId = signal<string | null>(null);

  constructor() {
    this.invoicesService.list().subscribe((invoices) => {
      this.invoices.set(invoices);
      this.loading.set(false);
    });
  }

  payNow(invoice: PortalInvoiceSummary): void {
    this.payingId.set(invoice.id);
    this.invoicesService
      .payNow(invoice.id, { returnUrl: `${window.location.origin}/invoices` })
      .subscribe({
        next: (session) => {
          this.payingId.set(null);
          window.open(session.checkoutUrl, '_blank', 'noopener');
        },
        error: () => {
          this.payingId.set(null);
          this.snackBar.open('Could not start checkout. Please try again.', 'Dismiss', {
            duration: 5000,
          });
        },
      });
  }
}
