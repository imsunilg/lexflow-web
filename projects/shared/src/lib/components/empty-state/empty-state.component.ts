import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/** Designed empty state with CTA, required on every list per PRD §12. */
@Component({
  selector: 'lf-empty-state',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lf-empty-state">
      <mat-icon class="lf-empty-state__icon">{{ icon() }}</mat-icon>
      <p class="lf-empty-state__title">{{ title() }}</p>
      @if (message()) {
        <p class="lf-empty-state__message">{{ message() }}</p>
      }
      @if (ctaLabel()) {
        <button mat-flat-button type="button" (click)="cta.emit()">{{ ctaLabel() }}</button>
      }
    </div>
  `,
  styles: `
    .lf-empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: var(--lf-space-1);
      padding: var(--lf-space-5) var(--lf-space-2);
      color: var(--lf-on-surface-variant);
    }

    .lf-empty-state__icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      opacity: 0.6;
    }

    .lf-empty-state__title {
      font-size: var(--lf-text-md);
      font-weight: 600;
      color: var(--lf-on-surface);
      margin: 0;
    }

    .lf-empty-state__message {
      margin: 0;
      max-width: 40ch;
    }
  `,
})
export class EmptyStateComponent {
  readonly icon = input('inbox');
  readonly title = input.required<string>();
  readonly message = input<string>();
  readonly ctaLabel = input<string>();
  readonly cta = output<void>();
}
