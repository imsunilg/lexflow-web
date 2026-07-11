import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CalendarItem } from 'shared';
import { EventChipComponent } from '../event-chip.component';

/**
 * Single-day column: 24 virtualized hourly rows + a non-scrolling all-day row
 * (PRD Module 6 "Views: Day/Week/Month/Agenda"). Same drop/chip contract as
 * `WeekViewComponent`, just one column instead of seven.
 */
@Component({
  selector: 'lf-calendar-day-view',
  standalone: true,
  imports: [CdkDrag, CdkDropList, CdkDropListGroup, ScrollingModule, DatePipe, EventChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './day-view.component.html',
  styleUrl: './day-view.component.scss',
})
export class DayViewComponent {
  readonly items = input.required<CalendarItem[]>();
  readonly anchorDate = input.required<Date>();

  readonly dropped = output<CdkDragDrop<Date, Date, CalendarItem>>();
  readonly viewRequested = output<CalendarItem>();
  readonly editRequested = output<CalendarItem>();
  readonly deleteRequested = output<CalendarItem>();
  readonly createRequested = output<Date>();

  readonly hours = Array.from({ length: 24 }, (_, i) => i);

  readonly day = computed<Date>(() => {
    const date = new Date(this.anchorDate());
    date.setHours(0, 0, 0, 0);
    return date;
  });

  readonly allDayItems = computed<CalendarItem[]>(() => this.items().filter((item) => item.allDay));

  readonly timedItemsByHour = computed<Map<number, CalendarItem[]>>(() => {
    const map = new Map<number, CalendarItem[]>();
    for (const item of this.items()) {
      if (item.allDay) continue;
      const hour = new Date(item.startsAt).getHours();
      const bucket = map.get(hour) ?? [];
      bucket.push(item);
      map.set(hour, bucket);
    }
    return map;
  });

  itemsFor(hour: number): CalendarItem[] {
    return this.timedItemsByHour().get(hour) ?? [];
  }

  slotDate(hour: number): Date {
    const day = this.day();
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour);
  }
}
