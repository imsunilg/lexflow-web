import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import { EmptyStateComponent, Lead, LEAD_PIPELINE_STAGES, LeadStage, LeadsService } from 'shared';
import {
  LeadFormDialogComponent,
  LeadFormDialogResult,
} from '../dialogs/lead-form-dialog.component';
import { LeadsTabsComponent } from '../leads-tabs.component';
import { leadStageAging } from '../lead-stage-aging.util';

interface KanbanColumn {
  stage: LeadStage;
  leads: Lead[];
}

/**
 * Kanban board (PRD Module 2 UI Components: "Kanban board (CDK drag-drop, WIP
 * counts, stage-aging color)"). Dragging a card between columns calls
 * `POST /leads/{id}/stage` (AC-L2); the move is optimistic and rolls back on
 * error so a failed request never leaves the board looking wrong.
 */
@Component({
  selector: 'lf-staff-leads-kanban-page',
  standalone: true,
  imports: [
    CdkDrag,
    CdkDropList,
    CdkDropListGroup,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    EmptyStateComponent,
    LeadsTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './leads-kanban.page.html',
  styleUrl: './leads-kanban.page.scss',
})
export class LeadsKanbanPage {
  private readonly leadsService = inject(LeadsService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly leads = signal<Lead[]>([]);
  readonly stages = LEAD_PIPELINE_STAGES;

  readonly columns = computed<KanbanColumn[]>(() =>
    this.stages.map((stage) => ({
      stage,
      leads: this.leads().filter((lead) => lead.stage === stage),
    })),
  );

  readonly connectedDropListIds = computed(() => this.stages.map((stage) => `kanban-${stage}`));

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.leadsService
      .list()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (leads) => {
          this.leads.set(leads);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  dropListId(stage: LeadStage): string {
    return `kanban-${stage}`;
  }

  aging(lead: Lead) {
    return leadStageAging(lead);
  }

  openLead(lead: Lead): void {
    this.router.navigate(['/leads', lead.id]);
  }

  createLead(): void {
    this.dialog
      .open<LeadFormDialogComponent, unknown, LeadFormDialogResult>(LeadFormDialogComponent)
      .afterClosed()
      .subscribe((result) => {
        if (result?.outcome === 'saved') {
          this.leads.update((leads) => [...leads, result.lead]);
        } else if (result?.outcome === 'attached-to-existing') {
          this.router.navigate(['/leads', result.leadId]);
        }
      });
  }

  onDrop(event: CdkDragDrop<Lead[]>, toStage: LeadStage): void {
    if (event.previousContainer === event.container) {
      return;
    }

    const lead = event.item.data as Lead;
    const fromStage = lead.stage;

    // Optimistic move so the board feels immediate; rolled back on failure.
    this.leads.update((leads) =>
      leads.map((candidate) =>
        candidate.id === lead.id ? { ...candidate, stage: toStage } : candidate,
      ),
    );

    this.leadsService
      .changeStage(lead.id, { toStage })
      .pipe(
        catchError(() => {
          this.leads.update((leads) =>
            leads.map((candidate) =>
              candidate.id === lead.id ? { ...candidate, stage: fromStage } : candidate,
            ),
          );
          return of(null);
        }),
      )
      .subscribe((updated) => {
        if (updated) {
          this.leads.update((leads) =>
            leads.map((candidate) => (candidate.id === updated.id ? updated : candidate)),
          );
        }
      });
  }
}
