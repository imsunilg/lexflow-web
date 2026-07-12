import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  EmptyStateComponent,
  LfCurrencyPipe,
  MatterExpense,
  MatterExpenseInput,
  MattersService,
} from 'shared';

interface ExpenseFormValue {
  description: string;
  amount: number | null;
  incurredOn: Date | null;
  billable: boolean;
}

function buildExpenseForm(): FormGroup<{
  description: FormControl<string>;
  amount: FormControl<number | null>;
  incurredOn: FormControl<Date | null>;
  billable: FormControl<boolean>;
}> {
  return new FormGroup({
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    amount: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(0)],
    }),
    incurredOn: new FormControl<Date | null>(new Date(), {
      validators: [Validators.required],
    }),
    billable: new FormControl(false, { nonNullable: true }),
  });
}

function toInput(value: ExpenseFormValue): MatterExpenseInput {
  return {
    description: value.description,
    amount: value.amount ?? 0,
    incurredOn: (value.incurredOn ?? new Date()).toISOString(),
    billable: value.billable,
  };
}

/**
 * Time & Expenses tab for the matter workspace (PRD Module 4).
 * Expenses are a real CRUD-lite sub-grid (fetch + add). There is no
 * matter-scoped time-entry-listing API in this codebase (only a
 * dashboard-level "currently running timer" concept exists elsewhere,
 * nothing historical/per-matter), so that section is a placeholder.
 */
