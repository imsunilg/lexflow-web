import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AnalyticsRange,
  DashboardWidgetComponent,
  DashboardWidgetsService,
  EmptyStateComponent,
  LeadPipelineStage,
} from 'shared';
import { DashboardWidgetBase } from './dashboard-widget-base';

/** Widget 11/12: Lead Pipeline (PRD Module 1). Analytics widget — driven by `range`. */
@Component({
  selector: 'lf-lead-pipeline-widget',
  standalone: true,
  imports: [DashboardWidgetComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lf-dashboard-widget
      title="Lead Pipeline"
      i18n-title="@@dashboard.leadPipelineWidget.title"
      [loading]="loading()"
      (refresh)="load()"
    >
      @if (error()) {
        <lf-empty-state
          icon="error_outline"
          title="Couldn't load lead pipeline"
          i18n-title="@@dashboard.leadPipelineWidget.errorTitle"
          message="Something went wrong."
          i18n-message="@@dashboard.leadPipelineWidget.errorMessage"
          ctaLabel="Retry"
          i18n-ctaLabel="@@dashboard.leadPipelineWidget.retryLabel"
          (cta)="load()"
        />
      } @else if (!loading() && data()?.length === 0) {
        <lf-empty-state
          icon="filter_alt_off"
          title="No leads in the pipeline"
          i18n-title="@@dashboard.leadPipelineWidget.emptyTitle"
        />
      } @else if (data()) {
        <ul class="pipeline-list">
          @for (stage of data(); track stage.stage) {
            <li class="pipeline-list__row">
              <span class="pipeline-list__label">{{ stage.stage }}</span>
              <span class="pipeline-list__bar-track">
                <span class="pipeline-list__bar" [style.width]="barWidth(stage.count)"></span>
              </span>
              <span class="pipeline-list__count">{{ stage.count }}</span>
            </li>
          }
        </ul>
      }
    </lf-dashboard-widget>
  `,
  styles: `
    .pipeline-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-1);
    }

    .pipeline-list__row {
      display: flex;
      align-items: center;
      gap: var(--lf-space-2);
    }

    .pipeline-list__label {
      min-width: 6em;
      font-size: var(--lf-text-xs);
      color: var(--lf-on-surface-variant);
    }

    .pipeline-list__bar-track {
      flex: 1;
      background: var(--lf-surface-variant);
      border-radius: 3px;
      height: 6px;
      overflow: hidden;
    }

    .pipeline-list__bar {
      display: block;
      height: 100%;
      background: var(--lf-info);
      border-radius: 3px;
    }

    .pipeline-list__count {
      min-width: 2em;
      text-align: right;
      font-size: var(--lf-text-xs);
      font-weight: 600;
      color: var(--lf-on-surface);
    }
  `,
})
export class LeadPipelineWidgetComponent extends DashboardWidgetBase<LeadPipelineStage[]> {
  private readonly widgetsService = inject(DashboardWidgetsService);

  private readonly maxCount = computed(() => {
    const stages = this.data() ?? [];
    return stages.reduce((max, stage) => Math.max(max, stage.count), 0);
  });

  barWidth(count: number): string {
    const max = this.maxCount();
    return max > 0 ? `${(count / max) * 100}%` : '0%';
  }

  protected fetch(range: AnalyticsRange | undefined): Observable<LeadPipelineStage[]> {
    // The dashboard page always supplies a default range before this widget mounts, so
    // `range` is never undefined in practice here.
    return this.widgetsService.leadPipeline(range!);
  }
}
