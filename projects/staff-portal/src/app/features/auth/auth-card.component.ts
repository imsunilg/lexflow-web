import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Shared centered-card layout for every auth screen (Login, 2FA, Forgot/Reset, Accept invitation — PRD §11). */
@Component({
  selector: 'lf-staff-auth-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth-card">
      <div class="auth-card__panel">
        <h1>{{ title() }}</h1>
        @if (subtitle()) {
          <p class="auth-card__subtitle">{{ subtitle() }}</p>
        }
        <ng-content />
      </div>
    </div>
  `,
  styles: `
    .auth-card {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--lf-space-3);
      background: var(--lf-surface-variant);
    }

    .auth-card__panel {
      width: 100%;
      max-width: 400px;
      padding: var(--lf-space-4);
      border-radius: var(--lf-radius);
      background: var(--lf-surface);
      box-shadow: var(--lf-elevation-2);
    }

    h1 {
      font-size: var(--lf-text-xl);
      margin: 0 0 var(--lf-space-1);
      color: var(--lf-on-surface);
    }

    .auth-card__subtitle {
      margin: 0 0 var(--lf-space-3);
      color: var(--lf-on-surface-variant);
      font-size: var(--lf-text-sm);
    }
  `,
})
export class AuthCardComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
}
