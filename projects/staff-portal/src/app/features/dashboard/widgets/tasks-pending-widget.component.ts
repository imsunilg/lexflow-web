import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  DashboardWidgetComponent,
  DashboardWidgetsService,
  EmptyStateComponent,
  TaskPendingItem,
} from 'shared';
import { DashboardWidgetBase } from './dashboard-widget-base';

interface TaskBucketGroup {
  bucket: TaskPendingItem['bucket'];
  label: string;
  items: TaskPendingItem[];
}

/** Widget 2/12: Pending Tasks (PRD Module 1). */
@Component({
  selector: 'lf-tasks-pending-widget',
  standalone: true,
  imports: [DashboardWidgetComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lf-dashboard-widget
      title="Pending Tasks"
      i18n-title="@@dashboard.tasksPendingWidget.title"
      [loading]="loading()"
      (refresh)="load()"
    >
      @if (error()) {
        <lf-empty-state
          icon="error_outline"
          title="Couldn't load pending tasks"
          i18n-title="@@dashboard.tasksPendingWidget.errorTitle"
          message="Something went wrong."
          i18n-message="@@dashboard.tasksPendingWidget.errorMessage"
          ctaLabel="Retry"
          i18n-ctaLabel="@@dashboard.tasksPendingWidget.retryLabel"
          (cta)="load()"
        />
      } @else if (!loading() && data()?.length === 0) {
        <lf-empty-state
          icon="task_alt"
          title="No pending tasks"
          i18n-title="@@dashboard.tasksPendingWidget.emptyTitle"
        />
      } @else if (data()) {
        <div class="tasks-groups">
          @for (group of groups(); track group.bucket) {
            <section class="tasks-groups__section">
              <h4 class="tasks-groups__heading">{{ group.label }}</h4>
              <ul class="tasks-list">
                @for (task of group.items; track task.id) {
                  <li class="tasks-list__row">
                    <span class="tasks-list__title">{{ task.title }}</span>
                    <span class="tasks-list__meta">
                      @if (task.matterTitle) {
                        {{ task.matterTitle }} ·
                      }
                      {{ task.dueDate }}
                    </span>
                  </li>
                }
              </ul>
            </section>
          }
        </div>
      }
    </lf-dashboard-widget>
  `,
  styles: `
    .tasks-groups {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-3);
    }

    .tasks-groups__heading {
      margin: 0 0 var(--lf-space-1);
      font-size: var(--lf-text-sm);
      font-weight: 600;
      color: var(--lf-on-surface-variant);
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }

    .tasks-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-1);
    }

    .tasks-list__row {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .tasks-list__title {
      font-weight: 500;
      color: var(--lf-on-surface);
    }

    .tasks-list__meta {
      font-size: var(--lf-text-xs);
      color: var(--lf-on-surface-variant);
    }
  `,
})
export class TasksPendingWidgetComponent extends DashboardWidgetBase<TaskPendingItem[]> {
  private readonly widgetsService = inject(DashboardWidgetsService);

  private static readonly BUCKET_LABELS: Record<TaskPendingItem['bucket'], string> = {
    overdue: 'Overdue',
    today: 'Today',
    thisWeek: 'This Week',
  };

  readonly groups = computed<TaskBucketGroup[]>(() => {
    const items = this.data() ?? [];
    return (['overdue', 'today', 'thisWeek'] as const)
      .map((bucket) => ({
        bucket,
        label: TasksPendingWidgetComponent.BUCKET_LABELS[bucket],
        items: items.filter((item) => item.bucket === bucket),
      }))
      .filter((group) => group.items.length > 0);
  });

  protected fetch(): Observable<TaskPendingItem[]> {
    return this.widgetsService.tasksPending();
  }
}
