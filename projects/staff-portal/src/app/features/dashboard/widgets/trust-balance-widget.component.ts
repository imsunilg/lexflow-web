import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  DashboardWidgetComponent,
  DashboardWidgetsService,
  EmptyStateComponent,
  LfCurrencyPipe,
  TrustBalanceSummary,
} from 'shared';
import { DashboardWidgetBase } from './dashboard-widget-base';

/** Widget 12/12: Trust Balance (PRD Module 1). */
@Component({
  selector: 'lf-trust-balance-widget',
  standalone: true,
  imports: [DashboardWidgetComponent, EmptyStateComponent, LfCurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lf-dashboard-widget
      title="Trust Balance"
      i18n-title="@@dashboard.trustBalanceWidget.title"
      [loading]="loading()"
      (refresh)="load()"
    >
      @if (error()) {
        <lf-empty-state
          icon="error_outline"
          title="Couldn't load trust balance"
          i18n-title="@@dashboard.trustBalanceWidget.errorTitle"
          message="Something went wrong."
          i18n-message="@@dashboard.trustBalanceWidget.errorMessage"
          ctaLabel="Retry"
          i18n-ctaLabel="@@dashboard.trustBalanceWidget.retryLabel"
          (cta)="load()"
        />
      } @else if (data(); as summary) {
        <div class="trust-balance-stats">
          <div class="trust-balance-stats__item">
            <span
              class="trust-balance-stats__label"
              i18n="@@dashboard.trustBalanceWidget.totalHeldLabel"
              >Total Held</span
            >
            <span class="trust-balance-stats__value">{{
              summary.totalHeld | lfCurrency: summary.currency
            }}</span>
          </div>
          <div class="trust-balance-stats__item">
            <span
              class="trust-balance-stats__label"
              i18n="@@dashboard.trustBalanceWidget.reconciliationLabel"
              >Accounts needing reconciliation</span
            >
            <span
              class="trust-balance-stats__value"
              [style.color]="
                summary.accountsNeedingReconciliation > 0
                  ? 'var(--lf-warn)'
                  : 'var(--lf-on-surface-variant)'
              "
            >
              {{ summary.accountsNeedingReconciliation }}
            </span>
          </div>
        </div>
      }
    </lf-dashboard-widget>
  `,
  styles: `
    .trust-balance-stats {
      display: flex;
      gap: var(--lf-space-3);
    }

    .trust-balance-stats__item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .trust-balance-stats__label {
      font-size: var(--lf-text-xs);
      color: var(--lf-on-surface-variant);
    }

    .trust-balance-stats__value {
      font-size: var(--lf-text-md);
      font-weight: 600;
      color: var(--lf-on-surface);
    }
  `,
})
export class TrustBalanceWidgetComponent extends DashboardWidgetBase<TrustBalanceSummary> {
  private readonly widgetsService = inject(DashboardWidgetsService);

  protected fetch(): Observable<TrustBalanceSummary> {
    return this.widgetsService.trustBalance();
  }
}
