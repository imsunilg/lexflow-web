import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  DashboardWidgetComponent,
  DashboardWidgetsService,
  EmptyStateComponent,
  HearingTodayItem,
} from 'shared';
import { DashboardWidgetBase } from './dashboard-widget-base';

/** Widget 1/12: Today's Hearings (PRD Module 1). */
@Component({
  selector: 'lf-hearings-today-widget',
  standalone: true,
  imports: [DashboardWidgetComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lf-dashboard-widget title="Today's Hearings" [loading]="loading()" (refresh)="load()">
      @if (error()) {
        <lf-empty-state
          icon="error_outline"
          title="Couldn't load today's hearings"
          message="Something went wrong."
          ctaLabel="Retry"
          (cta)="load()"
        />
      } @else if (!loading() && data()?.length === 0) {
        <lf-empty-state icon="event_available" title="No hearings scheduled today" />
      } @else if (data()) {
        <ul class="hearings-list">
          @for (hearing of data(); track hearing.id) {
            <li class="hearings-list__row">
              <span class="hearings-list__time">{{ hearing.time }}</span>
              <span class="hearings-list__details">
                <strong>{{ hearing.caseNumber }}</strong> — {{ hearing.matterTitle }}
                <span class="hearings-list__meta"
                  >{{ hearing.courtName }} · {{ hearing.clientName }}</span
                >
              </span>
              @if (!hearing.assignedLawyerName) {
                <span class="hearings-list__unassigned">Unassigned</span>
              }
            </li>
          }
        </ul>
      }
    </lf-dashboard-widget>
  `,
  styles: `
    .hearings-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-1);
    }

    .hearings-list__row {
      display: flex;
      align-items: baseline;
      gap: var(--lf-space-2);
    }

    .hearings-list__time {
      font-weight: 600;
      min-width: 4.5em;
    }

    .hearings-list__details {
      flex: 1;
    }

    .hearings-list__meta {
      display: block;
      color: var(--lf-on-surface-variant);
      font-size: var(--lf-text-xs);
    }

    .hearings-list__unassigned {
      color: var(--lf-error);
      font-size: var(--lf-text-xs);
      font-weight: 600;
    }
  `,
})
export class HearingsTodayWidgetComponent extends DashboardWidgetBase<HearingTodayItem[]> {
  private readonly widgetsService = inject(DashboardWidgetsService);

  protected fetch(): Observable<HearingTodayItem[]> {
    return this.widgetsService.hearingsToday();
  }
}
