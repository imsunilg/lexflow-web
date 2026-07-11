import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  Client,
  ClientsService,
  ClientStatement,
  EmptyStateComponent,
  LfCurrencyPipe,
  Payment,
  PaymentsService,
} from 'shared';
import { RefundDialogComponent, RefundDialogData } from '../dialogs/refund-dialog.component';

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Client statement (PRD Module 8 UI Components: "client statement view";
 * dunning §7 "statement-of-account generation per client"). `clientId` arrives
 * as a route param (`billing-hub.page.ts` navigates to `/billing/statement/:clientId`).
 *
 */
@Component({
  selector: 'lf-client-statement-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    RouterLink,
    EmptyStateComponent,
    LfCurrencyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './client-statement.page.html',
  styleUrl: './client-statement.page.scss',
})
export class ClientStatementPage {
  private readonly route = inject(ActivatedRoute);
  private readonly paymentsService = inject(PaymentsService);
  private readonly clientsService = inject(ClientsService);
  private readonly dialog = inject(MatDialog);

  readonly clientId = this.route.snapshot.paramMap.get('clientId') ?? '';
  readonly client = signal<Client | null>(null);
  readonly statement = signal<ClientStatement | null>(null);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly range = new FormGroup({
    from: new FormControl<Date | null>(daysAgo(90), { nonNullable: false }),
    to: new FormControl<Date | null>(new Date(), { nonNullable: false }),
  });

  constructor() {
    if (this.clientId) {
      this.clientsService.get(this.clientId).subscribe((client) => this.client.set(client));
      this.load();
    } else {
      this.errorMessage.set('No client specified.');
    }
  }

  load(): void {
    const { from, to } = this.range.getRawValue();
    if (!from || !to) {
      this.errorMessage.set('Pick both a from and to date.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    this.paymentsService.clientStatement(this.clientId, toIsoDate(from), toIsoDate(to)).subscribe({
      next: (statement) => {
        this.statement.set(statement);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Could not load the statement for this client and date range.');
      },
    });
  }

  refund(payment: Payment): void {
    this.dialog
      .open<RefundDialogComponent, RefundDialogData>(RefundDialogComponent, {
        data: { payment },
      })
      .afterClosed()
      .subscribe((refund) => {
        if (refund) this.load();
      });
  }
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}
