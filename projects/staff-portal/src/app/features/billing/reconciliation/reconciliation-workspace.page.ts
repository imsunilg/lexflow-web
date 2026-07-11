import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  ConfirmDialogComponent,
  EmptyStateComponent,
  FileUploaderComponent,
  LfCurrencyPipe,
  TrustReconciliation,
  TrustReconciliationItem,
  TrustReconciliationLine,
  TrustService,
} from 'shared';

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** First cell that parses as a finite number is treated as the amount column. */
function looksLikeHeaderRow(cells: string[]): boolean {
  return !cells.some((cell) => Number.isFinite(Number(cell.trim())) && cell.trim() !== '');
}

/**
 * Client-side CSV parser for the bank-statement import. There is no
 * multipart/CSV-upload endpoint (`createReconciliation` takes pre-parsed
 * `lines[]` as JSON) — this is a deliberately simple manual split, no CSV
 * library dependency exists in this repo. Expected columns: `date,
 * description, amount` with an optional header row.
 */
function parseCsv(text: string): TrustReconciliationLine[] {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.split(',').map((cell) => cell.trim()));

  if (rows.length === 0) return [];

  const dataRows = looksLikeHeaderRow(rows[0]) ? rows.slice(1) : rows;

  return dataRows
    .filter((cells) => cells.length >= 3)
    .map((cells) => ({
      date: cells[0],
      description: cells[1] || null,
      amount: Number(cells[2]),
    }))
    .filter((line) => Number.isFinite(line.amount));
}

/**
 * Reconciliation workspace (PRD Module 8 UI Components: "reconciliation
 * workspace (import → auto-match → exceptions list → sign-off)"; User Flow 8:
 * "monthly three-way reconciliation (bank statement import CSV vs ledger vs
 * client balances) with sign-off"). There is no dedicated auto-match
 * endpoint — matching happens server-side as part of `createReconciliation`,
 * which returns `isBalanced`/`exceptionCount` directly, so this workspace's
 * "auto-match" step is simply submitting the parsed lines and reading back
 * the result rather than a separate client-side matching pass.
 */
@Component({
  selector: 'lf-reconciliation-workspace-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    EmptyStateComponent,
    FileUploaderComponent,
    LfCurrencyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reconciliation-workspace.page.html',
  styleUrl: './reconciliation-workspace.page.scss',
})
export class ReconciliationWorkspacePage {
  private readonly trustService = inject(TrustService);
  private readonly dialog = inject(MatDialog);

  readonly periodStartControl = new FormControl<Date | null>(firstOfMonth());
  readonly periodEndControl = new FormControl<Date | null>(new Date());
  readonly bankStatementBalanceControl = new FormControl<number>(0, { nonNullable: true });
  readonly notesControl = new FormControl('');

  readonly csvFileName = signal<string | null>(null);
  readonly lines = signal<TrustReconciliationLine[]>([]);
  readonly parseError = signal<string | null>(null);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly reconciliation = signal<TrustReconciliation | null>(null);
  readonly exceptions = signal<TrustReconciliationItem[]>([]);
  readonly loadingExceptions = signal(false);
  readonly signedOff = signal(false);

  onCsvSelected(files: File[]): void {
    const file = files[0];
    if (!file) return;
    this.csvFileName.set(file.name);
    this.parseError.set(null);

    file.text().then(
      (text) => {
        const parsed = parseCsv(text);
        if (parsed.length === 0) {
          this.parseError.set('No valid rows found. Expected columns: date, description, amount.');
        }
        this.lines.set(parsed);
      },
      () => this.parseError.set('Could not read that file.'),
    );
  }

  removeLine(index: number): void {
    this.lines.update((lines) => lines.filter((_, i) => i !== index));
  }

  canSubmit(): boolean {
    return (
      !this.submitting() &&
      this.lines().length > 0 &&
      !!this.periodStartControl.value &&
      !!this.periodEndControl.value
    );
  }

  submit(): void {
    const periodStart = this.periodStartControl.value;
    const periodEnd = this.periodEndControl.value;
    if (!periodStart || !periodEnd || this.lines().length === 0) {
      this.errorMessage.set('Pick a period and import at least one CSV line first.');
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.reconciliation.set(null);
    this.exceptions.set([]);
    this.signedOff.set(false);

    this.trustService
      .createReconciliation({
        periodStart: toIsoDate(periodStart),
        periodEnd: toIsoDate(periodEnd),
        bankStatementBalance: this.bankStatementBalanceControl.value,
        lines: this.lines(),
      })
      .subscribe({
        next: (reconciliation) => {
          this.submitting.set(false);
          this.reconciliation.set(reconciliation);
          if (reconciliation.exceptionCount > 0) {
            this.loadExceptions(reconciliation.id);
          }
        },
        error: () => {
          this.submitting.set(false);
          this.errorMessage.set(
            'Could not submit the reconciliation. Check the CSV rows and try again.',
          );
        },
      });
  }

  loadExceptions(id: string): void {
    this.loadingExceptions.set(true);
    this.trustService.reconciliationExceptions(id).subscribe({
      next: (items) => {
        this.exceptions.set(items);
        this.loadingExceptions.set(false);
      },
      error: () => this.loadingExceptions.set(false),
    });
  }

  signOff(): void {
    const reconciliation = this.reconciliation();
    if (!reconciliation) return;

    const proceed = () => {
      this.submitting.set(true);
      this.trustService
        .signoffReconciliation(reconciliation.id, this.notesControl.value || undefined)
        .subscribe({
          next: (updated) => {
            this.submitting.set(false);
            this.reconciliation.set(updated);
            this.signedOff.set(true);
          },
          error: () => {
            this.submitting.set(false);
            this.errorMessage.set('Could not sign off this reconciliation.');
          },
        });
    };

    if (reconciliation.exceptionCount > 0) {
      this.dialog
        .open(ConfirmDialogComponent, {
          data: {
            title: 'Sign off with open exceptions',
            message: `This reconciliation has ${reconciliation.exceptionCount} unresolved exception(s). Sign off anyway?`,
            destructive: true,
            confirmLabel: 'Sign off',
            typedConfirmationText: 'SIGN OFF',
          },
        })
        .afterClosed()
        .subscribe((confirmed) => {
          if (confirmed) proceed();
        });
    } else {
      proceed();
    }
  }
}

function firstOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}
