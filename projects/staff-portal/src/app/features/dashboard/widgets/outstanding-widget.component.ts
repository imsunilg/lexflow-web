import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  DashboardWidgetComponent,
  DashboardWidgetsService,
  EmptyStateComponent,
  LfCurrencyPipe,
  OutstandingSummary,
} from 'shared';
import { DashboardWidgetBase } from './dashboard-widget-base';

/** Widget 4/12: Outstanding Payments (PRD Module 1). */
@Component({
  selector: 'lf-outstanding-widget',
  standalone: true,
  imports: [DashboardWidgetComponent, EmptyStateComponent, LfCurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lf-dashboard-widget title="Outstanding Payments" [loading]="loading()" (refresh)="load()">
      @if (error()) {
        <lf-empty-state
          icon="error_outline"
          title="Couldn't load outstanding payments"
          message="Something went wrong."
          ctaLabel="Retry"
          (cta)="load()"
        />
      } @else if (data(); as summary) {
        <div class="outstanding-total">
          <span class="outstanding-total__label">Total Outstanding</span>
          <span class="outstanding-total__value">{{
            summary.total | lfCurrency: summary.currency
          }}</span>
        </div>

        <ul class="outstanding-buckets">
          @for (bucket of summary.buckets; track bucket.label) {
            <li class="outstanding-buckets__row">
              <span class="outstanding-buckets__label">{{ bucket.label }} days</span>
              <span class="outstanding-buckets__bar-track">
                <span
                  class="outstanding-buckets__bar"
                  [style.width]="barWidth(bucket.amount)"
                ></span>
              </span>
              <span class="outstanding-buckets__amount">{{
                bucket.amount | lfCurrency: summary.currency
              }}</span>
            </li>
          }
        </ul>

        @if (summary.topDebtors.length > 0) {
          <h4 class="outstanding-debtors__heading">Top debtors</h4>
          <ul class="outstanding-debtors">
            @for (debtor of summary.topDebtors; track debtor.clientId) {
              <li class="outstanding-debtors__row">
                <span>{{ debtor.clientName }}</span>
                <span>{{ debtor.amount | lfCurrency: summary.currency }}</span>
              </li>
            }
          </ul>
        }
      }
    </lf-dashboard-widget>
  `,
  styles: `
    .outstanding-total {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-bottom: var(--lf-space-3);
    }

    .outstanding-total__label {
      font-size: var(--lf-text-xs);
      color: var(--lf-on-surface-variant);
    }

    .outstanding-total__value {
      font-size: var(--lf-text-md);
      font-weight: 600;
      color: var(--lf-on-surface);
    }

    .outstanding-buckets {
      list-style: none;
      margin: 0 0 var(--lf-space-3);
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-1);
    }

    .outstanding-buckets__row {
      display: flex;
      align-items: center;
      gap: var(--lf-space-2);
    }

    .outstanding-buckets__label {
      min-width: 4.5em;
      font-size: var(--lf-text-xs);
      color: var(--lf-on-surface-variant);
    }

    .outstanding-buckets__bar-track {
      flex: 1;
      background: var(--lf-surface-variant);
      border-radius: 3px;
      height: 6px;
      overflow: hidden;
    }

    .outstanding-buckets__bar {
      display: block;
      height: 100%;
      background: var(--lf-warn);
      border-radius: 3px;
    }

    .outstanding-buckets__amount {
      min-width: 6em;
      text-align: right;
      font-size: var(--lf-text-xs);
      color: var(--lf-on-surface);
    }

    .outstanding-debtors__heading {
      margin: 0 0 var(--lf-space-1);
      font-size: var(--lf-text-sm);
      font-weight: 600;
      color: var(--lf-on-surface-variant);
    }

    .outstanding-debtors {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-1);
    }

    .outstanding-debtors__row {
      display: flex;
      justify-content: space-between;
      font-size: var(--lf-text-sm);
      color: var(--lf-on-surface);
    }
  `,
})
export class OutstandingWidgetComponent extends DashboardWidgetBase<OutstandingSummary> {
  private readonly widgetsService = inject(DashboardWidgetsService);

  private readonly maxBucketAmount = computed(() => {
    const buckets = this.data()?.buckets ?? [];
    return buckets.reduce((max, bucket) => Math.max(max, bucket.amount), 0);
  });

  barWidth(amount: number): string {
    const max = this.maxBucketAmount();
    return max > 0 ? `${(amount / max) * 100}%` : '0%';
  }

  protected fetch(): Observable<OutstandingSummary> {
    return this.widgetsService.outstanding();
  }
}
