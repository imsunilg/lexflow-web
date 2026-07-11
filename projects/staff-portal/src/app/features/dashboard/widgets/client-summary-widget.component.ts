import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AnalyticsRange,
  ClientSummaryWidgetData,
  DashboardWidgetComponent,
  DashboardWidgetsService,
  EmptyStateComponent,
} from 'shared';
import { DashboardWidgetBase } from './dashboard-widget-base';

/** Widget 10/12: Client Summary (PRD Module 1). Analytics widget — driven by `range`. */
@Component({
  selector: 'lf-client-summary-widget',
  standalone: true,
  imports: [DashboardWidgetComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lf-dashboard-widget title="Client Summary" [loading]="loading()" (refresh)="load()">
      @if (error()) {
        <lf-empty-state
          icon="error_outline"
          title="Couldn't load client summary"
          message="Something went wrong."
          ctaLabel="Retry"
          (cta)="load()"
        />
      } @else if (data(); as summary) {
        <div class="client-summary-stats">
          <div class="client-summary-stats__item">
            <span class="client-summary-stats__label">New this month</span>
            <span class="client-summary-stats__value">{{ summary.newThisMonth }}</span>
          </div>
          <div class="client-summary-stats__item">
            <span class="client-summary-stats__label">Active</span>
            <span class="client-summary-stats__value">{{ summary.active }}</span>
          </div>
          <div class="client-summary-stats__item">
            <span class="client-summary-stats__label">At risk</span>
            <span
              class="client-summary-stats__value"
              [style.color]="summary.atRisk > 0 ? 'var(--lf-warn)' : null"
            >
              {{ summary.atRisk }}
            </span>
          </div>
        </div>
      }
    </lf-dashboard-widget>
  `,
  styles: `
    .client-summary-stats {
      display: flex;
      gap: var(--lf-space-3);
    }

    .client-summary-stats__item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .client-summary-stats__label {
      font-size: var(--lf-text-xs);
      color: var(--lf-on-surface-variant);
    }

    .client-summary-stats__value {
      font-size: var(--lf-text-md);
      font-weight: 600;
      color: var(--lf-on-surface);
    }
  `,
})
export class ClientSummaryWidgetComponent extends DashboardWidgetBase<ClientSummaryWidgetData> {
  private readonly widgetsService = inject(DashboardWidgetsService);

  protected fetch(range: AnalyticsRange | undefined): Observable<ClientSummaryWidgetData> {
    // The dashboard page always supplies a default range before this widget mounts, so
    // `range` is never undefined in practice here.
    return this.widgetsService.clientSummary(range!);
  }
}
