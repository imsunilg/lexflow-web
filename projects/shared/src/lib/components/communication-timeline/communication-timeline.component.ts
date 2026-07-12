import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { CommChannel, COMM_CHANNELS, CommTimelineEntry } from '../../models/communication.models';
import { CommTimelineService } from '../../services/comm-timeline.service';
import { EmptyStateComponent } from '../empty-state/empty-state.component';

const CHANNEL_ICONS: Record<CommChannel, string> = {
  Email: 'mail',
  SMS: 'sms',
  WhatsApp: 'chat',
  Call: 'call',
};

/**
 * Reusable communication timeline (PRD Module 11: "Unified client
 * Communication tab: reverse-chron across all channels with channel icons,
 * filter chips"), embedded in both Client 360° (Module 3) and Matter 360°
 * (Module 4).
 *
 * The real `GET /comm/timeline` endpoint only accepts `clientId` — there is
 * no `matterId` filter server-side at all (confirmed: neither the query, its
 * handler, nor the controller action have a matter parameter). Matter 360°
 * therefore passes the matter's own `clientId` and this component says so
 * plainly, rather than silently showing client-wide data under a
 * matter-scoped label.
 *
 * Chat is NOT part of this feed — the timeline endpoint only aggregates
 * Email/SMS/WhatsApp/Call. Each channel is capped at 200 rows server-side
 * with no further pagination.
 */
@Component({
  selector: 'lf-communication-timeline',
  standalone: true,
  imports: [
    DatePipe,
    MatButtonToggleModule,
    MatIconModule,
    MatProgressBarModule,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="comm-timeline">
      @if (matterScoped()) {
        <p class="comm-timeline__note">
          Showing all communications with this matter's client — the API has no per-matter filter.
        </p>
      }

      <mat-button-toggle-group
        class="comm-timeline__filters"
        multiple
        [value]="selectedChannels()"
        (change)="onChannelsChange($event.value)"
      >
        @for (channel of channels; track channel) {
          <mat-button-toggle [value]="channel">
            <mat-icon>{{ iconFor(channel) }}</mat-icon>
            {{ channel }}
          </mat-button-toggle>
        }
      </mat-button-toggle-group>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      } @else if (sortedEntries().length === 0) {
        <lf-empty-state icon="forum" title="No communications recorded" />
      } @else {
        <ul class="comm-timeline__list">
          @for (entry of sortedEntries(); track entry.entityId + entry.channel) {
            <li class="comm-timeline__row">
              <mat-icon class="comm-timeline__icon">{{ iconFor(entry.channel) }}</mat-icon>
              <div class="comm-timeline__body">
                <p class="comm-timeline__summary">{{ entry.summary }}</p>
                <p class="comm-timeline__meta">
                  {{ entry.channel }} · {{ entry.direction }} ·
                  {{ entry.at | date: 'MMM d, y h:mm a' }}
                </p>
              </div>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    .comm-timeline {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-2);
    }

    .comm-timeline__note {
      margin: 0;
      font-size: var(--lf-text-xs);
      color: var(--lf-on-surface-variant);
    }

    .comm-timeline__filters {
      align-self: flex-start;
    }

    .comm-timeline__list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-1);
    }

    .comm-timeline__row {
      display: flex;
      align-items: flex-start;
      gap: var(--lf-space-2);
      padding: var(--lf-space-1) 0;
      border-bottom: 1px solid var(--lf-surface-variant);
    }

    .comm-timeline__icon {
      color: var(--lf-on-surface-variant);
      flex-shrink: 0;
    }

    .comm-timeline__body {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .comm-timeline__summary {
      margin: 0;
      font-size: var(--lf-text-sm);
    }

    .comm-timeline__meta {
      margin: 0;
      font-size: var(--lf-text-xs);
      color: var(--lf-on-surface-variant);
    }
  `,
})
export class CommunicationTimelineComponent {
  private readonly commTimelineService = inject(CommTimelineService);

  readonly clientId = input.required<string>();
  /** Set when the caller is embedding this from a matter context (no real matter-level filter exists — see class doc comment). */
  readonly matterScoped = input(false);

  readonly channels = COMM_CHANNELS;
  readonly selectedChannels = signal<CommChannel[]>([...COMM_CHANNELS]);

  readonly loading = signal(true);
  readonly entries = signal<CommTimelineEntry[]>([]);

  readonly sortedEntries = computed(() =>
    [...this.entries()].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
  );

  constructor() {
    effect(() => {
      const id = this.clientId();
      const channels = this.selectedChannels();
      if (id) {
        this.load(id, channels);
      }
    });
  }

  private load(clientId: string, channels: CommChannel[]): void {
    this.loading.set(true);
    this.commTimelineService.get(clientId, channels).subscribe({
      next: (entries) => {
        this.entries.set(entries);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onChannelsChange(value: CommChannel[]): void {
    this.selectedChannels.set(value);
  }

  iconFor(channel: CommChannel): string {
    return CHANNEL_ICONS[channel];
  }
}
