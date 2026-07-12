import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router } from '@angular/router';
import {
  CustomReportsService,
  EmptyStateComponent,
  ReportDefinitionDto,
  ReportScheduleDto,
  ReportSchedulesService,
} from 'shared';
import { ReportsTabsComponent } from '../reports-tabs.component';
import { ScheduleDialogComponent, ScheduleDialogData } from '../schedule-dialog.component';

/**
 * Saved-report manager (PRD Module 13 UI Components: "saved-report manager").
 * Lists custom report definitions (`GET /reports/custom`) and existing
 * schedules (`GET /reports/schedules`). Schedules are list-only here —
 * `ReportsController` has no delete/deactivate route for a schedule, so
 * there's nothing to wire a remove action to.
 */
@Component({
  selector: 'lf-saved-report-manager-page',
  standalone: true,
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    EmptyStateComponent,
    ReportsTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './saved-report-manager.page.html',
  styleUrl: './saved-report-manager.page.scss',
})
export class SavedReportManagerPage {
  private readonly customReportsService = inject(CustomReportsService);
  private readonly reportSchedulesService = inject(ReportSchedulesService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  readonly loadingDefinitions = signal(true);
  readonly definitions = signal<ReportDefinitionDto[]>([]);
  readonly loadingSchedules = signal(true);
  readonly schedules = signal<ReportScheduleDto[]>([]);

  constructor() {
    this.customReportsService.list().subscribe({
      next: (defs) => {
        this.definitions.set(defs);
        this.loadingDefinitions.set(false);
      },
      error: () => this.loadingDefinitions.set(false),
    });

    this.reportSchedulesService.list().subscribe({
      next: (schedules) => {
        this.schedules.set(schedules);
        this.loadingSchedules.set(false);
      },
      error: () => this.loadingSchedules.set(false),
    });
  }

  openDefinition(def: ReportDefinitionDto): void {
    this.router.navigate(['/reports/view/custom', def.id]);
  }

  editDefinition(def: ReportDefinitionDto, event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/reports/builder', def.id]);
  }

  scheduleDefinition(def: ReportDefinitionDto, event: Event): void {
    event.stopPropagation();
    const data: ScheduleDialogData = { reportKey: null, reportDefinitionId: def.id, params: null };
    this.dialog
      .open(ScheduleDialogComponent, { data, width: '480px' })
      .afterClosed()
      .subscribe((schedule) => {
        if (schedule) this.reportSchedulesService.list().subscribe((s) => this.schedules.set(s));
      });
  }

  definitionName(id: string | null): string {
    if (!id) return '';
    return this.definitions().find((d) => d.id === id)?.name ?? id.slice(0, 8);
  }

  goToBuilder(): void {
    this.router.navigate(['/reports/builder']);
  }
}
