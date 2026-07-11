import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { AnalyticsRange, DateRange, DateRangePickerComponent } from 'shared';
import { customRange, isRangeWithinLimit, rangeForPreset } from './analytics-range.util';

/**
 * "This week/month/quarter/custom" selector affecting the dashboard's analytic
 * widgets (PRD Module 1 UI Components). Custom ranges beyond 366 days are
 * rejected client-side to match the backend's own validation rule rather than
 * round-tripping a request that will 400.
 */
@Component({
  selector: 'lf-dashboard-date-range-selector',
  standalone: true,
  imports: [MatButtonToggleModule, DateRangePickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="range-selector">
      <mat-button-toggle-group [value]="range().preset" (change)="onPresetChange($event.value)">
        <mat-button-toggle value="week">This week</mat-button-toggle>
        <mat-button-toggle value="month">This month</mat-button-toggle>
        <mat-button-toggle value="quarter">This quarter</mat-button-toggle>
        <mat-button-toggle value="custom">Custom</mat-button-toggle>
      </mat-button-toggle-group>

      @if (range().preset === 'custom') {
        <lf-date-range-picker label="Custom range" (rangeChange)="onCustomRange($event)" />
      }

      @if (rangeTooLarge()) {
        <p class="range-selector__error" role="alert">Date ranges can't exceed 366 days.</p>
      }
    </div>
  `,
  styles: `
    .range-selector {
      display: flex;
      align-items: center;
      gap: var(--lf-space-2);
      flex-wrap: wrap;
    }

    .range-selector__error {
      margin: 0;
      color: var(--lf-error);
      font-size: var(--lf-text-xs);
    }
  `,
})
export class DashboardDateRangeSelectorComponent {
  readonly range = input.required<AnalyticsRange>();
  readonly rangeChange = output<AnalyticsRange>();

  readonly rangeTooLarge = signal(false);

  onPresetChange(preset: 'week' | 'month' | 'quarter' | 'custom'): void {
    this.rangeTooLarge.set(false);
    if (preset === 'custom') {
      // Wait for an explicit custom range from the picker before emitting.
      return;
    }
    this.rangeChange.emit(rangeForPreset(preset));
  }

  onCustomRange(dateRange: DateRange): void {
    if (!dateRange.start || !dateRange.end) {
      return;
    }
    const range = customRange(dateRange.start, dateRange.end);
    if (!isRangeWithinLimit(range)) {
      this.rangeTooLarge.set(true);
      return;
    }
    this.rangeTooLarge.set(false);
    this.rangeChange.emit(range);
  }
}
