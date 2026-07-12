import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { EmptyStateComponent, MatterTimelineEntry, MattersService } from 'shared';

/** Maps common `entryType` values (case-insensitive) to a Material icon; falls back to `event`. */
const ACTIVITY_ICONS: Record<string, string> = {
  hearing: 'gavel',
  order: 'description',
  task: 'checklist',
  note: 'note',
  document: 'folder',
  time_entry: 'schedule',
  time: 'schedule',
};

/**
 * Activity tab for the matter workspace (PRD Module 4, AC-M2): "Timeline
 * merges 6 entity types in correct chronological order with cursor paging."
 * Rendered in the order the API returns entries — sorting isn't this
 * component's job.
 */
@Component({
  selector: 'lf-matter-activity-tab',
  standalone: true,
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="matter-activity-tab">
      @if (loading()) {
        <div class="matter-activity-tab__spinner">
          <mat-spinner diameter="32" />
        </div>
      } @else if (error()) {
        <lf-empty-state
          icon="error_outline"
          title="Couldn't load activity"
          i18n-title="@@matters.matterActivityTab.loadErrorTitle"
          message="Something went wrong while loading the timeline."
          i18n-message="@@matters.matterActivityTab.loadErrorMessage"
          ctaLabel="Retry"
          i18n-ctaLabel="@@matters.matterActivityTab.retryButton"
          (cta)="load()"
        />
      } @else if (entries().length === 0) {
        <lf-empty-state
          icon="event"
          title="No activity yet"
          i18n-title="@@matters.matterActivityTab.emptyTitle"
        />
      } @else {
        <ul class="matter-activity-tab__list">
          @for (entry of entries(); track entry.id) {
            <li class="matter-activity-tab__row">
              <mat-icon class="matter-activity-tab__icon">{{ iconFor(entry.entryType) }}</mat-icon>
              <div class="matter-activity-tab__body">
                <p class="matter-activity-tab__summary">{{ entry.summary }}</p>
                <p class="matter-activity-tab__date">{{ entry.occurredAt | date: 'short' }}</p>
              </div>
            </li>
          }
        </ul>
        @if (hasMore()) {
          <button mat-stroked-button type="button" [disabled]="loadingMore()" (click)="loadMore()">
            @if (loadingMore()) {
              <mat-spinner diameter="18" />
            } @else {
              <span i18n="@@matters.matterActivityTab.loadMoreButton">Load more</span>
            }
          </button>
        }
      }
    </div>
  `,
  styles: `
    .matter-activity-tab {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-2);
    }

    .matter-activity-tab__spinner {
      display: flex;
      justify-content: center;
      padding: var(--lf-space-4);
    }

    .matter-activity-tab__list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-1);
    }

    .matter-activity-tab__row {
      display: flex;
      align-items: flex-start;
      gap: var(--lf-space-2);
      padding: var(--lf-space-1) 0;
      border-bottom: 1px solid var(--lf-surface-variant);
    }

    .matter-activity-tab__icon {
      color: var(--lf-on-surface-variant);
      flex-shrink: 0;
    }

    .matter-activity-tab__body {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .matter-activity-tab__summary {
      margin: 0;
      font-size: var(--lf-text-sm);
    }

    .matter-activity-tab__date {
      margin: 0;
      font-size: var(--lf-text-xs);
      color: var(--lf-on-surface-variant);
    }
  `,
})
export class MatterActivityTabComponent {
  private readonly mattersService = inject(MattersService);

  readonly matterId = input.required<string>();

  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly error = signal(false);
  readonly entries = signal<MatterTimelineEntry[]>([]);
  readonly hasMore = signal(false);

  constructor() {
    effect(() => {
      const id = this.matterId();
      if (id) {
        this.load();
      }
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.hasMore.set(false);
    this.mattersService.timeline(this.matterId()).subscribe({
      next: (entries) => {
        this.entries.set(entries);
        this.hasMore.set(entries.length > 0);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  loadMore(): void {
    const existing = this.entries();
    const lastId = existing[existing.length - 1]?.id;
    if (!lastId) {
      this.hasMore.set(false);
      return;
    }

    this.loadingMore.set(true);
    // Assumption: no cursor shape is documented beyond "opaque string"; the
    // last-loaded entry's `id` is used as a best-effort cursor value.
    this.mattersService.timeline(this.matterId(), undefined, lastId).subscribe({
      next: (more) => {
        this.loadingMore.set(false);
        if (more.length === 0) {
          this.hasMore.set(false);
          return;
        }
        this.entries.update((current) => [...current, ...more]);
      },
      error: () => {
        this.loadingMore.set(false);
        this.hasMore.set(false);
      },
    });
  }

  iconFor(entryType: string): string {
    return ACTIVITY_ICONS[entryType.toLowerCase()] ?? 'event';
  }
}
