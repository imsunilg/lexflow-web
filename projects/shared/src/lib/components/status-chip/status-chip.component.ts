import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type StatusChipTone = 'success' | 'warn' | 'error' | 'info' | 'neutral';

/** Maps common status strings to a semantic tone; unmapped values fall back to `neutral`. */
const DEFAULT_STATUS_TONE_MAP: Record<string, StatusChipTone> = {
  active: 'success',
  open: 'success',
  paid: 'success',
  approved: 'success',
  scheduled: 'info',
  draft: 'neutral',
  pending: 'warn',
  onhold: 'warn',
  overdue: 'error',
  disposed: 'neutral',
  closed: 'neutral',
  cancelled: 'error',
  rejected: 'error',
  void: 'error',
};

/** Small colored status indicator (PRD §12 grids/tables, countdown color shift pattern). */
@Component({
  selector: 'lf-status-chip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="lf-status-chip" [attr.data-tone]="tone()">{{ label() }}</span>`,
  styles: `
    .lf-status-chip {
      display: inline-flex;
      align-items: center;
      padding: 2px 10px;
      border-radius: 999px;
      font-size: var(--lf-text-xs);
      font-weight: 600;
      line-height: 1.6;
    }

    .lf-status-chip[data-tone='success'] {
      background: color-mix(in srgb, var(--lf-success) 16%, transparent);
      color: var(--lf-success);
    }

    .lf-status-chip[data-tone='warn'] {
      background: color-mix(in srgb, var(--lf-warn) 16%, transparent);
      color: var(--lf-warn);
    }

    .lf-status-chip[data-tone='error'] {
      background: color-mix(in srgb, var(--lf-error) 16%, transparent);
      color: var(--lf-error);
    }

    .lf-status-chip[data-tone='info'] {
      background: color-mix(in srgb, var(--lf-info) 16%, transparent);
      color: var(--lf-info);
    }

    .lf-status-chip[data-tone='neutral'] {
      background: var(--lf-surface-variant);
      color: var(--lf-on-surface-variant);
    }
  `,
})
export class StatusChipComponent {
  readonly label = input.required<string>();
  /** Explicit tone override; when omitted, derived from `label` via the default status map. */
  readonly toneOverride = input<StatusChipTone>();

  readonly tone = computed<StatusChipTone>(
    () =>
      this.toneOverride() ??
      DEFAULT_STATUS_TONE_MAP[this.label().toLowerCase().replace(/[\s-]/g, '')] ??
      'neutral',
  );
}
