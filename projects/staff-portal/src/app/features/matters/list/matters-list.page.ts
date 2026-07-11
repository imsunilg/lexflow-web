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
  EmptyStateComponent,
  Matter,
  MATTER_PRIORITIES,
  MATTER_STATUSES,
  MATTER_TYPES,
  MatterFilter,
  MatterPriority,
  MatterStatus,
  MatterType,
  MattersService,
  SavedMatterView,
  SavedMatterViewsService,
} from 'shared';
import { CreateMatterDialogComponent } from '../dialogs/create-matter-dialog.component';

type MatterRow = Matter & Record<string, unknown>;

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

/**
 * Matter list view (PRD Module 4 UI Components: "Matter list (table + filters:
 * status/type/area/lawyer/court/priority/aging; saved views; bulk actions:
 * reassign, export)"). Built against what `MatterFilter` actually supports —
 * status/matterType/priority/q. The "court" and "aging" filters and the bulk
 * reassign/export actions have no corresponding `MatterFilter` field or API,
 * so they're intentionally not implemented here (see final report).
 * `practiceAreaId`/`lawyerId` filters are skipped too since no lookup source
 * exists yet for either (same reasoning the Clients list uses to skip
 * owner/branch filters).
 */
@Component({
  selector: 'lf-staff-matters-list-page',
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
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './matters-list.page.html',
  styleUrl: './matters-list.page.scss',
})
export class MattersListPage {
  private readonly mattersService = inject(MattersService);
  private readonly savedMatterViewsService = inject(SavedMatterViewsService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  readonly statuses = MATTER_STATUSES;
  readonly matterTypes = MATTER_TYPES;
  readonly priorities = MATTER_PRIORITIES;

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly matters = signal<Matter[]>([]);
  readonly savedViews = this.savedMatterViewsService.views;

  readonly savingViewName = signal(false);
  readonly newViewName = new FormControl('', { nonNullable: true });

  readonly form = new FormGroup({
    q: new FormControl('', { nonNullable: true }),
    status: new FormControl<MatterStatus | ''>('', { nonNullable: true }),
    matterType: new FormControl<MatterType | ''>('', { nonNullable: true }),
    priority: new FormControl<MatterPriority | ''>('', { nonNullable: true }),
  });

  readonly columns: DataTableColumn<MatterRow>[] = [
    { key: 'number', header: 'Number', sortable: true },
    { key: 'title', header: 'Title' },
    { key: 'matterType', header: 'Type', sortable: true },
    { key: 'priority', header: 'Priority' },
    { key: 'status', header: 'Status' },
    {
      key: 'openedOn',
      header: 'Opened',
      sortable: true,
      cell: (row) => DATE_FORMATTER.format(new Date(row.openedOn)),
    },
  ];

  readonly rows = computed(() => this.matters() as MatterRow[]);

  constructor() {
    this.form.controls.q.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.load());

    this.load();
  }

  private currentFilter(): MatterFilter {
    const value = this.form.getRawValue();
    const filter: MatterFilter = {};
    if (value.q) {
      filter.q = value.q;
    }
    if (value.status) {
      filter.status = value.status;
    }
    if (value.matterType) {
      filter.matterType = value.matterType;
    }
    if (value.priority) {
      filter.priority = value.priority;
    }
    return filter;
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.mattersService
      .list(this.currentFilter())
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (matters) => {
          this.matters.set(matters);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }

  clearFilters(): void {
    this.form.reset({ q: '', status: '', matterType: '', priority: '' });
    this.load();
  }

  openMatter(matter: MatterRow): void {
    this.router.navigate(['/matters', matter.id]);
  }

  createMatter(): void {
    this.dialog
      .open<CreateMatterDialogComponent, unknown, Matter | undefined>(CreateMatterDialogComponent)
      .afterClosed()
      .subscribe((matter) => {
        if (matter) {
          this.router.navigate(['/matters', matter.id]);
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
    this.savedMatterViewsService.save(name, this.currentFilter());
    this.savingViewName.set(false);
    this.newViewName.setValue('');
  }

  applySavedView(view: SavedMatterView): void {
    this.form.reset({
      q: view.filter.q ?? '',
      status: view.filter.status ?? '',
      matterType: view.filter.matterType ?? '',
      priority: view.filter.priority ?? '',
    });
    this.load();
  }

  removeSavedView(view: SavedMatterView, event: Event): void {
    event.stopPropagation();
    this.savedMatterViewsService.remove(view.id);
  }
}
