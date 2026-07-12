import { ScrollingModule } from '@angular/cdk/scrolling';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { debounceTime, distinctUntilChanged, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  API_BASE_URL,
  EmptyStateComponent,
  Matter,
  MattersService,
  OfflineMutationQueueService,
  PermissionService,
  TimeEntriesService,
  TimeEntry,
} from 'shared';
import { TimeTabsComponent } from '../time-tabs.component';

/** A conservative, documented-as-assumption daily target (no per-user target-hours source exists server-side — see `utilization.page.ts` for the same assumption). */
const DEFAULT_DAILY_TARGET_HOURS = 8;

interface MatterRow {
  matterId: string;
  matterLabel: string;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

/**
 * Weekly timesheet grid (PRD Module 9 UI Components: "timesheet grid
 * (virtualized, keyboard-first: arrows+enter)"). Rows are the matters that
 * have entries this week (plus an "Add matter" row); columns are the 7 days.
 * There's no matters×days grid endpoint — this is assembled client-side from
 * the flat `GET /time-entries` list (confirmed: no such aggregate endpoint
 * exists server-side).
 */
@Component({
  selector: 'lf-timesheet-grid-page',
  standalone: true,
  imports: [
    ScrollingModule,
    DatePipe,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    EmptyStateComponent,
    TimeTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './timesheet-grid.page.html',
  styleUrl: './timesheet-grid.page.scss',
})
export class TimesheetGridPage {
  private readonly timeEntriesService = inject(TimeEntriesService);
  private readonly mattersService = inject(MattersService);
  private readonly permissionService = inject(PermissionService);
  private readonly offlineQueue = inject(OfflineMutationQueueService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly apiBaseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/v1';

  readonly weekStart = signal(startOfWeek(new Date()));
  readonly entries = signal<TimeEntry[]>([]);
  readonly loading = signal(true);
  readonly matterCache = signal<Map<string, string>>(new Map());

  readonly matterControl = new FormControl('', { nonNullable: true });
  readonly matterResults = signal<Matter[]>([]);

  readonly days = computed<Date[]>(() =>
    Array.from({ length: 7 }, (_, i) => {
      const date = new Date(this.weekStart());
      date.setDate(date.getDate() + i);
      return date;
    }),
  );

  readonly rows = computed<MatterRow[]>(() => {
    const ids = new Set(this.entries().map((e) => e.matterId));
    const cache = this.matterCache();
    return [...ids]
      .map((matterId) => ({ matterId, matterLabel: cache.get(matterId) ?? matterId }))
      .sort((a, b) => a.matterLabel.localeCompare(b.matterLabel));
  });

  readonly entryByMatterAndDay = computed(() => {
    const map = new Map<string, TimeEntry>();
    for (const entry of this.entries()) {
      map.set(`${entry.matterId}-${entry.entryDate.slice(0, 10)}`, entry);
    }
    return map;
  });

  readonly dailyTotals = computed<number[]>(() =>
    this.days().map((day) => {
      const key = dayKey(day);
      return this.entries()
        .filter((e) => e.entryDate.slice(0, 10) === key)
        .reduce((sum, e) => sum + e.roundedMin, 0);
    }),
  );

  readonly weekTotalMinutes = computed(() => this.dailyTotals().reduce((a, b) => a + b, 0));
  readonly weekTargetMinutes = DEFAULT_DAILY_TARGET_HOURS * 7 * 60;

  readonly editingKey = signal<string | null>(null);
  readonly editHours = new FormControl(0, { nonNullable: true });

  constructor() {
    this.load();
    this.matterControl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => {
        if (!q) {
          this.matterResults.set([]);
          return;
        }
        this.mattersService.list({ q }).subscribe((matters) => this.matterResults.set(matters));
      });
  }

  load(): void {
    this.loading.set(true);
    const from = dayKey(this.weekStart());
    const to = dayKey(this.days()[6]);
    const me = this.permissionService.currentUser()?.id;
    this.timeEntriesService.list({ userId: me, from, to }).subscribe({
      next: (entries) => {
        this.entries.set(entries);
        this.hydrateMatterLabels(entries);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private hydrateMatterLabels(entries: TimeEntry[]): void {
    const cache = this.matterCache();
    const missing = [...new Set(entries.map((e) => e.matterId))].filter((id) => !cache.has(id));
    if (missing.length === 0) return;

    forkJoin(
      missing.map((id) => this.mattersService.get(id).pipe(catchError(() => of(null)))),
    ).subscribe((matters) => {
      const next = new Map(cache);
      matters.forEach((matter, i) => {
        if (matter) next.set(missing[i], `${matter.number} — ${matter.title}`);
      });
      this.matterCache.set(next);
    });
  }

  stepWeek(delta: number): void {
    const next = new Date(this.weekStart());
    next.setDate(next.getDate() + delta * 7);
    this.weekStart.set(next);
    this.load();
  }

  today(): void {
    this.weekStart.set(startOfWeek(new Date()));
    this.load();
  }

  cellKey(matterId: string, day: Date): string {
    return `${matterId}-${dayKey(day)}`;
  }

  entryFor(matterId: string, day: Date): TimeEntry | undefined {
    return this.entryByMatterAndDay().get(this.cellKey(matterId, day));
  }

  onAddMatterSelected(event: MatAutocompleteSelectedEvent): void {
    const label = event.option.value as string;
    const matter = this.matterResults().find((m) => `${m.number} — ${m.title}` === label);
    if (!matter) return;
    const cache = new Map(this.matterCache());
    cache.set(matter.id, label);
    this.matterCache.set(cache);
    // An empty row appears once any entry exists for the matter; a zero-duration
    // placeholder entry isn't created until the user actually edits a cell, so
    // just seed the label cache and let entries() catch up once the user adds one.
    this.entries.update((current) => [
      ...current,
      {
        id: `placeholder-${matter.id}`,
        userId: this.permissionService.currentUser()?.id ?? '',
        matterId: matter.id,
        activityCodeId: null,
        entryDate: dayKey(this.weekStart()),
        startedAt: null,
        durationMin: 0,
        roundedMin: 0,
        billable: true,
        narrative: null,
        internalNote: null,
        status: 'Draft',
        rateSnapshot: null,
        amountSnapshot: null,
        invoiceLineId: null,
        source: 'manual',
        approvedBy: null,
        approvedAt: null,
      },
    ]);
    this.matterControl.setValue('', { emitEvent: false });
    this.matterResults.set([]);
  }

  startEdit(matterId: string, day: Date): void {
    const entry = this.entryFor(matterId, day);
    if (entry && entry.status !== 'Draft') return;
    this.editingKey.set(this.cellKey(matterId, day));
    this.editHours.setValue(entry ? entry.durationMin / 60 : 0);
  }

  cancelEdit(): void {
    this.editingKey.set(null);
  }

  saveEdit(matterId: string, day: Date): void {
    const hours = this.editHours.value;
    const durationMin = Math.round(hours * 60);
    const existing = this.entryFor(matterId, day);
    const isPlaceholder = existing?.id.startsWith('placeholder-');

    if (existing && !isPlaceholder) {
      this.timeEntriesService
        .update(existing.id, {
          matterId,
          entryDate: dayKey(day),
          durationMin,
          billable: existing.billable,
          narrative: existing.narrative,
          internalNote: existing.internalNote,
        })
        .subscribe(() => {
          this.editingKey.set(null);
          this.load();
        });
      return;
    }

    if (durationMin <= 0) {
      this.editingKey.set(null);
      return;
    }

    const request = {
      matterId,
      entryDate: dayKey(day),
      durationMin,
      billable: true,
      narrative: 'Logged via timesheet grid',
    };

    this.timeEntriesService.create(request).subscribe({
      next: () => {
        this.editingKey.set(null);
        this.load();
      },
      error: () => this.queueEntryOffline(request),
    });
  }

  /** PRD §12 "background sync of queued notes/time entries": a failed create while offline is queued rather than lost — it replays automatically on reconnect (`OfflineMutationQueueService`'s `online` listener) or via the shell's offline-banner "Retry" button. */
  private queueEntryOffline(request: unknown): void {
    if (navigator.onLine) return;

    this.offlineQueue
      .enqueue({
        method: 'POST',
        url: `${this.apiBaseUrl}/time-entries`,
        body: request,
        label: 'Time entry',
      })
      .then(() => {
        this.editingKey.set(null);
        this.snackBar.open('Offline — this entry will sync automatically.', 'Dismiss', {
          duration: 4000,
        });
      });
  }

  copyLastWeek(): void {
    const previousFrom = new Date(this.weekStart());
    previousFrom.setDate(previousFrom.getDate() - 7);
    const previousTo = new Date(previousFrom);
    previousTo.setDate(previousTo.getDate() + 6);
    const me = this.permissionService.currentUser()?.id;

    this.timeEntriesService
      .list({ userId: me, from: dayKey(previousFrom), to: dayKey(previousTo) })
      .subscribe((previousEntries) => {
        const requests = previousEntries.map((entry) => {
          const shiftedDate = new Date(entry.entryDate);
          shiftedDate.setDate(shiftedDate.getDate() + 7);
          return this.timeEntriesService.create({
            matterId: entry.matterId,
            entryDate: dayKey(shiftedDate),
            durationMin: entry.durationMin,
            billable: entry.billable,
            narrative: entry.narrative,
            internalNote: entry.internalNote,
          });
        });
        if (requests.length === 0) return;
        forkJoin(requests).subscribe(() => this.load());
      });
  }

  onGridKeydown(event: KeyboardEvent, rowIndex: number, colIndex: number): void {
    const rows = this.rows();
    const days = this.days();
    let targetRow = rowIndex;
    let targetCol = colIndex;

    switch (event.key) {
      case 'ArrowRight':
        targetCol = Math.min(colIndex + 1, days.length - 1);
        break;
      case 'ArrowLeft':
        targetCol = Math.max(colIndex - 1, 0);
        break;
      case 'ArrowDown':
        targetRow = Math.min(rowIndex + 1, rows.length - 1);
        break;
      case 'ArrowUp':
        targetRow = Math.max(rowIndex - 1, 0);
        break;
      case 'Enter':
        this.startEdit(rows[rowIndex].matterId, days[colIndex]);
        return;
      default:
        return;
    }

    event.preventDefault();
    queueMicrotask(() => {
      const cell = document.querySelector<HTMLElement>(
        `[data-row="${targetRow}"][data-col="${targetCol}"]`,
      );
      cell?.focus();
    });
  }

  rowTotalHours(matterId: string): string {
    const total = this.days().reduce((sum, day) => {
      const entry = this.entryFor(matterId, day);
      return sum + (entry?.roundedMin ?? 0);
    }, 0);
    return (total / 60).toFixed(2);
  }

  barWidthPct(minutes: number, targetMinutes: number): number {
    if (targetMinutes <= 0) return 0;
    return Math.min(100, Math.round((minutes / targetMinutes) * 100));
  }
}
