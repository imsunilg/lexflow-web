import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { PermissionService, TimeEntriesService, TimeEntry } from 'shared';
import { TimeTabsComponent } from '../time-tabs.component';

/** No per-user/firm target-hours source exists server-side — mirrors the same documented assumption used in `timesheet-grid.page.ts`. */
const DEFAULT_DAILY_TARGET_HOURS = 8;

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function countWeekdays(from: Date, to: Date): number {
  let count = 0;
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/**
 * "My utilization" card (PRD Module 9 §Productivity Views: "my utilization
 * (billable/target)"; AC-T5: "billable approved hours ÷ target hours").
 * There is no `GET /time/utilization` endpoint at all (confirmed) — this is
 * computed client-side from `TimeEntriesService.list()` for the current user
 * and date range. The team heatmap and unbilled aging views mentioned
 * elsewhere in the PRD are out of scope for this page.
 */
@Component({
  selector: 'lf-utilization-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    TimeTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './utilization.page.html',
  styleUrl: './utilization.page.scss',
})
export class UtilizationPage {
  private readonly timeEntriesService = inject(TimeEntriesService);
  private readonly permissionService = inject(PermissionService);

  private readonly today = new Date();

  readonly fromControl = new FormControl<Date | null>(startOfMonth(this.today));
  readonly toControl = new FormControl<Date | null>(endOfMonth(this.today));

  readonly entries = signal<TimeEntry[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  readonly billableApprovedMinutes = computed(() =>
    this.entries()
      .filter((e) => e.billable && e.status === 'Approved')
      .reduce((sum, e) => sum + e.roundedMin, 0),
  );

  readonly totalLoggedMinutes = computed(() =>
    this.entries().reduce((sum, e) => sum + e.roundedMin, 0),
  );

  readonly targetMinutes = computed(() => {
    const from = this.fromControl.value;
    const to = this.toControl.value;
    if (!from || !to) return 0;
    return countWeekdays(from, to) * DEFAULT_DAILY_TARGET_HOURS * 60;
  });

  readonly utilizationPct = computed(() => {
    const target = this.targetMinutes();
    if (target <= 0) return 0;
    return Math.round((this.billableApprovedMinutes() / target) * 100);
  });

  readonly barWidthPct = computed(() => Math.min(100, this.utilizationPct()));

  constructor() {
    this.load();
  }

  load(): void {
    const from = this.fromControl.value;
    const to = this.toControl.value;
    if (!from || !to) return;

    this.loading.set(true);
    this.errorMessage.set(null);
    const userId = this.permissionService.currentUser()?.id;
    this.timeEntriesService.list({ userId, from: toIsoDate(from), to: toIsoDate(to) }).subscribe({
      next: (entries) => {
        this.entries.set(entries);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Could not load time entries for this range.');
      },
    });
  }

  hoursLabel(minutes: number): string {
    return (minutes / 60).toFixed(1);
  }
}
