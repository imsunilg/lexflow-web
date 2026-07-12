import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import type { Chart, ChartConfiguration } from 'chart.js';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  of,
  switchMap,
  takeWhile,
  timer,
} from 'rxjs';
import {
  Client,
  ClientsService,
  CustomReportsService,
  EmptyStateComponent,
  PermissionService,
  REPORT_ENTITY_DETAIL_ROUTE,
  ReportBaseEntity,
  ReportCatalogItem,
  ReportDefinitionDto,
  ReportExportFormat,
  ReportResult,
  ReportRunParams,
  ReportRunStatus,
  ReportsService,
} from 'shared';
import { ReportsTabsComponent } from '../reports-tabs.component';
import { ScheduleDialogComponent, ScheduleDialogData } from '../schedule-dialog.component';

const POLL_INTERVAL_MS = 3000;

/**
 * Report viewer (PRD Module 13 UI Components: "report viewer (parameter bar,
 * chart+table toggle, drill-down links, export menu)"). Handles both a
 * standard catalog report (`/reports/view/standard/:key`) and a saved custom
 * report definition (`/reports/view/custom/:id`) through the same run/poll/
 * export machinery — `ReportsController.RunStandard`/`RunCustom` return the
 * identical `ReportRunOutcome` shape.
 *
 * Parameter bar only offers Date From/To and Client — `practiceAreaId`/
 * `lawyerId`/`branchId` are skipped here for the same reason
 * `matters-list.page.ts` skips them: no lookup source exists for any of the
 * three anywhere in this app yet.
 *
 * Drill-down only applies to custom reports (a single, unambiguous base
 * entity): if the result has an `Id` column and that base entity has a real
 * detail route (`REPORT_ENTITY_DETAIL_ROUTE`), each row links there. The 12
 * standard reports are cross-dimension aggregates with no source record to
 * land on, so they never show drill-down links (see `reports.models.ts`).
 *
 * Async (queued) runs never return row data through polling — only
 * status/rowCount (`ReportRunDto` has no result field) — so a queued run
 * shows a "completed — export below" state instead of a chart/table once
 * done, per the same file's documented gap.
 */
