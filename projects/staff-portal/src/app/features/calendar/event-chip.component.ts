import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CalendarItem, StatusChipComponent } from 'shared';
import { calendarItemStyle } from './calendar-item-style.util';

/**
 * Reusable event chip + quick-view popover (PRD Module 6 UI Components:
 * "event chips with type icons ... event quick-view popover"). Used by every
 * grid view (month/week/day/agenda) so drag-lock and quick actions stay
 * consistent across them.
 */
@Component({
  selector: 'lf-event-chip',
  standalone: true,
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    StatusChipComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="event-chip"
      [attr.data-tone]="style.tone"
      [matMenuTriggerFor]="quickView"
      [matTooltip]="item().title"
    >
      <mat-icon class="event-chip__icon">{{ style.icon }}</mat-icon>
      <span class="event-chip__title">{{ item().title }}</span>
      @if (item().isLocked) {
        <mat-icon class="event-chip__lock" matTooltip="Locked — edit from its source module">
          lock
        </mat-icon>
      }
    </button>

    <mat-menu #quickView="matMenu" class="event-chip__quickview">
      <div class="event-chip__quickview-body">
        <div class="event-chip__quickview-header">
          <lf-status-chip [label]="item().itemKind" [toneOverride]="style.tone" />
          @if (item().isLocked) {
            <lf-status-chip label="Locked" toneOverride="neutral" />
          }
        </div>
        <p class="event-chip__quickview-title">{{ item().title }}</p>
        <p class="event-chip__quickview-time">
          {{ item().startsAt | date: 'medium' }}
          @if (item().endsAt) {
            – {{ item().endsAt | date: 'shortTime' }}
          }
        </p>
        @if (item().location) {
          <p class="event-chip__quickview-location">
            <mat-icon inline>place</mat-icon> {{ item().location }}
          </p>
        }
      </div>
      <button mat-menu-item type="button" (click)="viewRequested.emit(item())">
        <mat-icon>visibility</mat-icon> Open
      </button>
      @if (!item().isLocked && (item().itemKind === 'Meeting' || item().itemKind === 'Personal')) {
        <button mat-menu-item type="button" (click)="editRequested.emit(item())">
          <mat-icon>edit</mat-icon> Edit
        </button>
        <button mat-menu-item type="button" (click)="deleteRequested.emit(item())">
          <mat-icon>delete</mat-icon> Delete
        </button>
      }
    </mat-menu>
  `,
  styles: `
    .event-chip {
      display: flex;
      align-items: center;
      gap: 4px;
      width: 100%;
      padding: 2px 6px;
      border: none;
      border-radius: 6px;
      font: inherit;
      font-size: var(--lf-text-xs);
      text-align: left;
      cursor: pointer;
      overflow: hidden;
    }

    .event-chip__icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      flex-shrink: 0;
    }

    .event-chip__title {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .event-chip__lock {
      font-size: 12px;
      width: 12px;
      height: 12px;
      margin-left: auto;
      flex-shrink: 0;
    }

    .event-chip[data-tone='success'] {
      background: color-mix(in srgb, var(--lf-success) 18%, transparent);
      color: var(--lf-success);
    }
    .event-chip[data-tone='warn'] {
      background: color-mix(in srgb, var(--lf-warn) 18%, transparent);
      color: var(--lf-warn);
    }
    .event-chip[data-tone='error'] {
      background: color-mix(in srgb, var(--lf-error) 18%, transparent);
      color: var(--lf-error);
    }
    .event-chip[data-tone='info'] {
      background: color-mix(in srgb, var(--lf-info) 18%, transparent);
      color: var(--lf-info);
    }
    .event-chip[data-tone='neutral'] {
      background: var(--lf-surface-variant);
      color: var(--lf-on-surface-variant);
    }

    .event-chip__quickview-body {
      padding: var(--lf-space-2);
      min-width: 240px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .event-chip__quickview-header {
      display: flex;
      gap: 4px;
    }

    .event-chip__quickview-title {
      margin: 0;
      font-weight: 600;
    }

    .event-chip__quickview-time,
    .event-chip__quickview-location {
      margin: 0;
      font-size: var(--lf-text-xs);
      color: var(--lf-on-surface-variant);
      display: flex;
      align-items: center;
      gap: 4px;
    }
  `,
})
export class EventChipComponent {
  readonly item = input.required<CalendarItem>();

  readonly viewRequested = output<CalendarItem>();
  readonly editRequested = output<CalendarItem>();
  readonly deleteRequested = output<CalendarItem>();

  get style() {
    return calendarItemStyle(this.item().itemKind);
  }
}
