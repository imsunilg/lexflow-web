import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import {
  CourtCase,
  CourtCasesService,
  EmptyStateComponent,
  Hearing,
  Matter,
  MattersService,
  StatusChipComponent,
} from 'shared';
import { hearingCountdown } from '../hearing-countdown.util';
import { ClosingChecklistDialogComponent } from './closing-checklist-dialog.component';
import { CreateCaseDialogComponent, CreateCaseDialogData } from './create-case-dialog.component';
import { ImportantDatesPanelComponent } from './important-dates-panel.component';
import { MatterActivityTabComponent } from './tabs/matter-activity-tab.component';
import { MatterBillingTabComponent } from './tabs/matter-billing-tab.component';
import { MatterDocumentsTabComponent } from './tabs/matter-documents-tab.component';
import { MatterNotesTabComponent } from './tabs/matter-notes-tab.component';
import { MatterPartiesTabComponent } from './tabs/matter-parties-tab.component';
import { MatterTasksTabComponent } from './tabs/matter-tasks-tab.component';
import { MatterTimeExpensesTabComponent } from './tabs/matter-time-expenses-tab.component';

interface HearingWithCase {
  hearing: Hearing;
  courtCase: CourtCase;
}

/**
 * Matter workspace (PRD Module 4): header (number, title, status/priority
 * chips, next-hearing countdown) + all 10 tabs (Overview · Court Cases ·
 * Hearings · Documents & Evidence · Tasks · Time & Expenses · Billing ·
 * Notes · Parties · Activity). "Hearings" has no matter-scoped API of its
 * own (hearings are only queryable per court case) — this aggregates
 * hearings across every court case under the matter client-side.
 */
@Component({
  selector: 'lf-staff-matter-workspace-page',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTabsModule,
    MatTooltipModule,
    EmptyStateComponent,
    StatusChipComponent,
    ImportantDatesPanelComponent,
    MatterActivityTabComponent,
    MatterBillingTabComponent,
    MatterDocumentsTabComponent,
    MatterNotesTabComponent,
    MatterPartiesTabComponent,
    MatterTasksTabComponent,
    MatterTimeExpensesTabComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './matter-workspace.page.html',
  styleUrl: './matter-workspace.page.scss',
})
export class MatterWorkspacePage {
  private readonly mattersService = inject(MattersService);
  private readonly courtCasesService = inject(CourtCasesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly matter = signal<Matter | null>(null);

  readonly cases = signal<CourtCase[]>([]);
  readonly casesLoading = signal(true);

  readonly upcomingHearings = signal<HearingWithCase[]>([]);
  readonly hearingsLoading = signal(true);

  readonly nextHearingCountdown = signal<ReturnType<typeof hearingCountdown>>(null);

  constructor() {
    this.load();
  }

  load(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set(true);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(false);

    this.mattersService.get(id).subscribe({
      next: (matter) => {
        this.matter.set(matter);
        this.loading.set(false);
        this.loadCasesAndHearings(id);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  private loadCasesAndHearings(matterId: string): void {
    this.casesLoading.set(true);
    this.hearingsLoading.set(true);

    this.mattersService
      .listCases(matterId)
      .pipe(
        switchMap((cases) => {
          this.cases.set(cases);
          this.casesLoading.set(false);
          if (cases.length === 0) {
            return of([] as HearingWithCase[]);
          }
          return forkJoin(
            cases.map((courtCase) =>
              this.courtCasesService
                .listHearings(courtCase.id)
                .pipe(map((hearings) => hearings.map((hearing) => ({ hearing, courtCase })))),
            ),
          ).pipe(map((groups) => groups.flat()));
        }),
      )
      .subscribe({
        next: (all) => {
          const upcoming = all
            .filter((entry) => entry.hearing.status === 'Scheduled')
            .sort(
              (a, b) => new Date(a.hearing.date).getTime() - new Date(b.hearing.date).getTime(),
            );
          this.upcomingHearings.set(upcoming);
          this.hearingsLoading.set(false);
          this.nextHearingCountdown.set(
            upcoming.length > 0 ? hearingCountdown(upcoming[0].hearing.date) : null,
          );
        },
        error: () => {
          this.casesLoading.set(false);
          this.hearingsLoading.set(false);
        },
      });
  }

  addCase(): void {
    const matter = this.matter();
    if (!matter) return;
    this.dialog
      .open<CreateCaseDialogComponent, CreateCaseDialogData, CourtCase>(CreateCaseDialogComponent, {
        data: { matterId: matter.id },
      })
      .afterClosed()
      .subscribe((courtCase) => {
        if (courtCase) {
          this.cases.update((cases) => [...cases, courtCase]);
        }
      });
  }

  openCase(courtCase: CourtCase): void {
    this.router.navigate(['/matters', this.matter()!.id, 'cases', courtCase.id]);
  }

  putOnHold(): void {
    const matter = this.matter();
    if (!matter) return;
    this.mattersService
      .changeStatus(matter.id, { toStatus: 'OnHold' })
      .subscribe((updated) => this.matter.set(updated));
  }

  reopen(): void {
    const matter = this.matter();
    if (!matter) return;
    this.mattersService
      .changeStatus(matter.id, { toStatus: 'Reopened' })
      .subscribe((updated) => this.matter.set(updated));
  }

  openClosingChecklist(): void {
    const matter = this.matter();
    if (!matter) return;
    this.dialog
      .open(ClosingChecklistDialogComponent, { data: { matter }, width: '480px' })
      .afterClosed()
      .subscribe((updated: Matter | undefined) => {
        if (updated) {
          this.matter.set(updated);
        }
      });
  }
}