@Component({
  selector: 'lf-matter-time-expenses-tab',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    EmptyStateComponent,
    LfCurrencyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="matter-time-expenses-tab">
      <section class="matter-time-expenses-tab__section">
        <h3
          class="matter-time-expenses-tab__heading"
          i18n="@@matters.matterTimeExpensesTab.expensesHeading"
        >
          Expenses
        </h3>
        @if (loading()) {
          <div class="matter-time-expenses-tab__spinner">
            <mat-spinner diameter="32" />
          </div>
        } @else if (error()) {
          <lf-empty-state
            icon="error_outline"
            title="Couldn't load expenses"
            i18n-title="@@matters.matterTimeExpensesTab.loadErrorTitle"
            message="Something went wrong while loading expenses."
            i18n-message="@@matters.matterTimeExpensesTab.loadErrorMessage"
            ctaLabel="Retry"
            i18n-ctaLabel="@@matters.matterTimeExpensesTab.retryButton"
            (cta)="load()"
          />
        } @else {
          @if (expenses().length === 0 && !addingNew()) {
            <lf-empty-state
              icon="receipt_long"
              title="No expenses yet"
              i18n-title="@@matters.matterTimeExpensesTab.emptyTitle"
              ctaLabel="Add expense"
              i18n-ctaLabel="@@matters.matterTimeExpensesTab.addExpenseButton"
              (cta)="startAdd()"
            />
          } @else {
            <table class="matter-time-expenses-tab__table">
              <thead>
                <tr>
                  <th i18n="@@matters.matterTimeExpensesTab.descriptionColumn">Description</th>
                  <th i18n="@@matters.matterTimeExpensesTab.amountColumn">Amount</th>
                  <th i18n="@@matters.matterTimeExpensesTab.incurredOnColumn">Incurred on</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (expense of expenses(); track expense.id) {
                  <tr>
                    <td>{{ expense.description }}</td>
                    <td>{{ expense.amount | lfCurrency }}</td>
                    <td>{{ expense.incurredOn | date: 'mediumDate' }}</td>
                    <td>
                      @if (expense.billable) {
                        <span
                          class="matter-time-expenses-tab__chip"
                          i18n="@@matters.matterTimeExpensesTab.billableChip"
                          >Billable</span
                        >
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }

          @if (addingNew()) {
            <form
              [formGroup]="addForm"
              class="matter-time-expenses-tab__form matter-time-expenses-tab__form--add"
            >
              <mat-form-field appearance="outline">
                <mat-label i18n="@@matters.matterTimeExpensesTab.descriptionLabel"
                  >Description</mat-label
                >
                <input matInput formControlName="description" />
                @if (
                  addForm.controls.description.hasError('required') &&
                  addForm.controls.description.touched
                ) {
                  <mat-error i18n="@@matters.matterTimeExpensesTab.descriptionRequiredError"
                    >Description is required.</mat-error
                  >
                }
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label i18n="@@matters.matterTimeExpensesTab.amountLabel">Amount</mat-label>
                <input matInput type="number" formControlName="amount" min="0" />
                @if (
                  addForm.controls.amount.hasError('required') && addForm.controls.amount.touched
                ) {
                  <mat-error i18n="@@matters.matterTimeExpensesTab.amountRequiredError"
                    >Amount is required.</mat-error
                  >
                }
                @if (addForm.controls.amount.hasError('min')) {
                  <mat-error i18n="@@matters.matterTimeExpensesTab.amountMinError"
                    >Amount must be zero or more.</mat-error
                  >
                }
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label i18n="@@matters.matterTimeExpensesTab.incurredOnLabel"
                  >Incurred on</mat-label
                >
                <input
                  matInput
                  [matDatepicker]="picker"
                  [max]="today"
                  formControlName="incurredOn"
                />
                <mat-datepicker-toggle matIconSuffix [for]="picker" />
                <mat-datepicker #picker />
              </mat-form-field>
              <mat-checkbox
                formControlName="billable"
                i18n="@@matters.matterTimeExpensesTab.billableCheckbox"
                >Billable</mat-checkbox
              >
              <div class="matter-time-expenses-tab__form-actions">
                <button
                  mat-button
                  type="button"
                  (click)="cancelAdd()"
                  i18n="@@matters.matterTimeExpensesTab.cancelButton"
                >
                  Cancel
                </button>
                <button
                  mat-flat-button
                  color="primary"
                  type="button"
                  [disabled]="addForm.invalid || saving()"
                  (click)="submitAdd()"
                >
                  @if (saving()) {
                    <mat-spinner diameter="18" />
                  } @else {
                    <span i18n="@@matters.matterTimeExpensesTab.addExpenseButton">Add expense</span>
                  }
                </button>
              </div>
              @if (errorMessage()) {
                <p class="matter-time-expenses-tab__error" role="alert">{{ errorMessage() }}</p>
              }
            </form>
          } @else if (expenses().length > 0) {
            <button mat-stroked-button type="button" (click)="startAdd()">
              <mat-icon>add</mat-icon>
              <span i18n="@@matters.matterTimeExpensesTab.addExpenseButton">Add expense</span>
            </button>
          }
        }
      </section>

      <section class="matter-time-expenses-tab__section">
        <h3
          class="matter-time-expenses-tab__heading"
          i18n="@@matters.matterTimeExpensesTab.timeEntriesHeading"
        >
          Time entries
        </h3>
        <lf-empty-state
          icon="schedule"
          title="Time entries aren't available here yet"
          i18n-title="@@matters.matterTimeExpensesTab.timeEntriesEmptyTitle"
          message="No matter-scoped time-entry API exists in this environment yet."
          i18n-message="@@matters.matterTimeExpensesTab.timeEntriesEmptyMessage"
        />
      </section>
    </div>
  `,
  styles: `
    .matter-time-expenses-tab {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-4);
    }

    .matter-time-expenses-tab__section {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-2);
    }

    .matter-time-expenses-tab__heading {
      margin: 0;
      font-size: var(--lf-text-md);
      font-weight: 600;
    }

    .matter-time-expenses-tab__spinner {
      display: flex;
      justify-content: center;
      padding: var(--lf-space-4);
    }

    .matter-time-expenses-tab__table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--lf-text-sm);
    }

    .matter-time-expenses-tab__table th {
      text-align: left;
      color: var(--lf-on-surface-variant);
      font-weight: 600;
      font-size: var(--lf-text-xs);
      padding: var(--lf-space-1);
      border-bottom: 1px solid var(--lf-surface-variant);
    }

    .matter-time-expenses-tab__table td {
      padding: var(--lf-space-1);
      border-bottom: 1px solid var(--lf-surface-variant);
      vertical-align: middle;
    }

    .matter-time-expenses-tab__chip {
      display: inline-flex;
      align-items: center;
      padding: 2px 10px;
      border-radius: 999px;
      font-size: var(--lf-text-xs);
      font-weight: 600;
      background: color-mix(in srgb, var(--lf-success) 16%, transparent);
      color: var(--lf-success);
    }

    .matter-time-expenses-tab__form {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0 var(--lf-space-2);
      align-items: start;
      padding: var(--lf-space-2) 0;
    }

    .matter-time-expenses-tab__form--add {
      border-top: 1px dashed var(--lf-surface-variant);
      margin-top: var(--lf-space-1);
    }

    .matter-time-expenses-tab__form-actions {
      grid-column: 1 / -1;
      display: flex;
      justify-content: flex-end;
      gap: var(--lf-space-1);
    }

    .matter-time-expenses-tab__error {
      grid-column: 1 / -1;
      margin: 0;
      color: var(--lf-error);
      font-size: var(--lf-text-sm);
    }
  `,
})
export class MatterTimeExpensesTabComponent {
  private readonly mattersService = inject(MattersService);

  readonly matterId = input.required<string>();

  readonly today = new Date();

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly expenses = signal<MatterExpense[]>([]);

  readonly addingNew = signal(false);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  addForm = buildExpenseForm();

  constructor() {
    effect(() => {
      const id = this.matterId();
      if (id) {
        this.load();
      }
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.mattersService.listExpenses(this.matterId()).subscribe({
      next: (expenses) => {
        this.expenses.set(expenses);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  startAdd(): void {
    this.addForm = buildExpenseForm();
    this.errorMessage.set(null);
    this.addingNew.set(true);
  }

  cancelAdd(): void {
    this.addingNew.set(false);
    this.errorMessage.set(null);
  }

  submitAdd(): void {
    if (this.addForm.invalid) {
      this.addForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    const input = toInput(this.addForm.getRawValue());
    this.mattersService.addExpense(this.matterId(), input).subscribe({
      next: (expense) => {
        this.expenses.update((expenses) => [...expenses, expense]);
        this.saving.set(false);
        this.addingNew.set(false);
      },
      error: () => {
        this.saving.set(false);
        this.errorMessage.set('Something went wrong. Please try again.');
      },
    });
  }
}
