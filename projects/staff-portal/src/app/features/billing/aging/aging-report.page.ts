import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AgingReport, BillingReportsService, LfCurrencyPipe } from 'shared';

interface Bucket {
  key: keyof Omit<AgingReport, 'total'>;
  label: string;
  tone: 'success' | 'info' | 'warn' | 'warn-deep' | 'error';
}

const BUCKETS: Bucket[] = [
  { key: 'current', label: 'Current', tone: 'success' },
  { key: 'bucket1To30', label: '1–30 days', tone: 'info' },
  { key: 'bucket31To60', label: '31–60 days', tone: 'warn' },
  { key: 'bucket61To90', label: '61–90 days', tone: 'warn-deep' },
  { key: 'over90', label: 'Over 90 days', tone: 'error' },
];

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Aging report (PRD Module 8 UI Components: "aging report grid"; AC-B6:
 * "buckets sum to total AR exactly"). `GET /billing/aging` returns one flat
 * report object, not a list, so this renders it as a single hand-rolled bar
 * breakdown (no charting library in this repo) rather than a grid of rows.
 */
@Component({
  selector: 'lf-aging-report-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    LfCurrencyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './aging-report.page.html',
  styleUrl: './aging-report.page.scss',
})
export class AgingReportPage {
  private readonly billingReportsService = inject(BillingReportsService);

  readonly buckets = BUCKETS;
  readonly asOfControl = new FormControl<Date | null>(new Date());
  readonly report = signal<AgingReport | null>(null);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly bucketsSum = computed(() => {
    const r = this.report();
    if (!r) return 0;
    return BUCKETS.reduce((sum, b) => sum + r[b.key], 0);
  });

  readonly reconciles = computed(() => {
    const r = this.report();
    if (!r) return true;
    return Math.abs(this.bucketsSum() - r.total) < 0.01;
  });

  constructor() {
    this.load();
  }

  load(): void {
    const asOf = this.asOfControl.value;
    this.loading.set(true);
    this.errorMessage.set(null);
    this.billingReportsService.aging(asOf ? toIsoDate(asOf) : undefined).subscribe({
      next: (report) => {
        this.report.set(report);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Could not load the aging report.');
      },
    });
  }

  widthPct(amount: number): number {
    const total = this.report()?.total ?? 0;
    if (total <= 0) return 0;
    return Math.max(0, Math.min(100, (amount / total) * 100));
  }
}
