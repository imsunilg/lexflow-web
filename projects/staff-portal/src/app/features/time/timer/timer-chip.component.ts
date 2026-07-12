import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Matter, MattersService, TimerService } from 'shared';
import { StartTimerDialogComponent } from './start-timer-dialog.component';
import { StopTimerDialogComponent, StopTimerDialogData } from './stop-timer-dialog.component';

function formatElapsed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
}

/**
 * Persistent timer chip (PRD Module 9 UI Components: "Persistent timer chip
 * (elapsed, matter tag, pulsing when running); stop dialog"). Extracted out
 * of the shell so the full Start/Pause/Resume/Stop flow lives in one place;
 * the shell just embeds this component in its top bar.
 */
@Component({
  selector: 'lf-timer-chip',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      mat-stroked-button
      type="button"
      class="timer-chip"
      [class.timer-chip--running]="runningTimer() && !runningTimer()!.isPaused"
      [matMenuTriggerFor]="menu"
      aria-label="Timer"
      i18n-aria-label="@@time.timerChip.ariaLabel"
      [matTooltip]="matterLabel() ?? 'No matter linked'"
    >
      <mat-icon>timer</mat-icon>
      <span>{{ timerDisplay() }}</span>
      @if (matterLabel()) {
        <span class="timer-chip__matter">{{ matterLabel() }}</span>
      }
    </button>

    <mat-menu #menu="matMenu">
      @if (!runningTimer()) {
        <button mat-menu-item type="button" (click)="openStartDialog()">
          <mat-icon>play_arrow</mat-icon>
          <span i18n="@@time.timerChip.startAction">Start timer</span>
        </button>
      } @else {
        @if (runningTimer()!.isPaused) {
          <button mat-menu-item type="button" (click)="resume()">
            <mat-icon>play_arrow</mat-icon>
            <span i18n="@@time.timerChip.resumeAction">Resume</span>
          </button>
        } @else {
          <button mat-menu-item type="button" (click)="pause()">
            <mat-icon>pause</mat-icon>
            <span i18n="@@time.timerChip.pauseAction">Pause</span>
          </button>
        }
        <button mat-menu-item type="button" (click)="openStopDialog()">
          <mat-icon>stop</mat-icon>
          <span i18n="@@time.timerChip.stopAction">Stop</span>
        </button>
      }
    </mat-menu>
  `,
  styles: `
    .timer-chip {
      display: flex;
      align-items: center;
      gap: 6px;
      font-variant-numeric: tabular-nums;
    }

    .timer-chip__matter {
      max-width: 140px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--lf-text-xs);
      color: var(--lf-on-surface-variant);
    }

    .timer-chip--running mat-icon {
      color: var(--lf-success);
      animation: timer-chip-pulse 1.6s ease-in-out infinite;
    }

    @keyframes timer-chip-pulse {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.5;
      }
    }
  `,
})
export class TimerChipComponent {
  private readonly timerService = inject(TimerService);
  private readonly mattersService = inject(MattersService);
  private readonly dialog = inject(MatDialog);

  readonly runningTimer = this.timerService.current;
  readonly timerDisplay = computed(() => formatElapsed(this.timerService.elapsedSeconds()));

  readonly matterLabel = signal<string | null>(null);

  constructor() {
    effect(() => {
      const matterId = this.runningTimer()?.matterId;
      if (!matterId) {
        this.matterLabel.set(null);
        return;
      }
      this.mattersService.get(matterId).subscribe({
        next: (matter: Matter) => this.matterLabel.set(matter.number),
        error: () => this.matterLabel.set(null),
      });
    });
  }

  openStartDialog(): void {
    this.dialog
      .open(StartTimerDialogComponent)
      .afterClosed()
      .subscribe((request) => {
        if (!request) return;
        this.timerService.start(request).subscribe();
      });
  }

  pause(): void {
    this.timerService.pause().subscribe();
  }

  resume(): void {
    this.timerService.resume().subscribe();
  }

  openStopDialog(): void {
    this.dialog
      .open<StopTimerDialogComponent, StopTimerDialogData>(StopTimerDialogComponent, {
        data: { elapsedSeconds: this.timerService.elapsedSeconds() },
      })
      .afterClosed()
      .subscribe((request) => {
        if (!request) return;
        this.timerService.stop(request).subscribe();
      });
  }
}
