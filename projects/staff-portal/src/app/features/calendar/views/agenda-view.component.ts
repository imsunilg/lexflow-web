import { ScrollingModule } from '@angular/cdk/scrolling';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CalendarItem } from 'shared';
import { EventChipComponent } from '../event-chip.component';

type AgendaRow =
  { kind: 'header'; key: string; date: Date } | { kind: 'item'; key: string; item: CalendarItem };

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Flat, virtualized chronological list grouped under day headers, spanning
 * a rolling ~30-day window from `anchorDate()` (PRD Module 6 "Views: ...
 * Agenda"). Read/click-only — no `cdkDropList` here, rescheduling by drag
 * doesn't make sense in a flat list, so `dropped` is never emitted. Days with
 * zero items are skipped entirely rather than rendering an empty header.
 */
@Component({
  selector: 'lf-calendar-agenda-view',
  standalone: true,
  imports: [ScrollingModule, DatePipe, MatButtonModule, MatIconModule, EventChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agenda-view.component.html',
  styleUrl: './agenda-view.component.scss',
})
export class AgendaViewComponent {
  readonly items = input.required<CalendarItem[]>();
  readonly anchorDate = input.required<Date>();

  readonly viewRequested = output<CalendarItem>();
  readonly editRequested = output<CalendarItem>();
  readonly deleteRequested = output<CalendarItem>();
  readonly createRequested = output<Date>();

  readonly rows = computed<AgendaRow[]>(() => {
    const start = new Date(this.anchorDate());
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 30);

    const byDay = new Map<string, CalendarItem[]>();
    for (const item of this.items()) {
      const startsAt = new Date(item.startsAt);
      if (startsAt < start || startsAt >= end) continue;
      const key = dayKey(startsAt);
      const bucket = byDay.get(key) ?? [];
      bucket.push(item);
      byDay.set(key, bucket);
    }
    for (const bucket of byDay.values()) {
      bucket.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    }

    const rows: AgendaRow[] = [];
    for (let cursor = new Date(start); cursor < end; cursor.setDate(cursor.getDate() + 1)) {
      const key = dayKey(cursor);
      const dayItems = byDay.get(key);
      if (!dayItems || dayItems.length === 0) continue;
      const date = new Date(cursor);
      rows.push({ kind: 'header', key: `h-${key}`, date });
      for (const item of dayItems) {
        rows.push({ kind: 'item', key: `i-${item.id}`, item });
      }
    }
    return rows;
  });

  trackByKey(_index: number, row: AgendaRow): string {
    return row.key;
  }
}
