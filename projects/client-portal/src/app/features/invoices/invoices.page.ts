import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PlaceholderPageComponent } from '../../shared/placeholder-page/placeholder-page.component';

@Component({
  selector: 'lf-portal-invoices-page',
  standalone: true,
  imports: [PlaceholderPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-placeholder-page
    title="Invoices"
    description="Invoice list, PDF download, Pay Now, receipts, statements (PRD Module 17)."
  />`,
})
export class InvoicesPage {}
