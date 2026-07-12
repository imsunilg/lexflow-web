import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AnalyticsRange,
  DashboardWidgetComponent,
  DashboardWidgetsService,
  EmptyStateComponent,
  LawyerPerformanceItem,
} from 'shared';
import { DashboardWidgetBase } from './dashboard-widget-base';

/** Widget 8/12: Performance Charts (catalog id `lawyer-performance`, PRD Module 1). Analytics widget. */
@Component({
  selector: 'lf-lawyer-performance-widget',
  standalone: true,
  imports: [DashboardWidgetComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lf-dashboard-widget
      title="Performance Charts"
      i18n-title="@@dashboard.lawyerPerformanceWidget.title"
      [loading]="loading()"
      (refresh)="load()"
    >
      @if (error()) {
        <lf-empty-state
          icon="error_outline"
          title="Couldn't load performance data"
          i18n-title="@@dashboard.lawyerPerformanceWidget.errorTitle"
          message="Something went wrong."
          i18n-message="@@dashboard.lawyerPerformanceWidget.errorMessage"
          ctaLabel="Retry"
          i18n-ctaLabel="@@dashboard.lawyerPerformanceWidget.retryLabel"
          (cta)="load()"
        />
      } @else if (!loading() && data()?.length === 0) {
        <lf-empty-state
          icon="query_stats"
          title="No performance data for this period"
          i18n-title="@@dashboard.lawyerPerformanceWidget.emptyTitle"
        />
      } @else if (data()) {
        <ul class="performance-list">
          @for (lawyer of data(); track lawyer.lawyerId) {
            <li class="performance-list__row">
              <span class="performance-list__name">{{ lawyer.lawyerName }}</span>
              <span
                class="performance-list__stat"
                i18n="@@dashboard.lawyerPerformanceWidget.hoursLabel"
                >{{ lawyer.billableHours }} hrs</span
              >
              <span
                class="performance-list__stat"
                i18n="@@dashboard.lawyerPerformanceWidget.utilizationLabel"
                >{{ lawyer.utilizationPct }}% util</span
              >
              <span
                class="performance-list__stat"
                i18n="@@dashboard.lawyerPerformanceWidget.realizationLabel"
                >{{ lawyer.realizationPct }}% realization</span
              >
            </li>
          }
        </ul>
      }
    </lf-dashboard-widget>
  `,
  styles: `
    .performance-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-1);
    }

    .performance-list__row {
      display: flex;
      align-items: center;
      gap: var(--lf-space-2);
      font-size: var(--lf-text-sm);
    }

    .performance-list__name {
      flex: 1;
      font-weight: 500;
      color: var(--lf-on-surface);
    }

    .performance-list__stat {
      min-width: 6em;
      text-align: right;
      color: var(--lf-on-surface-variant);
      font-size: var(--lf-text-xs);
    }
  `,
})
export class LawyerPerformanceWidgetComponent extends DashboardWidgetBase<LawyerPerformanceItem[]> {
  private readonly widgetsService = inject(DashboardWidgetsService);

  protected fetch(range: AnalyticsRange | undefined): Observable<LawyerPerformanceItem[]> {
    // The dashboard page always supplies a default range before this widget mounts, so
    // `range` is never undefined in practice here.
    return this.widgetsService.lawyerPerformance(range!);
  }
}
