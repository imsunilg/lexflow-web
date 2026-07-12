import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { EmptyStateComponent, KbMatterPin, KbMatterPinsService } from 'shared';
import { KbPinDialogComponent, KbPinDialogData } from '../kb-pin-dialog.component';

const KIND_ICONS: Record<string, string> = {
  Act: 'gavel',
  ActSection: 'menu_book',
  Judgment: 'balance',
  Article: 'article',
};

/**
 * Research tab (PRD Module 12, AC-KB4: "Pinning a judgment into a matter
 * shows it in matter Research tab with note"). This tab didn't exist before
 * Module 12 — added here specifically to host the pin dialog and list what's
 * been pinned. Each row shows the frozen `snapshotText` captured at pin
 * time, not a live fetch of the source — it stays correct even if the
 * source KB item is later edited, unpublished, or deleted.
 */
@Component({
  selector: 'lf-matter-research-tab',
  standalone: true,
  imports: [DatePipe, MatButtonModule, MatIconModule, MatProgressBarModule, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="research-tab">
      <button mat-stroked-button type="button" (click)="openPinDialog()">
        <mat-icon>push_pin</mat-icon> Pin from Knowledge Base
      </button>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      } @else if (pins().length === 0) {
        <lf-empty-state icon="push_pin" title="Nothing pinned yet" />
      } @else {
        <ul class="research-tab__list">
          @for (pin of pins(); track pin.id) {
            <li class="research-tab__row">
              <mat-icon>{{ iconFor(pin.kbRefKind) }}</mat-icon>
              <div class="research-tab__body">
                <p class="research-tab__snapshot">{{ pin.snapshotText }}</p>
                @if (pin.note) {
                  <p class="research-tab__note">{{ pin.note }}</p>
                }
                <span class="research-tab__meta">{{ pin.pinnedAt | date: 'MMM d, y' }}</span>
              </div>
              <button mat-icon-button type="button" (click)="unpin(pin)">
                <mat-icon>close</mat-icon>
              </button>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    .research-tab {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-2);
      align-items: flex-start;
    }

    .research-tab__list {
      list-style: none;
      margin: 0;
      padding: 0;
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-1);
    }

    .research-tab__row {
      display: flex;
      align-items: flex-start;
      gap: var(--lf-space-1);
      padding: var(--lf-space-1);
      border-bottom: 1px solid var(--lf-surface-variant);
    }

    .research-tab__body {
      flex: 1;
    }

    .research-tab__snapshot {
      margin: 0;
      font-size: var(--lf-text-sm);
      white-space: pre-wrap;
    }

    .research-tab__note {
      margin: 4px 0 0;
      font-size: var(--lf-text-sm);
      color: var(--lf-on-surface-variant);
      font-style: italic;
    }

    .research-tab__meta {
      font-size: var(--lf-text-xs);
      color: var(--lf-on-surface-variant);
    }
  `,
})
export class MatterResearchTabComponent {
  private readonly kbMatterPinsService = inject(KbMatterPinsService);
  private readonly dialog = inject(MatDialog);

  readonly matterId = input.required<string>();

  readonly loading = signal(true);
  readonly pins = signal<KbMatterPin[]>([]);

  constructor() {
    effect(() => {
      const id = this.matterId();
      if (id) this.load(id);
    });
  }

  private load(matterId: string): void {
    this.loading.set(true);
    this.kbMatterPinsService.list(matterId).subscribe({
      next: (pins) => {
        this.pins.set(pins);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  iconFor(kind: string): string {
    return KIND_ICONS[kind] ?? 'description';
  }

  openPinDialog(): void {
    this.dialog
      .open<KbPinDialogComponent, KbPinDialogData, KbMatterPin>(KbPinDialogComponent, {
        data: { matterId: this.matterId() },
      })
      .afterClosed()
      .subscribe((pin) => {
        if (pin) this.pins.update((current) => [pin, ...current]);
      });
  }

  unpin(pin: KbMatterPin): void {
    this.kbMatterPinsService.unpin(this.matterId(), pin.id).subscribe(() => {
      this.pins.update((current) => current.filter((p) => p.id !== pin.id));
    });
  }
}
