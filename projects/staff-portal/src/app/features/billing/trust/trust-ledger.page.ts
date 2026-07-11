import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute } from '@angular/router';
import {
  Client,
  ClientsService,
  ConfirmDialogComponent,
  EmptyStateComponent,
  LfCurrencyPipe,
  TrustAccount,
  TrustLedgerEntry,
  TrustService,
} from 'shared';

/**
 * Trust ledger per client (PRD Module 8 UI Components: "trust ledger per
 * client (running balance, entry types color-coded)"; User Flow 8's trust
 * rules: no negative balance — AC-B4, server-enforced — no commingling,
 * every entry double-entry journaled, edits forbidden (only reversing
 * entries, append-only with a DB trigger blocking UPDATE/DELETE — so there is
 * no edit affordance here at all, only Deposit/Disburse/Reverse).
 *
 * Colors don't reuse `StatusChipComponent`'s tone map (its known statuses
 * don't include Deposit/Disbursement/Reversal) — instead this applies
 * `[attr.data-kind]` CSS directly, the same pattern as the Calendar module's
 * `event-chip.component.ts` `[attr.data-tone]`.
 */
@Component({
  selector: 'lf-trust-ledger-page',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    EmptyStateComponent,
    LfCurrencyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trust-ledger.page.html',
  styleUrl: './trust-ledger.page.scss',
})
export class TrustLedgerPage {
  private readonly route = inject(ActivatedRoute);
  private readonly trustService = inject(TrustService);
  private readonly clientsService = inject(ClientsService);
  private readonly dialog = inject(MatDialog);

  readonly clientId = this.route.snapshot.paramMap.get('clientId') ?? '';
  readonly client = signal<Client | null>(null);
  readonly account = signal<TrustAccount | null>(null);
  readonly entries = signal<TrustLedgerEntry[]>([]);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly depositFormOpen = signal(false);
  readonly disburseFormOpen = signal(false);
  readonly submitting = signal(false);

  readonly depositForm = new FormGroup({
    amount: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0.01)],
    }),
    purpose: new FormControl(''),
    authorizationRef: new FormControl(''),
  });

  readonly disburseForm = new FormGroup({
    amount: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0.01)],
    }),
    purpose: new FormControl(''),
    invoiceId: new FormControl(''),
    authorizationRef: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
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
    this.loading.set(true);
    this.errorMessage.set(null);
    this.trustService.getAccount(this.clientId).subscribe({
      next: (account) => this.account.set(account),
      error: () => this.errorMessage.set('Could not load the trust account.'),
    });
    this.trustService.ledger(this.clientId).subscribe({
      next: (entries) => {
        this.entries.set(entries);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Could not load the trust ledger.');
      },
    });
  }

  submitDeposit(): void {
    if (this.depositForm.invalid) {
      this.depositForm.markAllAsTouched();
      return;
    }
    const value = this.depositForm.getRawValue();
    this.submitting.set(true);
    this.trustService
      .deposit(this.clientId, {
        amount: value.amount,
        purpose: value.purpose || null,
        authorizationRef: value.authorizationRef || null,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.depositFormOpen.set(false);
          this.depositForm.reset({ amount: 0, purpose: '', authorizationRef: '' });
          this.load();
        },
        error: () => {
          this.submitting.set(false);
          this.errorMessage.set('Could not record the deposit.');
        },
      });
  }

  confirmAndDisburse(): void {
    if (this.disburseForm.invalid) {
      this.disburseForm.markAllAsTouched();
      return;
    }
    const value = this.disburseForm.getRawValue();

    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Disburse trust funds',
          message: `Disburse ${value.amount} from this client's trust account? Trust entries are append-only — this cannot be edited or undone, only reversed by a separate correcting entry. AC-B4: the server will reject this if it exceeds the current trust balance.`,
          destructive: true,
          confirmLabel: 'Disburse',
          typedConfirmationText: value.authorizationRef,
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.submitting.set(true);
        this.trustService
          .disburse(this.clientId, {
            amount: value.amount,
            purpose: value.purpose || null,
            invoiceId: value.invoiceId || null,
            authorizationRef: value.authorizationRef,
          })
          .subscribe({
            next: () => {
              this.submitting.set(false);
              this.disburseFormOpen.set(false);
              this.disburseForm.reset({
                amount: 0,
                purpose: '',
                invoiceId: '',
                authorizationRef: '',
              });
              this.load();
            },
            error: () => {
              this.submitting.set(false);
              this.errorMessage.set(
                'Disbursement was rejected — it likely exceeds the current trust balance.',
              );
            },
          });
      });
  }

  reverse(entry: TrustLedgerEntry): void {
    const reason = window.prompt('Reason for reversing this entry?');
    if (!reason) return;

    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Reverse trust entry',
          message: `Reverse entry #${entry.entryNo} (${entry.kind}, ${entry.amount})? Entries are append-only — this creates an offsetting entry rather than editing history.`,
          destructive: true,
          confirmLabel: 'Reverse',
          typedConfirmationText: String(entry.entryNo),
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.trustService.reverseEntry(entry.id, reason).subscribe({
          next: () => this.load(),
          error: () => this.errorMessage.set('Could not reverse this entry.'),
        });
      });
  }
}
