import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { EmptyStateComponent, LfCurrencyPipe, TimeEntriesService, TimeEntry } from 'shared';
import { TimeTabsComponent } from '../time-tabs.component';

/**
 * Approval queue (PRD Module 9 §User Flow 5: "entries Submitted → Approved/
 * Rejected (with comment) by supervising partner ... bulk approve"; AC-T2:
 * bulk-approving up to ~500 entries should feel instant). `time.approve`
 * cannot approve own entries (server-enforced segregation) — the server will
 * 403 if a supervisor tries to approve their own submitted entries; this page
 * does not pre-filter for that, it just surfaces whatever error comes back.
 */
@Component({
  selector: 'lf-approval-queue-page',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCheckboxModule,
    MatProgressBarModule,
    EmptyStateComponent,
    LfCurrencyPipe,
    TimeTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './approval-queue.page.html',
  styleUrl: './approval-queue.page.scss',
})
export class ApprovalQueuePage {
  private readonly timeEntriesService = inject(TimeEntriesService);

  readonly entries = signal<TimeEntry[]>([]);
  readonly loading = signal(true);
  readonly processing = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly selectedIds = signal<Set<string>>(new Set());

  readonly allSelected = computed(() => {
    const ids = this.entries().map((e) => e.id);
    return ids.length > 0 && ids.every((id) => this.selectedIds().has(id));
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.timeEntriesService.list({ status: 'Submitted' }).subscribe({
      next: (entries) => {
        this.entries.set(entries);
        this.selectedIds.set(new Set());
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Could not load the approval queue.');
      },
    });
  }

  hours(entry: TimeEntry): string {
    return (entry.roundedMin / 60).toFixed(2);
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggleSelect(id: string, checked: boolean): void {
    const next = new Set(this.selectedIds());
    if (checked) next.add(id);
    else next.delete(id);
    this.selectedIds.set(next);
  }

  toggleSelectAll(checked: boolean): void {
    this.selectedIds.set(checked ? new Set(this.entries().map((e) => e.id)) : new Set());
  }

  approveSelected(): void {
    const ids = [...this.selectedIds()];
    if (ids.length === 0) return;
    this.processing.set(true);
    this.errorMessage.set(null);
    this.timeEntriesService.approve({ ids }).subscribe({
      next: () => {
        this.processing.set(false);
        this.load();
      },
      error: () => {
        this.processing.set(false);
        this.errorMessage.set(
          'Could not approve the selected entries (you may not approve your own submitted time).',
        );
      },
    });
  }

  rejectSelected(): void {
    const ids = [...this.selectedIds()];
    if (ids.length === 0) return;
    const comment = window.prompt('Reason for rejecting these entries?');
    if (!comment) return;

    this.processing.set(true);
    this.errorMessage.set(null);
    this.timeEntriesService.reject({ ids, comment }).subscribe({
      next: () => {
        this.processing.set(false);
        this.load();
      },
      error: () => {
        this.processing.set(false);
        this.errorMessage.set('Could not reject the selected entries.');
      },
    });
  }
}
