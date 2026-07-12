import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { EmptyStateComponent, Hearing, HearingsService } from 'shared';

interface CauseListGroup {
  courtroom: string;
  hearings: Hearing[];
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Printable cause-list day view (PRD Module 5 UI Components, AC-CC2): "all
 * firm hearings for a date, grouped by court, printable." `HearingDto`
 * carries no court reference (confirmed gap — no join to `court_cases`/`courts`
 * is exposed), so this groups by `courtroom` instead as the closest available
 * proxy for "grouped by court" until the API exposes a real court projection.
 */
@Component({
  selector: 'lf-staff-cause-list-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cause-list">
      <header class="cause-list__toolbar">
        <h1 i18n="@@matters.causeListPage.title">Cause list</h1>
        <mat-form-field appearance="outline">
          <mat-label i18n="@@matters.causeListPage.dateLabel">Date</mat-label>
          <input matInput [matDatepicker]="picker" [formControl]="dateControl" />
          <mat-datepicker-toggle matIconSuffix [for]="picker" />
          <mat-datepicker #picker />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label i18n="@@matters.causeListPage.lawyerIdLabel">Lawyer ID (optional)</mat-label>
          <input matInput [formControl]="lawyerIdControl" />
        </mat-form-field>
        <button
          mat-stroked-button
          type="button"
          (click)="load()"
          i18n="@@matters.causeListPage.loadButton"
        >
          Load
        </button>
        <button mat-flat-button color="primary" type="button" (click)="print()">
          <mat-icon>print</mat-icon>
          <span i18n="@@matters.causeListPage.printButton">Print</span>
        </button>
      </header>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      } @else if (groups().length === 0) {
        <lf-empty-state
          icon="event_available"
          title="No hearings scheduled for this date"
          i18n-title="@@matters.causeListPage.emptyTitle"
        />
      } @else {
        <p class="cause-list__date-heading">
          {{ dateControl.value ? dateControl.value!.toDateString() : '' }}
        </p>
        @for (group of groups(); track group.courtroom) {
          <section class="cause-list__group">
            <h2>{{ group.courtroom }}</h2>
            <table class="cause-list__table">
              <thead>
                <tr>
                  <th i18n="@@matters.causeListPage.timeColumn">Time</th>
                  <th i18n="@@matters.causeListPage.purposeColumn">Purpose</th>
                  <th i18n="@@matters.causeListPage.statusColumn">Status</th>
                </tr>
              </thead>
              <tbody>
                @for (hearing of group.hearings; track hearing.id) {
                  <tr>
                    <td>{{ hearing.time || '—' }}</td>
                    <td>{{ hearing.purpose || '—' }}</td>
                    <td>{{ hearing.status }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </section>
        }
      }
    </div>
  `,
  styles: `
    .cause-list {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-2);
      padding: var(--lf-space-3);
    }

    .cause-list__toolbar {
      display: flex;
      align-items: center;
      gap: var(--lf-space-2);
      flex-wrap: wrap;
    }

    .cause-list__date-heading {
      font-weight: 600;
    }

    .cause-list__group {
      break-inside: avoid;
    }

    .cause-list__table {
      width: 100%;
      border-collapse: collapse;
    }

    .cause-list__table th,
    .cause-list__table td {
      text-align: left;
      padding: 4px 8px;
      border-bottom: 1px solid var(--lf-surface-variant);
      font-size: var(--lf-text-sm);
    }

    @media print {
      @page {
        size: A4;
        margin: 16mm;
      }

      .cause-list__toolbar button,
      .cause-list__toolbar mat-form-field {
        display: none;
      }

      .cause-list {
        padding: 0;
        gap: var(--lf-space-1);
      }
    }
  `,
})
export class CauseListPage {
  private readonly hearingsService = inject(HearingsService);

  readonly loading = signal(false);
  readonly hearings = signal<Hearing[]>([]);

  readonly dateControl = new FormControl<Date>(new Date(), { nonNullable: true });
  readonly lawyerIdControl = new FormControl('', { nonNullable: true });

  readonly groups = computed<CauseListGroup[]>(() => {
    const byCourtroom = new Map<string, Hearing[]>();
    for (const hearing of this.hearings()) {
      const key = hearing.courtroom || 'Unspecified courtroom';
      const list = byCourtroom.get(key) ?? [];
      list.push(hearing);
      byCourtroom.set(key, list);
    }
    return [...byCourtroom.entries()]
      .map(([courtroom, hearings]) => ({
        courtroom,
        hearings: hearings.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')),
      }))
      .sort((a, b) => a.courtroom.localeCompare(b.courtroom));
  });

  constructor() {
    this.load();
  }

  load(): void {
    const date = this.dateControl.value;
    if (!date) {
      return;
    }
    this.loading.set(true);
    this.hearingsService
      .causeList(toIsoDate(date), undefined, this.lawyerIdControl.value || undefined)
      .subscribe({
        next: (hearings) => {
          this.hearings.set(hearings);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  print(): void {
    window.print();
  }
}
