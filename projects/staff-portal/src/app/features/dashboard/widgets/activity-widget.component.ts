import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ActivityItem,
  DashboardWidgetComponent,
  DashboardWidgetsService,
  EmptyStateComponent,
} from 'shared';
import { DashboardWidgetBase } from './dashboard-widget-base';

/** Widget 6/12: Recent Activities (PRD Module 1). */
@Component({
  selector: 'lf-activity-widget',
  standalone: true,
  imports: [DashboardWidgetComponent, EmptyStateComponent, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lf-dashboard-widget
      title="Recent Activities"
      i18n-title="@@dashboard.activityWidget.title"
      [loading]="loading()"
      (refresh)="load()"
    >
      @if (error()) {
        <lf-empty-state
          icon="error_outline"
          title="Couldn't load recent activity"
          i18n-title="@@dashboard.activityWidget.errorTitle"
          message="Something went wrong."
          i18n-message="@@dashboard.activityWidget.errorMessage"
          ctaLabel="Retry"
          i18n-ctaLabel="@@dashboard.activityWidget.retryLabel"
          (cta)="load()"
        />
      } @else if (!loading() && data()?.length === 0) {
        <lf-empty-state
          icon="history"
          title="No recent activity"
          i18n-title="@@dashboard.activityWidget.emptyTitle"
        />
      } @else if (data()) {
        <ul class="activity-list">
          @for (item of data(); track item.id) {
            <li class="activity-list__row">
              <span class="activity-list__text"
                ><strong>{{ item.actorName }}</strong> {{ item.message }}</span
              >
              <span class="activity-list__time">{{ item.occurredAt | date: 'short' }}</span>
            </li>
          }
        </ul>
      }
    </lf-dashboard-widget>
  `,
  styles: `
    .activity-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-2);
    }

    .activity-list__row {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .activity-list__text {
      color: var(--lf-on-surface);
      font-size: var(--lf-text-sm);
    }

    .activity-list__time {
      font-size: var(--lf-text-xs);
      color: var(--lf-on-surface-variant);
    }
  `,
})
export class ActivityWidgetComponent extends DashboardWidgetBase<ActivityItem[]> {
  private readonly widgetsService = inject(DashboardWidgetsService);

  protected fetch(): Observable<ActivityItem[]> {
    return this.widgetsService.activity();
  }
}
