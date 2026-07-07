import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';

/**
 * Shell card every dashboard widget (PRD §25, Module 1 — 12 widgets) is rendered
 * inside: title, optional refresh action, loading bar, and a content slot.
 * Per-widget bodies are added as the widget registry (`widget-catalog.ts`) fills
 * in; this component only owns the frame.
 */
@Component({
  selector: 'lf-dashboard-widget',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="lf-widget" [class.lf-widget--loading]="loading()">
      <header class="lf-widget__header">
        <h3 class="lf-widget__title">{{ title() }}</h3>
        @if (refreshable()) {
          <button
            mat-icon-button
            type="button"
            [attr.aria-label]="'Refresh ' + title()"
            (click)="refresh.emit()"
          >
            <mat-icon>refresh</mat-icon>
          </button>
        }
      </header>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      }

      <div class="lf-widget__body">
        <ng-content />
      </div>
    </section>
  `,
  styles: `
    .lf-widget {
      display: flex;
      flex-direction: column;
      background: var(--lf-surface);
      border-radius: var(--lf-radius);
      box-shadow: var(--lf-elevation-1);
      padding: var(--lf-space-2);
      min-height: 160px;
    }

    .lf-widget__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--lf-space-1);
    }

    .lf-widget__title {
      margin: 0;
      font-size: var(--lf-text-md);
      font-weight: 600;
      color: var(--lf-on-surface);
    }

    .lf-widget__body {
      flex: 1;
    }
  `,
})
export class DashboardWidgetComponent {
  readonly title = input.required<string>();
  readonly loading = input(false);
  readonly refreshable = input(true);
  readonly refresh = output<void>();
}
