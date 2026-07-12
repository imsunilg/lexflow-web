import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  EmptyStateComponent,
  LfCurrencyPipe,
  MatterFinancialSummary,
  MattersService,
} from 'shared';

interface BillingStat {
  label: string;
  value: number;
  negative: boolean;
}

/**
 * Billing tab for the matter workspace (PRD Module 4, AC-M4).
 * Only the aggregate financial summary is available — there's no
 * matter-scoped invoice/line-item listing endpoint in this codebase, so this
 * tab shows the stat grid only, plus a note explaining the gap.
 */
@Component({
  selector: 'lf-matter-billing-tab',
  standalone: true,
  imports: [MatProgressSpinnerModule, EmptyStateComponent, LfCurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="matter-billing-tab">
      @if (loading()) {
        <div class="matter-billing-tab__spinner">
          <mat-spinner diameter="32" />
        </div>
      } @else if (error()) {
        <lf-empty-state
          icon="error_outline"
          title="Couldn't load the financial summary"
          i18n-title="@@matters.matterBillingTab.loadErrorTitle"
          message="Something went wrong while loading billing data."
          i18n-message="@@matters.matterBillingTab.loadErrorMessage"
          ctaLabel="Retry"
          i18n-ctaLabel="@@matters.matterBillingTab.retryButton"
          (cta)="load()"
        />
      } @else if (summary(); as data) {
        <div class="matter-billing-tab__grid">
          @for (stat of stats(); track stat.label) {
            <div class="matter-billing-tab__tile">
              <p class="matter-billing-tab__tile-label">{{ stat.label }}</p>
              <p
                class="matter-billing-tab__tile-value"
                [class.matter-billing-tab__tile-value--negative]="stat.negative"
              >
                {{ stat.value | lfCurrency }}
              </p>
            </div>
          }
        </div>
        <p class="matter-billing-tab__note" i18n="@@matters.matterBillingTab.unavailableNote">
          Detailed invoices and line-item billing aren't available yet — the Billing module isn't
          fully built in this environment.
        </p>
      }
    </div>
  `,
  styles: `
    .matter-billing-tab {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-3);
    }

    .matter-billing-tab__spinner {
      display: flex;
      justify-content: center;
      padding: var(--lf-space-4);
    }

    .matter-billing-tab__grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: var(--lf-space-2);
    }

    .matter-billing-tab__tile {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-1);
      padding: var(--lf-space-2);
      border-radius: var(--lf-radius);
      border: 1px solid var(--lf-surface-variant);
    }

    .matter-billing-tab__tile-label {
      margin: 0;
      font-size: var(--lf-text-xs);
      color: var(--lf-on-surface-variant);
    }

    .matter-billing-tab__tile-value {
      margin: 0;
      font-size: var(--lf-text-md);
      font-weight: 600;
    }

    .matter-billing-tab__tile-value--negative {
      color: var(--lf-error);
    }

    .matter-billing-tab__note {
      margin: 0;
      font-size: var(--lf-text-sm);
      color: var(--lf-on-surface-variant);
    }
  `,
})
export class MatterBillingTabComponent {
  private readonly mattersService = inject(MattersService);

  readonly matterId = input.required<string>();

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly summary = signal<MatterFinancialSummary | null>(null);

  readonly stats = computed<BillingStat[]>(() => {
    const data = this.summary();
    if (!data) {
      return [];
    }
    return [
      { label: 'Billed', value: data.billed, negative: false },
      { label: 'Collected', value: data.collected, negative: false },
      { label: 'WIP', value: data.wip, negative: false },
      { label: 'Expenses', value: data.expenses, negative: false },
      { label: 'Budget Variance', value: data.budgetVariance, negative: data.budgetVariance < 0 },
      { label: 'Trust Balance', value: data.trustBalance, negative: false },
    ];
  });

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
    this.mattersService.financialSummary(this.matterId()).subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}
