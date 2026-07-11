import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AnalyticsRange,
  DashboardWidgetComponent,
  DashboardWidgetsService,
  EmptyStateComponent,
  LfCurrencyPipe,
  RevenueSummary,
} from 'shared';
import { DashboardWidgetBase } from './dashboard-widget-base';

/** Widget 3/12: Revenue (PRD Module 1). Analytics widget — driven by `range`. */
@Component({
  selector: 'lf-revenue-widget',
  standalone: true,
  imports: [DashboardWidgetComponent, EmptyStateComponent, LfCurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lf-dashboard-widget title="Revenue" [loading]="loading()" (refresh)="load()">
      @if (error()) {
        <lf-empty-state
          icon="error_outline"
          title="Couldn't load revenue"
          message="Something went wrong."
          ctaLabel="Retry"
          (cta)="load()"
        />
      } @else if (data(); as summary) {
        <div class="revenue-stats">
          <div class="revenue-stats__item">
            <span class="revenue-stats__label">Billed</span>
            <span class="revenue-stats__value">{{
              summary.billed | lfCurrency: summary.currency
            }}</span>
          </div>
          <div class="revenue-stats__item">
            <span class="revenue-stats__label">Collected</span>
            <span class="revenue-stats__value">{{
              summary.collected | lfCurrency: summary.currency
            }}</span>
          </div>
          <div class="revenue-stats__item">
            <span class="revenue-stats__label">Target</span>
            <span class="revenue-stats__value">{{
              summary.target | lfCurrency: summary.currency
            }}</span>
          </div>
        </div>

        <ul class="revenue-series">
          @for (point of summary.series; track point.periodLabel) {
            <li class="revenue-series__row">
              <span class="revenue-series__label">{{ point.periodLabel }}</span>
              <span class="revenue-series__bars">
                <span
                  class="revenue-series__bar revenue-series__bar--billed"
                  [style.width]="barWidth(point.billed)"
                ></span>
                <span
                  class="revenue-series__bar revenue-series__bar--collected"
                  [style.width]="barWidth(point.collected)"
                ></span>
              </span>
            </li>
          }
        </ul>
      }
    </lf-dashboard-widget>
  `,
  styles: `
    .revenue-stats {
      display: flex;
      gap: var(--lf-space-3);
      margin-bottom: var(--lf-space-3);
    }

    .revenue-stats__item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .revenue-stats__label {
      font-size: var(--lf-text-xs);
      color: var(--lf-on-surface-variant);
    }

    .revenue-stats__value {
      font-size: var(--lf-text-md);
      font-weight: 600;
      color: var(--lf-on-surface);
    }

    .revenue-series {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-1);
    }

    .revenue-series__row {
      display: flex;
      align-items: center;
      gap: var(--lf-space-2);
    }

    .revenue-series__label {
      min-width: 4.5em;
      font-size: var(--lf-text-xs);
      color: var(--lf-on-surface-variant);
    }

    .revenue-series__bars {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .revenue-series__bar {
      height: 6px;
      border-radius: 3px;
      min-width: 2px;
    }

    .revenue-series__bar--billed {
      background: var(--lf-info);
    }

    .revenue-series__bar--collected {
      background: var(--lf-success);
    }
  `,
})
export class RevenueWidgetComponent extends DashboardWidgetBase<RevenueSummary> {
  private readonly widgetsService = inject(DashboardWidgetsService);

  private readonly maxValue = computed(() => {
    const series = this.data()?.series ?? [];
    return series.reduce((max, point) => Math.max(max, point.billed, point.collected), 0);
  });

  barWidth(value: number): string {
    const max = this.maxValue();
    return max > 0 ? `${(value / max) * 100}%` : '0%';
  }

  protected fetch(range: AnalyticsRange | undefined): Observable<RevenueSummary> {
    // The dashboard page always supplies a default range before this widget mounts, so
    // `range` is never undefined in practice here.
    return this.widgetsService.revenue(range!);
  }
}