@Component({
  selector: 'lf-report-viewer-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressBarModule,
    MatTooltipModule,
    EmptyStateComponent,
    ReportsTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './report-viewer.page.html',
  styleUrl: './report-viewer.page.scss',
})
export class ReportViewerPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly reportsService = inject(ReportsService);
  private readonly customReportsService = inject(CustomReportsService);
  private readonly clientsService = inject(ClientsService);
  private readonly permissionService = inject(PermissionService);
  private readonly dialog = inject(MatDialog);

  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');
  private chart: Chart | null = null;

  readonly isCustom: boolean;
  readonly reportKey: string | null;
  readonly definitionId: string | null;

  readonly loadingMeta = signal(true);
  readonly catalogItem = signal<ReportCatalogItem | null>(null);
  readonly definition = signal<ReportDefinitionDto | null>(null);

  readonly paramsForm = new FormGroup({
    dateFrom: new FormControl<Date | null>(null),
    dateTo: new FormControl<Date | null>(null),
  });
  readonly clientControl = new FormControl('', { nonNullable: true });
  readonly clientResults = signal<Client[]>([]);
  private selectedClientId: string | null = null;

  readonly running = signal(false);
  readonly runStatus = signal<ReportRunStatus | null>(null);
  readonly runId = signal<string | null>(null);
  readonly rowCount = signal<number | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly result = signal<ReportResult | null>(null);
  readonly viewMode = signal<'table' | 'chart'>('table');

  readonly canSchedule = this.permissionService.has('reports.operational.own');

  constructor() {
    const url = this.route.snapshot.url.map((s) => s.path);
    this.isCustom = url.includes('custom');
    this.reportKey = this.isCustom ? null : (this.route.snapshot.paramMap.get('key') ?? null);
    this.definitionId = this.isCustom ? (this.route.snapshot.paramMap.get('id') ?? null) : null;

    if (this.isCustom && this.definitionId) {
      this.customReportsService.list().subscribe((defs) => {
        this.definition.set(defs.find((d) => d.id === this.definitionId) ?? null);
        this.loadingMeta.set(false);
      });
    } else if (this.reportKey) {
      this.reportsService.catalog().subscribe((catalog) => {
        this.catalogItem.set(catalog.find((c) => c.key === this.reportKey) ?? null);
        this.loadingMeta.set(false);
      });
    } else {
      this.loadingMeta.set(false);
    }

    this.clientControl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => {
        this.selectedClientId = null;
        if (!q.trim()) {
          this.clientResults.set([]);
          return;
        }
        this.clientsService
          .list({ q })
          .pipe(catchError(() => of<Client[]>([])))
          .subscribe((clients) => this.clientResults.set(clients));
      });
  }

  onClientSelected(event: MatAutocompleteSelectedEvent): void {
    const label = event.option.value as string;
    const client = this.clientResults().find((c) => this.clientLabel(c) === label);
    this.selectedClientId = client?.id ?? null;
  }

  clientLabel(client: Client): string {
    return client.displayName ?? client.id;
  }

  private buildParams(): ReportRunParams {
    const value = this.paramsForm.getRawValue();
    return {
      dateFrom: value.dateFrom ? value.dateFrom.toISOString().slice(0, 10) : null,
      dateTo: value.dateTo ? value.dateTo.toISOString().slice(0, 10) : null,
      clientId: this.selectedClientId,
    };
  }

  run(): void {
    this.running.set(true);
    this.errorMessage.set(null);
    this.result.set(null);
    this.runStatus.set(null);
    this.rowCount.set(null);
    this.destroyChart();

    const outcome$ =
      this.isCustom && this.definitionId
        ? this.reportsService.runCustom(this.definitionId)
        : this.reportsService.runStandard(this.reportKey!, this.buildParams());

    outcome$
      .pipe(
        catchError(() => {
          this.running.set(false);
          this.errorMessage.set('Could not run this report.');
          return of(null);
        }),
      )
      .subscribe((outcome) => {
        if (!outcome) return;
        this.runId.set(outcome.runId);
        this.runStatus.set(outcome.status);

        if (outcome.status === 'Completed' && outcome.inlineResult) {
          this.result.set(outcome.inlineResult);
          this.rowCount.set(outcome.inlineResult.rows.length);
          this.running.set(false);
          this.renderChart();
          return;
        }

        this.pollRun(outcome.runId);
      });
  }

  private pollRun(runId: string): void {
    timer(POLL_INTERVAL_MS, POLL_INTERVAL_MS)
      .pipe(
        switchMap(() => this.reportsService.getRun(runId)),
        takeWhile((run) => run.status === 'Queued' || run.status === 'Running', true),
        takeUntilDestroyed(),
      )
      .subscribe({
        next: (run) => {
          this.runStatus.set(run.status);
          this.rowCount.set(run.rowCount);
          if (run.status === 'Completed' || run.status === 'Failed') {
            this.running.set(false);
            if (run.status === 'Failed') {
              this.errorMessage.set(run.errorMessage ?? 'This report run failed.');
            }
          }
        },
        error: () => {
          this.running.set(false);
          this.errorMessage.set('Lost track of this report run.');
        },
      });
  }

  private renderChart(): void {
    const data = this.result();
    const canvas = this.canvasRef()?.nativeElement;
    if (!data || !canvas || data.columns.length < 2) return;

    const labelCol = 0;
    const numericCols = data.columns
      .map((_, i) => i)
      .filter((i) => i !== labelCol && data.rows.every((row) => typeof row[i] === 'number'));
    if (numericCols.length === 0) return;

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: data.rows.map((row) => String(row[labelCol])),
        datasets: numericCols.map((i) => ({
          label: data.columns[i],
          data: data.rows.map((row) => row[i] as number),
        })),
      },
      options: { responsive: true, maintainAspectRatio: false },
    };

    import('chart.js/auto').then(({ default: ChartJs }) => {
      this.destroyChart();
      this.chart = new ChartJs(canvas, config);
    });
  }

  private destroyChart(): void {
    this.chart?.destroy();
    this.chart = null;
  }

  setViewMode(mode: 'table' | 'chart'): void {
    this.viewMode.set(mode);
    if (mode === 'chart') {
      setTimeout(() => this.renderChart());
    }
  }

  /** Drill-down target for a custom-report row, or null if none applies — see class doc comment. */
  drillDownTarget(row: unknown[]): string[] | null {
    const def = this.definition();
    if (!def) return null;
    const columns = this.result()?.columns ?? [];
    const idIndex = columns.findIndex((c) => c.toLowerCase() === 'id');
    if (idIndex === -1) return null;
    const routeFn = REPORT_ENTITY_DETAIL_ROUTE[def.baseEntity as ReportBaseEntity];
    if (!routeFn) return null;
    const id = row[idIndex];
    return typeof id === 'string' ? routeFn(id) : null;
  }

  openDrillDown(row: unknown[]): void {
    const target = this.drillDownTarget(row);
    if (target) this.router.navigate(target);
  }

  export(format: ReportExportFormat): void {
    const runId = this.runId();
    if (!runId) return;
    this.reportsService.export(runId, format).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `report.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  openScheduleDialog(): void {
    const def = this.definition();
    const data: ScheduleDialogData = {
      reportKey: this.isCustom ? null : this.reportKey,
      reportDefinitionId: this.isCustom ? (def?.id ?? this.definitionId) : null,
      params: this.isCustom ? null : this.buildParams(),
    };
    this.dialog.open(ScheduleDialogComponent, { data, width: '480px' });
  }

  reportTitle(): string {
    return this.catalogItem()?.name ?? this.definition()?.name ?? 'Report';
  }
}
