import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import {
  DataTableColumn,
  DataTableComponent,
  DateRange,
  DateRangePickerComponent,
  EmptyStateComponent,
  Lead,
  LEAD_PIPELINE_STAGES,
  LeadListFilter,
  LeadLookupsService,
  LeadSource,
  LeadsService,
  SavedLeadView,
  SavedLeadViewsService,
} from 'shared';
import {
  LeadFormDialogComponent,
  LeadFormDialogResult,
} from '../dialogs/lead-form-dialog.component';
import { LeadsTabsComponent } from '../leads-tabs.component';

type LeadRow = Lead & Record<string, unknown>;

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'short',
  timeStyle: 'short',
});

/**
 * Leads list view (PRD Module 2 UI Components: "list view (server-side
 * sort/filter/paginate, saved views)"). The `/leads` endpoint returns a flat
 * array (no server-side paging envelope), so all matching rows are fetched
 * for the current filter and handed to `DataTableComponent`, which paginates
 * (or virtualizes past 100 rows) entirely client-side.
 */
@Component({
  selector: 'lf-staff-leads-list-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    DataTableComponent,
    DateRangePickerComponent,
    EmptyStateComponent,
    LeadsTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './leads-list.page.html',
  styleUrl: './leads-list.page.scss',
})
export class LeadsListPage {
  private readonly leadsService = inject(LeadsService);
  private readonly leadLookupsService = inject(LeadLookupsService);
  private readonly savedLeadViewsService = inject(SavedLeadViewsService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  readonly stages = LEAD_PIPELINE_STAGES;
  readonly statuses: Array<'Open' | 'Converted' | 'Lost'> = ['Open', 'Converted', 'Lost'];
  readonly sources = signal<LeadSource[]>([]);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly leads = signal<Lead[]>([]);
  readonly savedViews = this.savedLeadViewsService.views;

  readonly savingViewName = signal(false);
  readonly newViewName = new FormControl('', { nonNullable: true });

  private createdFrom: string | null = null;
  private createdTo: string | null = null;

  readonly form = new FormGroup({
    q: new FormControl('', { nonNullable: true }),
    stage: new FormControl('', { nonNullable: true }),
    source: new FormControl('', { nonNullable: true }),
    status: new FormControl('', { nonNullable: true }),
  });

  readonly columns: DataTableColumn<LeadRow>[] = [
    { key: 'number', header: 'Number', sortable: true },
    {
      key: 'name',
      header: 'Name',
      cell: (row) => `${row.firstName} ${row.lastName ?? ''}`.trim(),
    },
    { key: 'company', header: 'Company', cell: (row) => row.company ?? '—' },
    { key: 'email', header: 'Email', cell: (row) => row.email ?? '—' },
    { key: 'phoneE164', header: 'Phone', cell: (row) => row.phoneE164 ?? '—' },
    { key: 'stage', header: 'Stage', sortable: true },
    { key: 'score', header: 'Score', sortable: true, cell: (row) => String(row.score) },
    { key: 'status', header: 'Status', sortable: true },
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      cell: (row) => DATE_FORMATTER.format(new Date(row.createdAt)),
    },
  ];

  readonly rows = computed(() => this.leads() as LeadRow[]);

  constructor() {
    this.leadLookupsService
      .sources()
      .pipe(takeUntilDestroyed())
      .subscribe((sources) => this.sources.set(sources));

    this.form.controls.q.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.load());

    this.load();
  }

  private currentFilter(): LeadListFilter {
    const value = this.form.getRawValue();
    const filter: LeadListFilter = {};
    if (value.q) {
      filter.q = value.q;
    }
    if (value.stage) {
      filter.stage = value.stage;
    }
    if (value.source) {
      filter.source = value.source;
    }
    if (value.status) {
      filter.status = value.status;
    }
    if (this.createdFrom) {
      filter.createdFrom = this.createdFrom;
    }
    if (this.createdTo) {
      filter.createdTo = this.createdTo;
    }
    return filter;
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.leadsService
      .list(this.currentFilter())
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (leads) => {
          this.leads.set(leads);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }

  onDateRangeChange(range: DateRange): void {
    this.createdFrom = range.start ? this.toIsoDate(range.start) : null;
    this.createdTo = range.end ? this.toIsoDate(range.end) : null;
    this.load();
  }

  private toIsoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  clearFilters(): void {
    this.form.reset({ q: '', stage: '', source: '', status: '' });
    this.createdFrom = null;
    this.createdTo = null;
    this.load();
  }

  openLead(lead: LeadRow): void {
    this.router.navigate(['/leads', lead.id]);
  }

  createLead(): void {
    this.dialog
      .open<LeadFormDialogComponent, unknown, LeadFormDialogResult>(LeadFormDialogComponent)
      .afterClosed()
      .subscribe((result) => {
        if (result?.outcome === 'saved') {
          this.load();
        } else if (result?.outcome === 'attached-to-existing') {
          this.router.navigate(['/leads', result.leadId]);
        }
      });
  }

  startSavingView(): void {
    this.savingViewName.set(true);
  }

  cancelSavingView(): void {
    this.savingViewName.set(false);
    this.newViewName.setValue('');
  }

  confirmSaveView(): void {
    const name = this.newViewName.value.trim();
    if (!name) {
      return;
    }
    this.savedLeadViewsService.save(name, this.currentFilter());
    this.savingViewName.set(false);
    this.newViewName.setValue('');
  }

  applySavedView(view: SavedLeadView): void {
    this.form.reset({
      q: view.filter.q ?? '',
      stage: view.filter.stage ?? '',
      source: view.filter.source ?? '',
      status: view.filter.status ?? '',
    });
    this.createdFrom = view.filter.createdFrom ?? null;
    this.createdTo = view.filter.createdTo ?? null;
    this.load();
  }

  removeSavedView(view: SavedLeadView, event: Event): void {
    event.stopPropagation();
    this.savedLeadViewsService.remove(view.id);
  }

  export(format: 'csv' | 'xlsx'): void {
    this.leadsService.export(this.currentFilter(), format).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `leads.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    });
  }
}
