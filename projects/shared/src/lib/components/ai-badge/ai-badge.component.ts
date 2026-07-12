import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AiService } from '../../services/ai.service';

/**
 * AI-badge + feedback (PRD Module 16, BR-19/AC-AI5: "every AI output rendered
 * with AI-badge and requires explicit Save/Insert action"). `isAiGenerated`
 * is structurally guaranteed `true` server-side on every AI response DTO —
 * this component always renders the badge, it never conditionally hides it.
 * Feedback is a real call (`POST /ai/interactions/{id}/feedback`), strictly
 * `rating: 1 | -1` (thumbs up/down) — the server rejects any other value.
 */
@Component({
  selector: 'lf-ai-badge',
  standalone: true,
  imports: [MatIconModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ai-badge">
      <span class="ai-badge__label" [matTooltip]="disclaimer()">
        <mat-icon inline>auto_awesome</mat-icon>
        AI-generated — review required
      </span>
      @if (interactionId()) {
        <span class="ai-badge__feedback">
          <button
            type="button"
            class="ai-badge__feedback-btn"
            [class.ai-badge__feedback-btn--active]="sent() === 1"
            [disabled]="sending()"
            (click)="sendFeedback(1)"
            aria-label="Helpful"
          >
            <mat-icon inline>thumb_up</mat-icon>
          </button>
          <button
            type="button"
            class="ai-badge__feedback-btn"
            [class.ai-badge__feedback-btn--active]="sent() === -1"
            [disabled]="sending()"
            (click)="sendFeedback(-1)"
            aria-label="Not helpful"
          >
            <mat-icon inline>thumb_down</mat-icon>
          </button>
        </span>
      }
    </div>
  `,
  styles: `
    .ai-badge {
      display: flex;
      align-items: center;
      gap: var(--lf-space-2);
      font-size: var(--lf-text-xs);
      color: var(--lf-on-surface-variant);
    }

    .ai-badge__label {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: var(--lf-surface-variant);
      border-radius: var(--lf-radius);
      padding: 2px 8px;
    }

    .ai-badge__feedback {
      display: flex;
      gap: 2px;
    }

    .ai-badge__feedback-btn {
      border: none;
      background: transparent;
      cursor: pointer;
      color: var(--lf-on-surface-variant);
      display: flex;
    }

    .ai-badge__feedback-btn--active {
      color: var(--lf-primary);
    }
  `,
})
export class AiBadgeComponent {
  private readonly aiService = inject(AiService);

  readonly interactionId = input<string | null>(null);
  readonly disclaimer = input(
    'AI-generated — review required. A human action (save/insert/send) is always required before this becomes part of the record.',
  );

  readonly sending = signal(false);
  readonly sent = signal<1 | -1 | null>(null);

  sendFeedback(rating: 1 | -1): void {
    const id = this.interactionId();
    if (!id || this.sending()) return;

    this.sending.set(true);
    this.aiService.sendFeedback(id, { rating }).subscribe({
      next: () => {
        this.sending.set(false);
        this.sent.set(rating);
      },
      error: () => this.sending.set(false),
    });
  }
}
