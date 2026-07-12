import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AnalyticsRange,
  DashboardWidgetComponent,
  DashboardWidgetsService,
  EmptyStateComponent,
  MatterSummaryItem,
} from 'shared';
import { DashboardWidgetBase } from './dashboard-widget-base';

/** Widget 9/12: Matter Summary (PRD Module 1). Analytics widget — driven by `range`. */
@Component({
  selector: 'lf-matter-summary-widget',
  standalone: true,
  imports: [DashboardWidgetComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lf-dashboard-widget
      title="Matter Summary"
      i18n-title="@@dashboard.matterSummaryWidget.title"
      [loading]="loading()"
      (refresh)="load()"
    >
      @if (error()) {
        <lf-empty-state
          icon="error_outline"
          title="Couldn't load matter summary"
          i18n-title="@@dashboard.matterSummaryWidget.errorTitle"
          message="Something went wrong."
          i18n-message="@@dashboard.matterSummaryWidget.errorMessage"
          ctaLabel="Retry"
          i18n-ctaLabel="@@dashboard.matterSummaryWidget.retryLabel"
          (cta)="load()"
        />
      } @else if (!loading() && data()?.length === 0) {
        <lf-empty-state
          icon="folder_off"
          title="No matters for this period"
          i18n-title="@@dashboard.matterSummaryWidget.emptyTitle"
        />
      } @else if (data()) {
        <ul class="matter-summary-list">
          @for (item of data(); track item.status + item.practiceArea) {
            <li class="matter-summary-list__row">
              <span class="matter-summary-list__status">{{ item.status }}</span>
              <span class="matter-summary-list__area">{{ item.practiceArea }}</span>
              <span class="matter-summary-list__count">{{ item.count }}</span>
            </li>
          }
        </ul>
      }
    </lf-dashboard-widget>
  `,
  styles: `
    .matter-summary-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-1);
    }

    .matter-summary-list__row {
      display: flex;
      align-items: center;
      gap: var(--lf-space-2);
      font-size: var(--lf-text-sm);
      color: var(--lf-on-surface);
    }

    .matter-summary-list__status {
      font-weight: 500;
    }

    .matter-summary-list__area {
      flex: 1;
      color: var(--lf-on-surface-variant);
      font-size: var(--lf-text-xs);
    }

    .matter-summary-list__count {
      font-weight: 600;
    }
  `,
})
export class MatterSummaryWidgetComponent extends DashboardWidgetBase<MatterSummaryItem[]> {
  private readonly widgetsService = inject(DashboardWidgetsService);

  protected fetch(range: AnalyticsRange | undefined): Observable<MatterSummaryItem[]> {
    // The dashboard page always supplies a default range before this widget mounts, so
    // `range` is never undefined in practice here.
    return this.widgetsService.matterSummary(range!);
  }
}
