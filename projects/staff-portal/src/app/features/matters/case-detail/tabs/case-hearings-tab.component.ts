import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  CourtCasesService,
  EmptyStateComponent,
  Hearing,
  StatusChipComponent,
  StatusChipTone,
} from 'shared';

function hearingStatusTone(status: Hearing['status']): StatusChipTone {
  switch (status) {
    case 'Scheduled':
      return 'info';
    case 'Held':
      return 'success';
    case 'Adjourned':
      return 'warn';
    case 'Cancelled':
      return 'neutral';
  }
}

/** Rejects any date strictly before today (local midnight comparison). */
function notPastDateValidator(control: FormControl<Date | null>): Record<string, true> | null {
  const value = control.value;
  if (!value) {
    return null;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selected = new Date(value);
  selected.setHours(0, 0, 0, 0);
  return selected.getTime() < today.getTime() ? { pastDate: true } : null;
}

function buildScheduleForm(): FormGroup<{
  date: FormControl<Date | null>;
  time: FormControl<string>;
  purpose: FormControl<string>;
  courtroom: FormControl<string>;
}> {
  return new FormGroup({
    date: new FormControl<Date | null>(null, {
      validators: [Validators.required, notPastDateValidator],
    }),
    time: new FormControl('', { nonNullable: true }),
    purpose: new FormControl('', { nonNullable: true }),
    courtroom: new FormControl('', { nonNullable: true }),
  });
}

/**
 * Hearings tab for the case detail page (PRD Module 5). Self-contained: fetches
 * its own hearings from `caseId` and manages loading/error/empty state. Does
 * NOT open the hearing-outcome dialog itself — it only emits `outcomeRequested`
 * so the host case-detail page (built separately) can open that dialog.
 */
@Component({
  selector: 'lf-case-hearings-tab',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    EmptyStateComponent,
    StatusChipComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="hearings-tab">
      @if (loading()) {
        <div class="hearings-tab__spinner">
          <mat-spinner diameter="32" />
        </div>
      } @else if (error()) {
        <lf-empty-state
          icon="error_outline"
          title="Couldn't load hearings"
          message="Something went wrong while loading hearings."
          ctaLabel="Retry"
          (cta)="load()"
        />
      } @else {
        @if (hearings().length === 0) {
          <lf-empty-state icon="event" title="No hearings scheduled yet" />
        } @else {
          <div class="hearings-tab__list">
            @for (hearing of hearings(); track hearing.id) {
              <div class="hearings-tab__card">
                <div class="hearings-tab__card-main">
                  <span class="hearings-tab__date">
                    {{ hearing.date }} {{ hearing.time ?? '' }}
                  </span>
                  <span class="hearings-tab__purpose">{{ hearing.purpose ?? '—' }}</span>
                  <span class="hearings-tab__courtroom">{{ hearing.courtroom ?? '—' }}</span>
                  <lf-status-chip [label]="hearing.status" [toneOverride]="tone(hearing)" />
                </div>
                @if (hearing.status === 'Scheduled') {
                  <button mat-stroked-button type="button" (click)="outcomeRequested.emit(hearing)">
                    Record outcome
                  </button>
                }
              </div>
            }
          </div>
        }

        <div class="hearings-tab__add">
          <h3 class="hearings-tab__add-title">Schedule hearing</h3>
          <form [formGroup]="scheduleForm" class="hearings-tab__form">
            <mat-form-field appearance="outline">
              <mat-label>Date</mat-label>
              <input matInput [matDatepicker]="picker" formControlName="date" />
              <mat-datepicker-toggle matIconSuffix [for]="picker" />
              <mat-datepicker #picker />
              @if (
                scheduleForm.controls.date.hasError('pastDate') &&
                scheduleForm.controls.date.touched
              ) {
                <mat-error>Hearing date can't be in the past.</mat-error>
              }
              @if (
                scheduleForm.controls.date.hasError('required') &&
                scheduleForm.controls.date.touched
              ) {
                <mat-error>Date is required.</mat-error>
              }
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Time</mat-label>
              <input matInput type="time" formControlName="time" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Purpose</mat-label>
              <input matInput formControlName="purpose" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Courtroom</mat-label>
              <input matInput formControlName="courtroom" />
            </mat-form-field>
          </form>

          <button
            mat-flat-button
            color="primary"
            type="button"
            [disabled]="scheduleForm.invalid || scheduling()"
            (click)="schedule()"
          >
            @if (scheduling()) {
              <mat-spinner diameter="18" />
            } @else {
              Schedule hearing
            }
          </button>

          @if (scheduleErrorMessage()) {
            <p class="hearings-tab__error" role="alert">{{ scheduleErrorMessage() }}</p>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .hearings-tab {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-3);
    }

    .hearings-tab__spinner {
      display: flex;
      justify-content: center;
      padding: var(--lf-space-4);
    }

    .hearings-tab__list {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-2);
    }

    .hearings-tab__card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: var(--lf-space-2);
      padding: var(--lf-space-2);
      border: 1px solid var(--lf-surface-variant);
      border-radius: 8px;
    }

    .hearings-tab__card-main {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--lf-space-2);
    }

    .hearings-tab__date {
      font-weight: 600;
    }

    .hearings-tab__purpose,
    .hearings-tab__courtroom {
      font-size: var(--lf-text-sm);
      color: var(--lf-on-surface-variant);
    }

    .hearings-tab__add {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-2);
      padding-top: var(--lf-space-2);
      border-top: 1px dashed var(--lf-surface-variant);
    }

    .hearings-tab__add-title {
      margin: 0;
      font-size: var(--lf-text-md);
    }

    .hearings-tab__form {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr;
      gap: 0 var(--lf-space-2);
    }

    .hearings-tab__error {
      margin: 0;
      color: var(--lf-error);
      font-size: var(--lf-text-sm);
    }
  `,
})
export class CaseHearingsTabComponent {
  private readonly courtCasesService = inject(CourtCasesService);

  readonly caseId = input.required<string>();
  readonly outcomeRequested = output<Hearing>();

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly hearings = signal<Hearing[]>([]);

  readonly scheduling = signal(false);
  readonly scheduleErrorMessage = signal<string | null>(null);

  scheduleForm = buildScheduleForm();

  constructor() {
    effect(() => {
      const id = this.caseId();
      if (id) {
        this.load();
      }
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.courtCasesService.listHearings(this.caseId()).subscribe({
      next: (hearings) => {
        this.hearings.set(hearings);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  tone(hearing: Hearing): StatusChipTone {
    return hearingStatusTone(hearing.status);
  }

  schedule(): void {
    if (this.scheduleForm.invalid) {
      this.scheduleForm.markAllAsTouched();
      return;
    }

    this.scheduling.set(true);
    this.scheduleErrorMessage.set(null);
    const value = this.scheduleForm.getRawValue();
    this.courtCasesService
      .scheduleHearing(this.caseId(), {
        date: value.date!.toISOString().slice(0, 10),
        time: value.time || null,
        purpose: value.purpose || null,
        courtroom: value.courtroom || null,
      })
      .subscribe({
        next: (hearing) => {
          this.hearings.update((hearings) => [hearing, ...hearings]);
          this.scheduling.set(false);
          this.scheduleForm = buildScheduleForm();
        },
        error: () => {
          this.scheduling.set(false);
          this.scheduleErrorMessage.set('Failed to schedule hearing. Please try again.');
        },
      });
  }
}
