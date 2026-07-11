import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AnalyticsRange,
  CaseStatsSummary,
  DashboardWidgetComponent,
  DashboardWidgetsService,
  EmptyStateComponent,
} from 'shared';
import { DashboardWidgetBase } from './dashboard-widget-base';

/** Widget 7/12: Case Statistics (PRD Module 1). Analytics widget — driven by `range`. */
@Component({
  selector: 'lf-case-stats-widget',
  standalone: true,
  imports: [DashboardWidgetComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lf-dashboard-widget title="Case Statistics" [loading]="loading()" (refresh)="load()">
      @if (error()) {
        <lf-empty-state
          icon="error_outline"
          title="Couldn't load case statistics"
          message="Something went wrong."
          ctaLabel="Retry"
          (cta)="load()"
        />
      } @else if (data(); as summary) {
        <div class="case-stats-grid">
          <div class="case-stats-grid__item">
            <span class="case-stats-grid__label">Open</span>
            <span class="case-stats-grid__value">{{ summary.open }}</span>
          </div>
          <div class="case-stats-grid__item">
            <span class="case-stats-grid__label">Closed</span>
            <span class="case-stats-grid__value">{{ summary.closed }}</span>
          </div>
          <div class="case-stats-grid__item">
            <span class="case-stats-grid__label">Won</span>
            <span class="case-stats-grid__value">{{ summary.won }}</span>
          </div>
          <div class="case-stats-grid__item">
            <span class="case-stats-grid__label">Lost</span>
            <span class="case-stats-grid__value">{{ summary.lost }}</span>
          </div>
          <div class="case-stats-grid__item">
            <span class="case-stats-grid__label">Settled</span>
            <span class="case-stats-grid__value">{{ summary.settled }}</span>
          </div>
        </div>

        <ul class="case-stats-stages">
          @for (stage of summary.byStage; track stage.stage) {
            <li class="case-stats-stages__row">
              <span>{{ stage.stage }}</span>
              <span>{{ stage.count }}</span>
            </li>
          }
        </ul>
      }
    </lf-dashboard-widget>
  `,
  styles: `
    .case-stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(5.5em, 1fr));
      gap: var(--lf-space-2);
      margin-bottom: var(--lf-space-3);
    }

    .case-stats-grid__item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .case-stats-grid__label {
      font-size: var(--lf-text-xs);
      color: var(--lf-on-surface-variant);
    }

    .case-stats-grid__value {
      font-size: var(--lf-text-md);
      font-weight: 600;
      color: var(--lf-on-surface);
    }

    .case-stats-stages {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-1);
    }

    .case-stats-stages__row {
      display: flex;
      justify-content: space-between;
      font-size: var(--lf-text-sm);
      color: var(--lf-on-surface);
    }
  `,
})
export class CaseStatsWidgetComponent extends DashboardWidgetBase<CaseStatsSummary> {
  private readonly widgetsService = inject(DashboardWidgetsService);

  protected fetch(range: AnalyticsRange | undefined): Observable<CaseStatsSummary> {
    // The dashboard page always supplies a default range before this widget mounts, so
    // `range` is never undefined in practice here.
    return this.widgetsService.caseStats(range!);
  }
}
