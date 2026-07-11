import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Subject, debounceTime, interval, switchMap } from 'rxjs';
import {
  AnalyticsRange,
  DashboardLayoutService,
  DashboardRealtimeService,
  DashboardWidgetLayoutEntry,
  PermissionService,
  WidgetId,
} from 'shared';
import { rangeForPreset } from './analytics-range.util';
import { DashboardDateRangeSelectorComponent } from './date-range-selector.component';
import { WIDGET_CATALOG, WidgetCatalogEntry, defaultDashboardLayout } from './widget-catalog';
import {
  WidgetCatalogDialogComponent,
  WidgetCatalogDialogData,
} from './widget-catalog-dialog.component';
import { ActivityWidgetComponent } from './widgets/activity-widget.component';
import { CaseStatsWidgetComponent } from './widgets/case-stats-widget.component';
import { ClientSummaryWidgetComponent } from './widgets/client-summary-widget.component';
import { DeadlinesWidgetComponent } from './widgets/deadlines-widget.component';
import { HearingsTodayWidgetComponent } from './widgets/hearings-today-widget.component';
import { LawyerPerformanceWidgetComponent } from './widgets/lawyer-performance-widget.component';
import { LeadPipelineWidgetComponent } from './widgets/lead-pipeline-widget.component';
import { MatterSummaryWidgetComponent } from './widgets/matter-summary-widget.component';
import { OutstandingWidgetComponent } from './widgets/outstanding-widget.component';
import { RevenueWidgetComponent } from './widgets/revenue-widget.component';
import { TasksPendingWidgetComponent } from './widgets/tasks-pending-widget.component';
import { TrustBalanceWidgetComponent } from './widgets/trust-balance-widget.component';

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const LAYOUT_SAVE_DEBOUNCE_MS = 500;

/**
 * Dashboard shell (PRD Module 1): a drag-drop-reorderable, per-user-persisted
 * grid of up to 12 independently-loading widgets, plus the analytics
 * date-range selector and a live-updates banner. Widget selection/order is
 * `PUT /dashboard/layout`; each widget owns its own loading/error/empty state
 * so one failing widget never blanks the page.
 */
@Component({
  selector: 'lf-staff-dashboard-page',
  standalone: true,
  imports: [
    CdkDrag,
    CdkDragHandle,
    CdkDropList,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    DashboardDateRangeSelectorComponent,
    ActivityWidgetComponent,
    CaseStatsWidgetComponent,
    ClientSummaryWidgetComponent,
    DeadlinesWidgetComponent,
    HearingsTodayWidgetComponent,
    LawyerPerformanceWidgetComponent,
    LeadPipelineWidgetComponent,
    MatterSummaryWidgetComponent,
    OutstandingWidgetComponent,
    RevenueWidgetComponent,
    TasksPendingWidgetComponent,
    TrustBalanceWidgetComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage {
  private readonly layoutService = inject(DashboardLayoutService);
  private readonly realtimeService = inject(DashboardRealtimeService);
  private readonly permissionService = inject(PermissionService);
  private readonly dialog = inject(MatDialog);

  readonly loadingLayout = signal(true);
  readonly layout = signal<DashboardWidgetLayoutEntry[]>(defaultDashboardLayout());
  readonly analyticsRange = signal<AnalyticsRange>(rangeForPreset('month'));
  readonly refreshTrigger = signal(0);
  readonly liveUpdatesPaused = this.realtimeService.liveUpdatesPaused;

  /** Catalog entries the current user is permitted to see (AC-D5: revenue/outstanding/trust need `billing.read.*`). */
  readonly allowedCatalog = computed(() =>
    WIDGET_CATALOG.filter(
      (entry) => !entry.permission || this.permissionService.has(entry.permission),
    ),
  );

  readonly visibleLayout = computed(() => {
    const allowedIds = new Set(this.allowedCatalog().map((entry) => entry.id));
    return this.layout()
      .filter((entry) => entry.visible && allowedIds.has(entry.widgetId))
      .sort((a, b) => a.order - b.order);
  });

  private readonly layoutSave$ = new Subject<DashboardWidgetLayoutEntry[]>();

  constructor() {
    this.realtimeService.connect();

    this.layoutService
      .getLayout()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (saved) => {
          this.layout.set(this.healLayout(saved.widgets));
          this.loadingLayout.set(false);
        },
        error: () => {
          // No layout saved yet (or the endpoint isn't live) — fall back to the catalog's default order.
          this.layout.set(defaultDashboardLayout());
          this.loadingLayout.set(false);
        },
      });

    this.layoutSave$
      .pipe(
        debounceTime(LAYOUT_SAVE_DEBOUNCE_MS),
        switchMap((widgets) => this.layoutService.saveLayout({ widgets })),
        takeUntilDestroyed(),
      )
      .subscribe();

    // 5-min polling fallback for widgets that never receive a SignalR push (PRD Module 1 UI Components).
    interval(POLL_INTERVAL_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.refreshTrigger.update((tick) => tick + 1));

    // SignalR push (hearing outcomes/payments, via DashboardRealtimeService) bumps the same trigger.
    effect(() => {
      this.realtimeService.refreshTick();
      this.refreshTrigger.update((tick) => tick + 1);
    });
  }

  onRangeChange(range: AnalyticsRange): void {
    this.analyticsRange.set(range);
  }

  onDrop(event: CdkDragDrop<DashboardWidgetLayoutEntry[]>): void {
    const reorderedVisible = [...this.visibleLayout()];
    moveItemInArray(reorderedVisible, event.previousIndex, event.currentIndex);
    const hidden = this.layout().filter(
      (entry) => !reorderedVisible.some((visible) => visible.widgetId === entry.widgetId),
    );
    const reordered = [...reorderedVisible, ...hidden].map((entry, index) => ({
      ...entry,
      order: index,
    }));
    this.layout.set(reordered);
    this.layoutSave$.next(reordered);
  }

  openCatalogDialog(): void {
    const dialogRef = this.dialog.open<
      WidgetCatalogDialogComponent,
      WidgetCatalogDialogData,
      DashboardWidgetLayoutEntry[]
    >(WidgetCatalogDialogComponent, {
      data: { catalog: this.allowedCatalog(), layout: this.layout() },
      width: '420px',
    });

    dialogRef.afterClosed().subscribe((updated) => {
      if (!updated) {
        return;
      }
      this.layout.set(updated);
      this.layoutSave$.next(updated);
    });
  }

  catalogEntry(id: WidgetId): WidgetCatalogEntry {
    return this.allowedCatalog().find((entry) => entry.id === id) ?? WIDGET_CATALOG[0];
  }

  /** Drops any widget id no longer in the catalog and appends any newly-added catalog widget (PRD Module 1 Edge Cases: "deleted widget type in saved layout — silently dropped, layout auto-healed"). */
  private healLayout(entries: DashboardWidgetLayoutEntry[]): DashboardWidgetLayoutEntry[] {
    const knownIds = new Set(WIDGET_CATALOG.map((entry) => entry.id));
    const healed = entries.filter((entry) => knownIds.has(entry.widgetId));
    const missing = WIDGET_CATALOG.filter(
      (entry) => !healed.some((existing) => existing.widgetId === entry.id),
    ).map((entry, index) => ({
      widgetId: entry.id,
      size: entry.defaultSize,
      order: healed.length + index,
      visible: true,
    }));
    return [...healed, ...missing];
  }
}
