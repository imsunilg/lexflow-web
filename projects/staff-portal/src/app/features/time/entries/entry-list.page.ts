import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { debounceTime, distinctUntilChanged, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  ConfirmDialogComponent,
  DateRange,
  DateRangePickerComponent,
  EmptyStateComponent,
  LfCurrencyPipe,
  Matter,
  MattersService,
  StatusChipComponent,
  StatusChipTone,
  TIME_ENTRY_STATUSES,
  TimeEntriesService,
  TimeEntry,
  TimeEntryFilter,
  TimeEntryStatus,
} from 'shared';
import { TimeTabsComponent } from '../time-tabs.component';

type BillableFilter = 'all' | 'yes' | 'no';

const STATUS_TONES: Record<TimeEntryStatus, StatusChipTone> = {
  Draft: 'neutral',
  Submitted: 'warn',
  Approved: 'success',
  Rejected: 'error',
  Billed: 'info',
  WrittenOff: 'neutral',
};

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function truncate(text: string | null, maxLength: number): string {
  if (!text) return '—';
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

/**
 * Entry list (PRD Module 9 UI Components: "entry list with filters (status,
 * billable, matter, lawyer, range)"). `GET /time-entries` is a flat,
 * unpaginated array (see `TimeEntriesService`), so status/matter/date filters
 * are sent to the server while the billable filter — which has no server-side
 * parameter — is applied client-side over the returned rows.
 */
@Component({
  selector: 'lf-entry-list-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    DateRangePickerComponent,
    EmptyStateComponent,
    LfCurrencyPipe,
    StatusChipComponent,
    TimeTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './entry-list.page.html',
  styleUrl: './entry-list.page.scss',
})
export class EntryListPage {
  private readonly timeEntriesService = inject(TimeEntriesService);
  private readonly mattersService = inject(MattersService);
  private readonly dialog = inject(MatDialog);

  readonly statuses = TIME_ENTRY_STATUSES;

  readonly entries = signal<TimeEntry[]>([]);
  readonly loading = signal(true);
  readonly matterCache = signal<Map<string, string>>(new Map());
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly editingId = signal<string | null>(null);

  readonly statusControl = new FormControl<TimeEntryStatus | ''>('', { nonNullable: true });
  readonly billableControl = new FormControl<BillableFilter>('all', { nonNullable: true });
  readonly matterControl = new FormControl('', { nonNullable: true });
  readonly matterResults = signal<Matter[]>([]);
  private selectedMatterId: string | null = null;
  private from: string | null = null;
  private to: string | null = null;

  readonly editHours = new FormControl(0, { nonNullable: true });
  readonly editBillable = new FormControl(true, { nonNullable: true });
  readonly editNarrative = new FormControl('', { nonNullable: true });

  readonly billableFilter = signal<BillableFilter>('all');

  readonly visibleEntries = computed<TimeEntry[]>(() => {
    const filter = this.billableFilter();
    return this.entries()
      .filter((entry) => {
        if (filter === 'yes') return entry.billable;
        if (filter === 'no') return !entry.billable;
        return true;
      })
      .sort((a, b) => b.entryDate.localeCompare(a.entryDate));
  });

  readonly draftVisibleIds = computed(() =>
    this.visibleEntries()
      .filter((entry) => entry.status === 'Draft')
      .map((entry) => entry.id),
  );

  readonly allDraftsSelected = computed(() => {
    const ids = this.draftVisibleIds();
    return ids.length > 0 && ids.every((id) => this.selectedIds().has(id));
  });

  constructor() {
    this.load();

    this.statusControl.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.load());

    this.billableControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.billableFilter.set(value));

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
    const filter: TimeEntryFilter = {};
    if (this.statusControl.value) filter.status = this.statusControl.value;
    if (this.selectedMatterId) filter.matterId = this.selectedMatterId;
    if (this.from) filter.from = this.from;
    if (this.to) filter.to = this.to;

    this.timeEntriesService.list(filter).subscribe({
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

  matterLabel(matterId: string): string {
    return this.matterCache().get(matterId) ?? matterId;
  }

  onMatterSelected(event: MatAutocompleteSelectedEvent): void {
    const label = event.option.value as string;
    const matter = this.matterResults().find((m) => `${m.number} — ${m.title}` === label);
    if (!matter) return;
    this.selectedMatterId = matter.id;
    this.load();
  }

  clearMatterFilter(): void {
    this.selectedMatterId = null;
    this.matterControl.setValue('', { emitEvent: false });
    this.matterResults.set([]);
    this.load();
  }

  onDateRangeChange(range: DateRange): void {
    this.from = range.start ? toIsoDate(range.start) : null;
    this.to = range.end ? toIsoDate(range.end) : null;
    this.load();
  }

  hours(entry: TimeEntry): string {
    return (entry.roundedMin / 60).toFixed(2);
  }

  narrativePreview(entry: TimeEntry): string {
    return truncate(entry.narrative, 80);
  }

  statusTone(status: TimeEntryStatus): StatusChipTone {
    return STATUS_TONES[status];
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggleSelect(id: string, checked: boolean): void {
    const next = new Set(this.selectedIds());
    if (checked) next.add(id);
    else next.delete(id);
    this.selectedIds.set(next);
  }

  toggleSelectAllDrafts(checked: boolean): void {
    this.selectedIds.set(checked ? new Set(this.draftVisibleIds()) : new Set());
  }

  bulkSubmit(): void {
    const ids = [...this.selectedIds()];
    if (ids.length === 0) return;
    this.timeEntriesService.submit(ids).subscribe(() => {
      this.selectedIds.set(new Set());
      this.load();
    });
  }

  submitOne(entry: TimeEntry): void {
    this.timeEntriesService.submit([entry.id]).subscribe(() => this.load());
  }

  startEdit(entry: TimeEntry): void {
    this.editingId.set(entry.id);
    this.editHours.setValue(entry.durationMin / 60);
    this.editBillable.setValue(entry.billable);
    this.editNarrative.setValue(entry.narrative ?? '');
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  saveEdit(entry: TimeEntry): void {
    const durationMin = Math.round(this.editHours.value * 60);
    this.timeEntriesService
      .update(entry.id, {
        matterId: entry.matterId,
        activityCodeId: entry.activityCodeId,
        entryDate: entry.entryDate,
        durationMin,
        billable: this.editBillable.value,
        narrative: this.editNarrative.value,
        internalNote: entry.internalNote,
      })
      .subscribe(() => {
        this.editingId.set(null);
        this.load();
      });
  }

  deleteEntry(entry: TimeEntry): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Delete draft entry',
          message: `Delete this draft entry (${this.hours(entry)}h on ${entry.entryDate})? This cannot be undone.`,
          destructive: true,
          confirmLabel: 'Delete',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.timeEntriesService.delete(entry.id).subscribe(() => this.load());
      });
  }
}
