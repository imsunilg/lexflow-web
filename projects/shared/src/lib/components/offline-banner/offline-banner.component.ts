import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { OfflineMutationQueueService } from '../../services/offline-mutation-queue.service';

/**
 * "offline banner (web PWA) with retry" (PRD §12). Mounted once per app shell.
 * Tracks `navigator.onLine` via the `online`/`offline` window events (there is
 * no reactive browser API for connectivity beyond that pair) and surfaces the
 * offline mutation queue's pending count so a user can see queued work is
 * waiting, not lost.
 */
@Component({
  selector: 'lf-offline-banner',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (offline()) {
      <div class="lf-offline-banner" role="status">
        <mat-icon>cloud_off</mat-icon>
        <span>
          You're offline.
          @if (queue.pendingCount() > 0) {
            {{ queue.pendingCount() }} change{{ queue.pendingCount() === 1 ? '' : 's' }} queued to
            sync.
          }
        </span>
        <button mat-button type="button" (click)="retry()">Retry</button>
      </div>
    }
  `,
  styles: `
    .lf-offline-banner {
      display: flex;
      align-items: center;
      gap: var(--lf-space-1);
      padding: var(--lf-space-1) var(--lf-space-2);
      background: var(--lf-warn);
      color: white;
      font-size: var(--lf-text-sm);

      span {
        flex: 1;
      }

      button {
        color: white;
      }
    }
  `,
})
export class OfflineBannerComponent {
  readonly queue = inject(OfflineMutationQueueService);
  private readonly destroyRef = inject(DestroyRef);

  readonly offline = signal(!navigator.onLine);

  constructor() {
    const goOffline = () => this.offline.set(true);
    const goOnline = () => this.offline.set(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    });
  }

  retry(): void {
    this.queue.flush().subscribe();
  }
}
