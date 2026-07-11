import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import {
  CourtCase,
  CourtCasesService,
  CourtOrder,
  EmptyStateComponent,
  Hearing,
  RecordHearingOutcomeResult,
  StatusChipComponent,
} from 'shared';
import { hearingCountdown } from '../hearing-countdown.util';
import { CaseArgumentsTabComponent } from './tabs/case-arguments-tab.component';
import { CaseEvidenceTabComponent } from './tabs/case-evidence-tab.component';
import { CaseHearingsTabComponent } from './tabs/case-hearings-tab.component';
import { CaseOrdersTabComponent } from './tabs/case-orders-tab.component';
import { CasePartiesTabComponent } from './tabs/case-parties-tab.component';
import { CaseWitnessesTabComponent } from './tabs/case-witnesses-tab.component';
import {
  HearingOutcomeDialogComponent,
  HearingOutcomeDialogData,
} from './hearing-outcome-dialog.component';

interface TimelineRow {
  at: string;
  label: string;
}

/**
 * Case detail (PRD Module 5): header (court, case no., stage chip, next
 * hearing big countdown) + 7 tabs (Hearings · Orders · Parties & Advocates ·
 * Evidence · Witnesses · Arguments · Timeline). Timeline has no dedicated
 * API of its own — it merges hearings/orders/arguments already fetched for
 * the other tabs, sorted chronologically, as a lightweight substitute for a
 * real cross-entity timeline endpoint.
 */
@Component({
  selector: 'lf-staff-case-detail-page',
  standalone: true,
  imports: [
    DatePipe,
    MatButtonModule,
    MatProgressBarModule,
    MatTabsModule,
    EmptyStateComponent,
    StatusChipComponent,
    CaseArgumentsTabComponent,
    CaseEvidenceTabComponent,
    CaseHearingsTabComponent,
    CaseOrdersTabComponent,
    CasePartiesTabComponent,
    CaseWitnessesTabComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './case-detail.page.html',
  styleUrl: './case-detail.page.scss',
})
export class CaseDetailPage {
  private readonly courtCasesService = inject(CourtCasesService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly courtCase = signal<CourtCase | null>(null);

  readonly nextHearingCountdown = signal<ReturnType<typeof hearingCountdown>>(null);
  readonly timelineRows = signal<TimelineRow[]>([]);

  readonly matterId = computed(() => this.route.snapshot.paramMap.get('id') ?? '');

  constructor() {
    this.load();
  }

  load(): void {
    const caseId = this.route.snapshot.paramMap.get('caseId');
    if (!caseId) {
      this.error.set(true);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(false);

    this.courtCasesService.get(caseId).subscribe({
      next: (courtCase) => {
        this.courtCase.set(courtCase);
        this.loading.set(false);
        this.loadTimelineAndCountdown(caseId);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  private loadTimelineAndCountdown(caseId: string): void {
    forkJoin({
      hearings: this.courtCasesService.listHearings(caseId),
      orders: this.courtCasesService.listOrders(caseId),
    }).subscribe({
      next: ({ hearings, orders }) => {
        const nextScheduled = hearings
          .filter((h) => h.status === 'Scheduled')
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
        this.nextHearingCountdown.set(nextScheduled ? hearingCountdown(nextScheduled.date) : null);
        this.timelineRows.set(buildTimeline(hearings, orders));
      },
      error: () => of(null),
    });
  }

  onOutcomeRequested(hearing: Hearing): void {
    const courtCase = this.courtCase();
    if (!courtCase) return;
    this.dialog
      .open<
        HearingOutcomeDialogComponent,
        HearingOutcomeDialogData,
        RecordHearingOutcomeResult | undefined
      >(HearingOutcomeDialogComponent, {
        data: { hearing, courtId: courtCase.courtId },
        width: '520px',
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.load();
        }
      });
  }
}

/**
 * `ArgumentNote` has no timestamp field of its own (no `createdAt` in the
 * model), so it can't be merged into a chronological timeline — only
 * hearings and orders (both dated) are shown here.
 */
function buildTimeline(hearings: Hearing[], orders: CourtOrder[]): TimelineRow[] {
  const rows: TimelineRow[] = [
    ...hearings.map((h) => ({ at: h.date, label: `Hearing: ${h.purpose || h.status}` })),
    ...orders.map((o) => ({ at: o.orderDate, label: `Order: ${o.gist || 'Order passed'}` })),
  ].filter((row) => row.at);

  return rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}
