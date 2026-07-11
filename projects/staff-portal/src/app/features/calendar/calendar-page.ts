import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import {
  CALENDAR_ITEM_KINDS,
  CALENDAR_SCOPES,
  CalendarEditScope,
  CalendarItem,
  CalendarItemKind,
  CalendarScope,
  CalendarService,
  CalendarViewMode,
  EmptyStateComponent,
  PermissionService,
} from 'shared';
import { EventChipComponent } from './event-chip.component';
import { EventDialogComponent, EventDialogData } from './dialogs/event-dialog.component';
import { RescheduleScopeDialogComponent } from './dialogs/reschedule-scope-dialog.component';
import { AgendaViewComponent } from './views/agenda-view.component';
import { DayViewComponent } from './views/day-view.component';
import { WeekViewComponent } from './views/week-view.component';

interface MonthCell {
  date: Date;
  inMonth: boolean;
  key: string;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - result.getDay());
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Calendar grid shell (PRD Module 6). Renders a custom month view (no
 * third-party calendar dependency) with drag-to-reschedule; week/day/agenda
 * views are separate components swapped in via the view-mode switcher.
 * Hearings/Deadlines are locked — `EventChipComponent` disables their drag
 * handle and the quick-view menu hides Edit/Delete for anything but native
 * Meeting/Personal events (PRD Validation Rules: "drag-reschedule of hearings
 * forbidden").
 */
@Component({
  selector: 'lf-staff-calendar-page',
  standalone: true,
  imports: [
    CdkDrag,
    CdkDropList,
    CdkDropListGroup,
    DatePipe,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatMenuModule,
    MatProgressBarModule,
    MatTooltipModule,
    EmptyStateComponent,
    EventChipComponent,
    WeekViewComponent,
    DayViewComponent,
    AgendaViewComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './calendar-page.html',
  styleUrl: './calendar-page.scss',
})
export class CalendarPage {
  private readonly calendarService = inject(CalendarService);
  private readonly permissionService = inject(PermissionService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  readonly itemKinds = CALENDAR_ITEM_KINDS;
  readonly scopes = CALENDAR_SCOPES;

  readonly viewMode = signal<CalendarViewMode>('month');
  readonly anchorDate = signal(new Date());
  readonly scope = signal<CalendarScope>('Me');
  readonly activeKinds = signal<Set<CalendarItemKind>>(new Set(CALENDAR_ITEM_KINDS));

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly items = signal<CalendarItem[]>([]);

  readonly canViewTeam = computed(() => this.permissionService.has('calendar.read.team'));
  readonly canViewFirm = computed(() => this.permissionService.has('calendar.read.all'));

  readonly rangeFrom = computed(() => this.computeRange().from);
  readonly rangeTo = computed(() => this.computeRange().to);

  readonly monthGrid = computed<MonthCell[]>(() => {
    const anchor = this.anchorDate();
    const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const gridStart = startOfWeek(monthStart);
    const cells: MonthCell[] = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(gridStart);
      date.setDate(date.getDate() + i);
      cells.push({ date, inMonth: date.getMonth() === anchor.getMonth(), key: dateKey(date) });
    }
    return cells;
  });

  readonly monthWeeks = computed<MonthCell[][]>(() => {
    const cells = this.monthGrid();
    const weeks: MonthCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    return weeks;
  });

  readonly filteredItems = computed(() =>
    this.items().filter((item) => this.activeKinds().has(item.itemKind)),
  );

  readonly itemsByDay = computed<Map<string, CalendarItem[]>>(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of this.filteredItems()) {
      const key = item.startsAt.slice(0, 10);
      const bucket = map.get(key) ?? [];
      bucket.push(item);
      map.set(key, bucket);
    }
    return map;
  });

  constructor() {
    this.load();
  }

  private computeRange(): { from: Date; to: Date } {
    const anchor = this.anchorDate();
    switch (this.viewMode()) {
      case 'day': {
        const from = new Date(anchor);
        from.setHours(0, 0, 0, 0);
        const to = new Date(from);
        to.setDate(to.getDate() + 1);
        return { from, to };
      }
      case 'week': {
        const from = startOfWeek(anchor);
        const to = new Date(from);
        to.setDate(to.getDate() + 7);
        return { from, to };
      }
      case 'agenda': {
        const from = new Date(anchor);
        from.setHours(0, 0, 0, 0);
        const to = new Date(from);
        to.setDate(to.getDate() + 30);
        return { from, to };
      }
      case 'month':
      default: {
        const cells = this.monthGrid();
        return {
          from: cells[0].date,
          to: new Date(cells[cells.length - 1].date.getTime() + 86400000),
        };
      }
    }
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    const { from, to } = this.computeRange();
    this.calendarService
      .list(from.toISOString(), to.toISOString(), undefined, this.scope())
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (items) => {
          this.items.set(items);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }

  setViewMode(mode: CalendarViewMode): void {
    this.viewMode.set(mode);
    this.load();
  }

  setScope(scope: CalendarScope): void {
    this.scope.set(scope);
    this.load();
  }

  toggleKind(kind: CalendarItemKind): void {
    this.activeKinds.update((current) => {
      const next = new Set(current);
      if (next.has(kind)) {
        next.delete(kind);
      } else {
        next.add(kind);
      }
      return next;
    });
  }

  today(): void {
    this.anchorDate.set(new Date());
    this.load();
  }

  step(delta: number): void {
    const anchor = new Date(this.anchorDate());
    switch (this.viewMode()) {
      case 'day':
        anchor.setDate(anchor.getDate() + delta);
        break;
      case 'week':
        anchor.setDate(anchor.getDate() + delta * 7);
        break;
      case 'agenda':
        anchor.setDate(anchor.getDate() + delta * 30);
        break;
      case 'month':
      default:
        anchor.setMonth(anchor.getMonth() + delta);
        break;
    }
    this.anchorDate.set(anchor);
    this.load();
  }

  createEvent(initialDate?: Date): void {
    this.dialog
      .open<EventDialogComponent, EventDialogData>(EventDialogComponent, {
        data: { mode: 'create', initialDate },
      })
      .afterClosed()
      .subscribe((created) => {
        if (created) this.load();
      });
  }

  openItem(item: CalendarItem): void {
    if (item.itemKind === 'Hearing') {
      this.router.navigate(['/matters'], { queryParams: { q: item.title } });
      return;
    }
    this.editItem(item);
  }

  editItem(item: CalendarItem): void {
    if (item.isLocked) return;
    this.calendarService.getEvent(item.id).subscribe((event) => {
      this.dialog
        .open<EventDialogComponent, EventDialogData>(EventDialogComponent, {
          data: { mode: 'edit', event },
        })
        .afterClosed()
        .subscribe((saved) => {
          if (saved) this.load();
        });
    });
  }

  deleteItem(item: CalendarItem): void {
    if (item.isLocked) return;
    this.calendarService.getEvent(item.id).subscribe((event) => {
      const proceedWithScope = (scope?: CalendarEditScope) => {
        this.calendarService
          .deleteEvent(item.id, scope, item.startsAt.slice(0, 10))
          .subscribe(() => {
            this.load();
          });
      };
      if (event.rrule) {
        this.dialog
          .open(RescheduleScopeDialogComponent, { data: { title: item.title } })
          .afterClosed()
          .subscribe((scope?: CalendarEditScope) => {
            if (scope) proceedWithScope(scope);
          });
      } else {
        proceedWithScope();
      }
    });
  }

  onDrop(event: CdkDragDrop<Date, Date, CalendarItem>): void {
    const item = event.item.data as CalendarItem;
    const targetDate = event.container.data;
    if (!targetDate || item.isLocked) return;

    const originalDate = new Date(item.startsAt);
    if (dateKey(originalDate) === dateKey(targetDate)) return;

    const newStart = new Date(targetDate);
    // Month/agenda drop targets are bare days (midnight); preserve the item's
    // original time-of-day. Week/day drop targets already carry the exact
    // hour slot, so they're used as-is.
    if (this.viewMode() === 'month' || this.viewMode() === 'agenda') {
      newStart.setHours(originalDate.getHours(), originalDate.getMinutes(), 0, 0);
    }
    const durationMs = item.endsAt
      ? new Date(item.endsAt).getTime() - originalDate.getTime()
      : 60 * 60 * 1000;
    const newEnd = new Date(newStart.getTime() + durationMs);

    // Optimistic move; rolled back on error (same pattern as the Leads Kanban board).
    const previousItems = this.items();
    this.items.update((current) =>
      current.map((entry) =>
        entry.id === item.id
          ? { ...entry, startsAt: newStart.toISOString(), endsAt: newEnd.toISOString() }
          : entry,
      ),
    );

    this.calendarService.getEvent(item.id).subscribe({
      next: (fullEvent) => {
        const commit = (scope?: CalendarEditScope) => {
          this.calendarService
            .updateEvent(
              item.id,
              {
                title: fullEvent.title,
                startsAt: newStart.toISOString(),
                endsAt: newEnd.toISOString(),
                allDay: fullEvent.allDay,
                location: fullEvent.location,
                videoLink: fullEvent.videoLink,
                rrule: fullEvent.rrule,
              },
              scope,
              dateKey(originalDate),
            )
            .subscribe({
              error: () => this.items.set(previousItems),
            });
        };

        if (fullEvent.rrule) {
          this.dialog
            .open(RescheduleScopeDialogComponent, { data: { title: item.title } })
            .afterClosed()
            .subscribe((scope?: CalendarEditScope) => {
              if (scope) {
                commit(scope);
              } else {
                this.items.set(previousItems);
              }
            });
        } else {
          commit();
        }
      },
      error: () => this.items.set(previousItems),
    });
  }
}
