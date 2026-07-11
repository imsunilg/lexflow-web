import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute } from '@angular/router';
import { catchError, of } from 'rxjs';
import {
  ConvertLeadResult,
  EmptyStateComponent,
  LEAD_PIPELINE_STAGES,
  LeadActivity,
  LeadDetail,
  LeadStage,
  LeadStageHistoryEntry,
  LeadsService,
  StatusChipComponent,
} from 'shared';
import {
  ConvertLeadWizardComponent,
  ConvertLeadWizardData,
} from '../dialogs/convert-lead-wizard.component';
import {
  LeadFormDialogComponent,
  LeadFormDialogData,
  LeadFormDialogResult,
} from '../dialogs/lead-form-dialog.component';
import {
  LostReasonDialogComponent,
  LostReasonDialogData,
} from '../dialogs/lost-reason-dialog.component';
import {
  QuickLogActivityDialogComponent,
  QuickLogActivityDialogData,
  QuickLogActivityType,
} from '../dialogs/quick-log-activity-dialog.component';

type TimelineEntry =
  | { kind: 'activity'; at: string; activity: LeadActivity }
  | { kind: 'stage'; at: string; entry: LeadStageHistoryEntry };

const ACTIVITY_ICONS: Record<LeadActivity['activityType'], string> = {
  call: 'call',
  email: 'email',
  meeting: 'groups',
  note: 'note',
};

/** Lead detail 3-pane layout (PRD Module 2 UI Components: "lead detail: 3-pane (profile | activity timeline | next-action panel)"). */
@Component({
  selector: 'lf-staff-lead-detail-page',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressBarModule,
    MatSelectModule,
    EmptyStateComponent,
    StatusChipComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './lead-detail.page.html',
  styleUrl: './lead-detail.page.scss',
})
export class LeadDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly leadsService = inject(LeadsService);
  private readonly dialog = inject(MatDialog);

  private readonly leadId = this.route.snapshot.paramMap.get('id')!;

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly lead = signal<LeadDetail | null>(null);
  readonly activities = signal<LeadActivity[]>([]);

  readonly stageControl = new FormControl<LeadStage | null>(null);
  readonly stageSaving = signal(false);
  readonly stageError = signal<string | null>(null);

  readonly stages = LEAD_PIPELINE_STAGES;

  readonly timeline = computed<TimelineEntry[]>(() => {
    const currentLead = this.lead();
    if (!currentLead) {
      return [];
    }
    const activityEntries: TimelineEntry[] = this.activities().map((activity) => ({
      kind: 'activity',
      at: activity.occurredAt,
      activity,
    }));
    const stageEntries: TimelineEntry[] = currentLead.stageHistory.map((entry) => ({
      kind: 'stage',
      at: entry.at,
      entry,
    }));
    return [...activityEntries, ...stageEntries].sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.leadsService.get(this.leadId).subscribe({
      next: (lead) => {
        this.lead.set(lead);
        this.activities.set(lead.activities);
        this.stageControl.setValue(lead.stage, { emitEvent: false });
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  activityIcon(type: LeadActivity['activityType']): string {
    return ACTIVITY_ICONS[type];
  }

  activitySummary(activity: LeadActivity): string {
    return activity.subject ?? activity.outcome ?? activity.body ?? '';
  }

  editLead(): void {
    const currentLead = this.lead();
    if (!currentLead) {
      return;
    }
    this.dialog
      .open<LeadFormDialogComponent, LeadFormDialogData, LeadFormDialogResult>(
        LeadFormDialogComponent,
        {
          data: { lead: currentLead },
        },
      )
      .afterClosed()
      .subscribe((result) => {
        if (result?.outcome === 'saved') {
          this.lead.update((existing) => (existing ? { ...existing, ...result.lead } : existing));
        }
      });
  }

  logActivity(activityType: QuickLogActivityType): void {
    this.dialog
      .open<QuickLogActivityDialogComponent, QuickLogActivityDialogData, LeadActivity>(
        QuickLogActivityDialogComponent,
        { data: { leadId: this.leadId, activityType } },
      )
      .afterClosed()
      .subscribe((activity) => {
        if (activity) {
          this.activities.update((existing) => [activity, ...existing]);
        }
      });
  }

  changeStage(): void {
    const currentLead = this.lead();
    const toStage = this.stageControl.value;
    if (!currentLead || !toStage || toStage === currentLead.stage) {
      return;
    }

    this.stageSaving.set(true);
    this.stageError.set(null);

    this.leadsService
      .changeStage(currentLead.id, { toStage })
      .pipe(
        catchError(() => {
          this.stageControl.setValue(currentLead.stage, { emitEvent: false });
          this.stageError.set('Could not change stage. Please try again.');
          return of(null);
        }),
      )
      .subscribe((updated) => {
        this.stageSaving.set(false);
        if (updated) {
          this.lead.update((existing) => (existing ? { ...existing, ...updated } : existing));
        }
      });
  }

  convert(): void {
    const currentLead = this.lead();
    if (!currentLead) {
      return;
    }
    this.dialog
      .open<ConvertLeadWizardComponent, ConvertLeadWizardData, ConvertLeadResult | undefined>(
        ConvertLeadWizardComponent,
        { data: { lead: currentLead } },
      )
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.load();
        }
      });
  }

  markLost(): void {
    const currentLead = this.lead();
    if (!currentLead) {
      return;
    }
    this.dialog
      .open<LostReasonDialogComponent, LostReasonDialogData, boolean>(LostReasonDialogComponent, {
        data: { lead: currentLead },
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.load();
        }
      });
  }
}
