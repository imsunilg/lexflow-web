import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatStepperModule } from '@angular/material/stepper';
import { ActivatedRoute, Router } from '@angular/router';
import {
  CUSTOM_REPORT_AGGREGATE_FUNCTIONS,
  CUSTOM_REPORT_FILTER_OPERATORS,
  CustomReportAggregate,
  CustomReportFilter,
  CustomReportSort,
  CustomReportsService,
  REPORT_BASE_ENTITIES,
  REPORT_FIELD_CATALOG,
  REPORT_VISIBILITIES,
  ReportBaseEntity,
  ReportResult,
  ReportVisibility,
  ReportsService,
} from 'shared';
import { ReportsTabsComponent } from '../reports-tabs.component';

/**
 * 4-step custom report builder (PRD Module 13: "custom builder (4-step
 * wizard)"). Steps: (1) name + base entity, (2) columns + group-by +
 * aggregates, (3) filters + sort, (4) save + preview.
 *
 * Scope note: the backend supports arbitrarily nested AND/OR filter groups
 * (`CustomReportFilterGroup.Groups`), but this builder only exposes a single
 * flat AND/OR group — nesting is a real capability left for a future editor
 * pass, not a backend gap.
 *
 * There's no dry-run-without-saving endpoint (`RunCustomAsync` always takes a
 * saved definition id), so "preview" here means: Save creates/updates the
 * definition immediately, then Preview runs it. There's also no single-get
 * endpoint for a definition — editing an existing one loads it out of the
 * full `GET /reports/custom` list.
 */
@Component({
  selector: 'lf-custom-report-builder-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatStepperModule,
    ReportsTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './custom-report-builder.page.html',
  styleUrl: './custom-report-builder.page.scss',
})
export class CustomReportBuilderPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly customReportsService = inject(CustomReportsService);
  private readonly reportsService = inject(ReportsService);

  readonly baseEntities = REPORT_BASE_ENTITIES;
  readonly visibilities = REPORT_VISIBILITIES;
  readonly aggregateFunctions = CUSTOM_REPORT_AGGREGATE_FUNCTIONS;
  readonly filterOperators = CUSTOM_REPORT_FILTER_OPERATORS;

  readonly definitionId = signal<string | null>(null);
  readonly loading = signal(false);

  readonly basicsForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    baseEntity: new FormControl<ReportBaseEntity>('Matter', { nonNullable: true }),
    visibility: new FormControl<ReportVisibility>('private', { nonNullable: true }),
  });

  readonly fields = computed(() => REPORT_FIELD_CATALOG[this.basicsForm.controls.baseEntity.value]);

  readonly selectedColumns = signal<Set<string>>(new Set());
  readonly groupBy = signal<Set<string>>(new Set());
  readonly aggregates = signal<CustomReportAggregate[]>([]);

  readonly filterLogic = new FormControl<'AND' | 'OR'>('AND', { nonNullable: true });
  readonly filters = signal<CustomReportFilter[]>([]);
  readonly sort = signal<CustomReportSort[]>([]);

  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly running = signal(false);
  readonly runError = signal<string | null>(null);
  readonly previewResult = signal<ReportResult | null>(null);

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.definitionId.set(id);
      this.loading.set(true);
      this.customReportsService.list().subscribe((defs) => {
        const found = defs.find((d) => d.id === id);
        this.loading.set(false);
        if (!found) return;
        const def = found.definition;
        this.basicsForm.setValue({
          name: found.name,
          baseEntity: found.baseEntity as ReportBaseEntity,
          visibility: found.visibility as ReportVisibility,
        });
        this.selectedColumns.set(new Set(def.columns));
        this.groupBy.set(new Set(def.groupBy));
        this.aggregates.set(def.aggregates);
        this.filters.set(def.filter?.filters ?? []);
        this.filterLogic.setValue((def.filter?.logic as 'AND' | 'OR') ?? 'AND');
        this.sort.set(def.sort);
      });
    }
  }

  toggleColumn(key: string): void {
    this.selectedColumns.update((cols) => {
      const updated = new Set(cols);
      if (updated.has(key)) updated.delete(key);
      else updated.add(key);
      return updated;
    });
  }

  toggleGroupBy(key: string): void {
    this.groupBy.update((keys) => {
      const updated = new Set(keys);
      if (updated.has(key)) updated.delete(key);
      else updated.add(key);
      return updated;
    });
  }

  addAggregate(): void {
    const field = this.fields()[0]?.key;
    if (!field) return;
    this.aggregates.update((rows) => [...rows, { field, function: 'sum', alias: null }]);
  }

  updateAggregate(index: number, patch: Partial<CustomReportAggregate>): void {
    this.aggregates.update((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  removeAggregate(index: number): void {
    this.aggregates.update((rows) => rows.filter((_, i) => i !== index));
  }

  addFilter(): void {
    const field = this.fields()[0]?.key;
    if (!field) return;
    this.filters.update((rows) => [...rows, { field, operator: 'eq', value: '' }]);
  }

  updateFilter(index: number, patch: Partial<CustomReportFilter>): void {
    this.filters.update((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  removeFilter(index: number): void {
    this.filters.update((rows) => rows.filter((_, i) => i !== index));
  }

  addSort(): void {
    const field = this.fields()[0]?.key;
    if (!field) return;
    this.sort.update((rows) => [...rows, { field, descending: false }]);
  }

  updateSort(index: number, patch: Partial<CustomReportSort>): void {
    this.sort.update((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  removeSort(index: number): void {
    this.sort.update((rows) => rows.filter((_, i) => i !== index));
  }

  save(): void {
    if (this.basicsForm.invalid || this.selectedColumns().size === 0) {
      this.basicsForm.markAllAsTouched();
      this.saveError.set('Give this report a name and at least one column.');
      return;
    }

    this.saving.set(true);
    this.saveError.set(null);
    const basics = this.basicsForm.getRawValue();
    const input = {
      name: basics.name,
      baseEntity: basics.baseEntity,
      columns: [...this.selectedColumns()],
      filter:
        this.filters().length > 0
          ? { logic: this.filterLogic.value, filters: this.filters() }
          : null,
      groupBy: [...this.groupBy()],
      aggregates: this.aggregates(),
      sort: this.sort(),
      visibility: basics.visibility,
    };

    const save$ = this.definitionId()
      ? this.customReportsService.update(this.definitionId()!, input)
      : this.customReportsService.create(input);

    save$.subscribe({
      next: (def) => {
        this.saving.set(false);
        this.definitionId.set(def.id);
      },
      error: () => {
        this.saving.set(false);
        this.saveError.set('Could not save this report definition.');
      },
    });
  }

  preview(): void {
    const id = this.definitionId();
    if (!id) return;
    this.running.set(true);
    this.runError.set(null);
    this.previewResult.set(null);
    this.reportsService.runCustom(id).subscribe({
      next: (outcome) => {
        this.running.set(false);
        if (outcome.inlineResult) {
          this.previewResult.set(outcome.inlineResult);
        } else {
          this.runError.set(
            'This report ran as a background job — open it from My Reports to export once complete.',
          );
        }
      },
      error: () => {
        this.running.set(false);
        this.runError.set('Could not run this report.');
      },
    });
  }

  openInViewer(): void {
    const id = this.definitionId();
    if (id) this.router.navigate(['/reports/view/custom', id]);
  }
}
