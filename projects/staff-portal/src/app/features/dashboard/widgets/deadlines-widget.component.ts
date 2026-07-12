import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  DashboardWidgetComponent,
  DashboardWidgetsService,
  DeadlineItem,
  EmptyStateComponent,
  StatusChipComponent,
  StatusChipTone,
} from 'shared';
import { DashboardWidgetBase } from './dashboard-widget-base';

/** Widget 5/12: Upcoming Deadlines (PRD Module 1). */
@Component({
  selector: 'lf-deadlines-widget',
  standalone: true,
  imports: [DashboardWidgetComponent, EmptyStateComponent, StatusChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lf-dashboard-widget
      title="Upcoming Deadlines"
      i18n-title="@@dashboard.deadlinesWidget.title"
      [loading]="loading()"
      (refresh)="load()"
    >
      @if (error()) {
        <lf-empty-state
          icon="error_outline"
          title="Couldn't load upcoming deadlines"
          i18n-title="@@dashboard.deadlinesWidget.errorTitle"
          message="Something went wrong."
          i18n-message="@@dashboard.deadlinesWidget.errorMessage"
          ctaLabel="Retry"
          i18n-ctaLabel="@@dashboard.deadlinesWidget.retryLabel"
          (cta)="load()"
        />
      } @else if (!loading() && data()?.length === 0) {
        <lf-empty-state
          icon="event_available"
          title="No upcoming deadlines"
          i18n-title="@@dashboard.deadlinesWidget.emptyTitle"
        />
      } @else if (data()) {
        <ul class="deadlines-list">
          @for (deadline of data(); track deadline.id) {
            <li class="deadlines-list__row">
              <span class="deadlines-list__details">
                <strong>{{ deadline.title }}</strong>
                @if (deadline.matterTitle) {
                  <span class="deadlines-list__meta">{{ deadline.matterTitle }}</span>
                }
                <span class="deadlines-list__meta" i18n="@@dashboard.deadlinesWidget.dueLabel"
                  >Due {{ deadline.dueDate }}</span
                >
              </span>
              <lf-status-chip
                [label]="deadline.severity"
                [toneOverride]="severityTone(deadline.severity)"
              />
            </li>
          }
        </ul>
      }
    </lf-dashboard-widget>
  `,
  styles: `
    .deadlines-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-2);
    }

    .deadlines-list__row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--lf-space-2);
    }

    .deadlines-list__details {
      display: flex;
      flex-direction: column;
      gap: 2px;
      color: var(--lf-on-surface);
    }

    .deadlines-list__meta {
      font-size: var(--lf-text-xs);
      color: var(--lf-on-surface-variant);
    }
  `,
})
export class DeadlinesWidgetComponent extends DashboardWidgetBase<DeadlineItem[]> {
  private readonly widgetsService = inject(DashboardWidgetsService);

  private static readonly SEVERITY_TONES: Record<DeadlineItem['severity'], StatusChipTone> = {
    low: 'info',
    medium: 'warn',
    high: 'error',
  };

  severityTone(severity: DeadlineItem['severity']): StatusChipTone {
    return DeadlinesWidgetComponent.SEVERITY_TONES[severity];
  }

  protected fetch(): Observable<DeadlineItem[]> {
    return this.widgetsService.deadlines();
  }
}
