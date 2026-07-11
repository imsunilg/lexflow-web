import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CalendarItem } from 'shared';
import { EventChipComponent } from '../event-chip.component';

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Week grid: 7 day-columns x 24 virtualized hourly rows + a non-scrolling
 * all-day row above them (PRD Module 6 "Views: Day/Week/Month/Agenda"). Reuses
 * `EventChipComponent` for every chip so drag-lock/quick-view stay consistent
 * with month view.
 */
@Component({
  selector: 'lf-calendar-week-view',
  standalone: true,
  imports: [CdkDrag, CdkDropList, CdkDropListGroup, ScrollingModule, DatePipe, EventChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './week-view.component.html',
  styleUrl: './week-view.component.scss',
})
export class WeekViewComponent {
  readonly items = input.required<CalendarItem[]>();
  readonly anchorDate = input.required<Date>();

  readonly dropped = output<CdkDragDrop<Date, Date, CalendarItem>>();
  readonly viewRequested = output<CalendarItem>();
  readonly editRequested = output<CalendarItem>();
  readonly deleteRequested = output<CalendarItem>();
  readonly createRequested = output<Date>();

  readonly hours = Array.from({ length: 24 }, (_, i) => i);

  readonly days = computed<Date[]>(() => {
    const start = startOfWeek(this.anchorDate());
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      return date;
    });
  });

  readonly allDayItemsByDay = computed<Map<string, CalendarItem[]>>(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of this.items()) {
      if (!item.allDay) continue;
      const key = dayKey(new Date(item.startsAt));
      const bucket = map.get(key) ?? [];
      bucket.push(item);
      map.set(key, bucket);
    }
    return map;
  });

  readonly timedItemsByDayHour = computed<Map<string, CalendarItem[]>>(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of this.items()) {
      if (item.allDay) continue;
      const start = new Date(item.startsAt);
      const key = `${dayKey(start)}-${start.getHours()}`;
      const bucket = map.get(key) ?? [];
      bucket.push(item);
      map.set(key, bucket);
    }
    return map;
  });

  dayKey(date: Date): string {
    return dayKey(date);
  }

  itemsFor(day: Date, hour: number): CalendarItem[] {
    return this.timedItemsByDayHour().get(`${dayKey(day)}-${hour}`) ?? [];
  }

  slotDate(day: Date, hour: number): Date {
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour);
  }
}
