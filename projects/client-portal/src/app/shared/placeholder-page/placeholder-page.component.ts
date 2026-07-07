import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Routed placeholder shown for every portal feature until built out (Module 17). */
@Component({
  selector: 'app-placeholder-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="placeholder-page">
      <h1>{{ title() }}</h1>
      <p>{{ description() }}</p>
    </div>
  `,
  styles: `
    .placeholder-page {
      padding: var(--lf-space-3);
      max-width: var(--lf-content-max-width);
    }

    h1 {
      font-family: var(--lf-font-portal-heading);
      font-size: var(--lf-text-2xl);
      margin: 0 0 var(--lf-space-1);
      color: var(--lf-on-surface);
    }

    p {
      color: var(--lf-on-surface-variant);
      margin: 0;
    }
  `,
})
export class PlaceholderPageComponent {
  readonly title = input.required<string>();
  readonly description = input('This section has not been built yet.');
}
