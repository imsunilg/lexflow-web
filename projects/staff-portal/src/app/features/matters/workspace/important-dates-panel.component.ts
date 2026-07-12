import { SlicePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import {
  EmptyStateComponent,
  IMPORTANT_DATE_KINDS,
  MatterImportantDate,
  MattersService,
  StatusChipComponent,
} from 'shared';
import { importantDateSeverity } from '../important-date-severity.util';

interface ImportantDateRow {
  date: MatterImportantDate;
  severity: ReturnType<typeof importantDateSeverity>;
}

const SEVERITY_TONE: Record<
  ReturnType<typeof importantDateSeverity>,
  'success' | 'info' | 'warn' | 'error'
> = {
  normal: 'success',
  watch: 'info',
  warn: 'warn',
  critical: 'error',
};

/**
 * Important-dates side panel (PRD Module 4 UI Components; BR-2 escalation
 * chain drives the severity badge — see `important-date-severity.util.ts`).
 * Limitation dates can't be deleted within 30 days of due (BR-2, DB
 * trigger) — only "marked satisfied," so no delete action is offered here
 * at all, matching the server's own rule.
 */
@Component({
  selector: 'lf-important-dates-panel',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    EmptyStateComponent,
    StatusChipComponent,
    SlicePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="important-dates">
      <h3 i18n="@@matters.importantDatesPanel.title">Important dates</h3>

      @if (loading()) {
        <p i18n="@@matters.importantDatesPanel.loading">Loading…</p>
      } @else if (rows().length === 0 && !addingNew()) {
        <lf-empty-state
          icon="event_busy"
          title="No important dates"
          i18n-title="@@matters.importantDatesPanel.emptyTitle"
          ctaLabel="Add date"
          i18n-ctaLabel="@@matters.importantDatesPanel.addDateButton"
          (cta)="addingNew.set(true)"
        />
      } @else {
        <ul class="important-dates__list">
          @for (row of rows(); track row.date.id) {
            <li class="important-dates__row">
              <div class="important-dates__row-header">
                <lf-status-chip [label]="row.date.kind" toneOverride="neutral" />
                <lf-status-chip
                  [label]="row.date.satisfiedAt ? 'Satisfied' : row.severity"
                  [toneOverride]="row.date.satisfiedAt ? 'success' : severityTone(row.severity)"
                />
              </div>
              <p class="important-dates__title">{{ row.date.title }}</p>
              <p class="important-dates__due" i18n="@@matters.importantDatesPanel.dueLabel">
                Due {{ row.date.dueAt | slice: 0 : 10 }}
              </p>
              @if (!row.date.satisfiedAt) {
                <button
                  mat-button
                  type="button"
                  (click)="markSatisfied(row.date)"
                  i18n="@@matters.importantDatesPanel.markSatisfiedButton"
                >
                  Mark satisfied
                </button>
              }
            </li>
          }
        </ul>

        @if (!addingNew()) {
          <button
            mat-stroked-button
            type="button"
            (click)="addingNew.set(true)"
            i18n="@@matters.importantDatesPanel.addDateButton"
          >
            Add date
          </button>
        }
      }

      @if (addingNew()) {
        <form [formGroup]="form" class="important-dates__form">
          <mat-form-field appearance="outline">
            <mat-label i18n="@@matters.importantDatesPanel.kindLabel">Kind</mat-label>
            <mat-select formControlName="kind">
              @for (kind of kinds; track kind) {
                <mat-option [value]="kind">{{ kind }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@matters.importantDatesPanel.titleLabel">Title</mat-label>
            <input matInput formControlName="title" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@matters.importantDatesPanel.dueDateLabel">Due date</mat-label>
            <input matInput [matDatepicker]="picker" [formControl]="dueAtControl" />
            <mat-datepicker-toggle matIconSuffix [for]="picker" />
            <mat-datepicker #picker />
          </mat-form-field>

          @if (soonWarning()) {
            <p class="important-dates__warning">{{ soonWarning() }}</p>
          }

          <div class="important-dates__form-actions">
            <button
              mat-button
              type="button"
              (click)="cancelAdd()"
              i18n="@@matters.importantDatesPanel.cancelButton"
            >
              Cancel
            </button>
            <button
              mat-flat-button
              color="primary"
              type="button"
              (click)="submit()"
              i18n="@@matters.importantDatesPanel.saveButton"
            >
              Save
            </button>
          </div>
        </form>
      }
    </div>
  `,
  styles: `
    .important-dates {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-2);
    }

    .important-dates__list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-1);
    }

    .important-dates__row {
      padding: var(--lf-space-1);
      border-radius: 8px;
      background: var(--lf-surface-variant);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .important-dates__row-header {
      display: flex;
      gap: var(--lf-space-1);
    }

    .important-dates__title {
      margin: 0;
      font-weight: 600;
    }

    .important-dates__due {
      margin: 0;
      font-size: var(--lf-text-xs);
      color: var(--lf-on-surface-variant);
    }

    .important-dates__form {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-1);
    }

    .important-dates__form-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--lf-space-1);
    }

    .important-dates__warning {
      margin: 0;
      color: var(--lf-warn);
      font-size: var(--lf-text-sm);
    }
  `,
})
export class ImportantDatesPanelComponent {
  private readonly mattersService = inject(MattersService);

  readonly matterId = input.required<string>();
  readonly kinds = IMPORTANT_DATE_KINDS;

  readonly loading = signal(true);
  readonly dates = signal<MatterImportantDate[]>([]);
  readonly addingNew = signal(false);

  readonly rows = computed<ImportantDateRow[]>(() =>
    this.dates()
      .map((date) => ({ date, severity: importantDateSeverity(date) }))
      .sort((a, b) => new Date(a.date.dueAt).getTime() - new Date(b.date.dueAt).getTime()),
  );

  readonly dueAtControl = new FormControl<Date | null>(null);

  readonly form = new FormGroup({
    kind: new FormControl(IMPORTANT_DATE_KINDS[0], { nonNullable: true }),
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  readonly soonWarning = computed(() => {
    const date = this.dueAtControl.value;
    if (!date) {
      return null;
    }
    const days = (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    // Not server-enforced (only the client-side warning the PRD describes: "raises warning if < 30 days away at creation").
    return days < 30 ? 'This date is less than 30 days away.' : null;
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.mattersService.listImportantDates(this.matterId()).subscribe({
      next: (dates) => {
        this.dates.set(dates);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  severityTone(
    severity: ReturnType<typeof importantDateSeverity>,
  ): 'success' | 'info' | 'warn' | 'error' {
    return SEVERITY_TONE[severity];
  }

  markSatisfied(date: MatterImportantDate): void {
    this.mattersService
      .updateImportantDate(this.matterId(), date.id, {
        kind: date.kind,
        title: date.title,
        dueAt: date.dueAt,
        satisfiedNote: 'Marked satisfied from matter workspace',
      })
      .subscribe((updated) => {
        this.dates.update((items) =>
          items.map((item) => (item.id === updated.id ? updated : item)),
        );
      });
  }

  cancelAdd(): void {
    this.addingNew.set(false);
    this.form.reset({ kind: IMPORTANT_DATE_KINDS[0], title: '' });
    this.dueAtControl.reset();
  }

  submit(): void {
    const date = this.dueAtControl.value;
    if (this.form.invalid || !date) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.mattersService
      .addImportantDate(this.matterId(), {
        kind: value.kind,
        title: value.title,
        dueAt: date.toISOString(),
      })
      .subscribe((created) => {
        this.dates.update((items) => [...items, created]);
        this.cancelAdd();
      });
  }
}
