import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import {
  CourtCasesService,
  EmptyStateComponent,
  StatusChipComponent,
  StatusChipTone,
  WITNESS_EXAM_STATUSES,
  Witness,
  WitnessExamStatus,
} from 'shared';

function examStatusTone(status: WitnessExamStatus): StatusChipTone {
  switch (status) {
    case 'ToBeExamined':
      return 'info';
    case 'ChiefDone':
      return 'warn';
    case 'CrossDone':
      return 'warn';
    case 'Discharged':
      return 'success';
  }
}

function buildAddForm(): FormGroup<{
  name: FormControl<string>;
  side: FormControl<string>;
  scheduledOn: FormControl<Date | null>;
}> {
  return new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    side: new FormControl('', { nonNullable: true }),
    scheduledOn: new FormControl<Date | null>(null),
  });
}

/**
 * Witnesses tab for the case detail page (PRD Module 5). Self-contained:
 * fetches its own witnesses from `caseId`.
 */
@Component({
  selector: 'lf-case-witnesses-tab',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    EmptyStateComponent,
    StatusChipComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="witnesses-tab">
      @if (loading()) {
        <div class="witnesses-tab__spinner">
          <mat-spinner diameter="32" />
        </div>
      } @else if (error()) {
        <lf-empty-state
          icon="error_outline"
          title="Couldn't load witnesses"
          message="Something went wrong while loading witnesses."
          ctaLabel="Retry"
          (cta)="load()"
        />
      } @else {
        @if (witnesses().length === 0) {
          <lf-empty-state icon="record_voice_over" title="No witnesses recorded yet" />
        } @else {
          <div class="witnesses-tab__list">
            @for (witness of witnesses(); track witness.id) {
              <div class="witnesses-tab__card">
                <span class="witnesses-tab__name">{{ witness.name }}</span>
                <span class="witnesses-tab__side">{{ witness.side ?? '—' }}</span>
                <span class="witnesses-tab__scheduled">{{ witness.scheduledOn ?? '—' }}</span>
                <lf-status-chip
                  [label]="witness.examStatus"
                  [toneOverride]="tone(witness.examStatus)"
                />
                <mat-form-field appearance="outline" class="witnesses-tab__status-select">
                  <mat-label>Exam status</mat-label>
                  <mat-select
                    [value]="witness.examStatus"
                    (selectionChange)="updateExamStatus(witness, $event.value)"
                  >
                    @for (status of examStatuses; track status) {
                      <mat-option [value]="status">{{ status }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              </div>
            }
          </div>
        }

        @if (updateErrorMessage()) {
          <p class="witnesses-tab__error" role="alert">{{ updateErrorMessage() }}</p>
        }

        <div class="witnesses-tab__add">
          <h3 class="witnesses-tab__add-title">Add witness</h3>
          <form [formGroup]="addForm" class="witnesses-tab__form">
            <mat-form-field appearance="outline">
              <mat-label>Name</mat-label>
              <input matInput formControlName="name" />
              @if (addForm.controls.name.hasError('required') && addForm.controls.name.touched) {
                <mat-error>Name is required.</mat-error>
              }
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Side</mat-label>
              <input matInput formControlName="side" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Scheduled on</mat-label>
              <input matInput [matDatepicker]="picker" formControlName="scheduledOn" />
              <mat-datepicker-toggle matIconSuffix [for]="picker" />
              <mat-datepicker #picker />
            </mat-form-field>
          </form>

          <button
            mat-flat-button
            color="primary"
            type="button"
            [disabled]="addForm.invalid || adding()"
            (click)="addWitness()"
          >
            @if (adding()) {
              <mat-spinner diameter="18" />
            } @else {
              Add witness
            }
          </button>

          @if (addErrorMessage()) {
            <p class="witnesses-tab__error" role="alert">{{ addErrorMessage() }}</p>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .witnesses-tab {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-3);
    }

    .witnesses-tab__spinner {
      display: flex;
      justify-content: center;
      padding: var(--lf-space-4);
    }

    .witnesses-tab__list {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-2);
    }

    .witnesses-tab__card {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--lf-space-2);
      padding: var(--lf-space-2);
      border: 1px solid var(--lf-surface-variant);
      border-radius: 8px;
    }

    .witnesses-tab__name {
      font-weight: 600;
    }

    .witnesses-tab__side,
    .witnesses-tab__scheduled {
      font-size: var(--lf-text-sm);
      color: var(--lf-on-surface-variant);
    }

    .witnesses-tab__status-select {
      width: 180px;
    }

    .witnesses-tab__add {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-2);
      padding-top: var(--lf-space-2);
      border-top: 1px dashed var(--lf-surface-variant);
    }

    .witnesses-tab__add-title {
      margin: 0;
      font-size: var(--lf-text-md);
    }

    .witnesses-tab__form {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 0 var(--lf-space-2);
    }

    .witnesses-tab__error {
      margin: 0;
      color: var(--lf-error);
      font-size: var(--lf-text-sm);
    }
  `,
})
export class CaseWitnessesTabComponent {
  private readonly courtCasesService = inject(CourtCasesService);

  readonly caseId = input.required<string>();
  readonly examStatuses = WITNESS_EXAM_STATUSES;

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly witnesses = signal<Witness[]>([]);

  readonly adding = signal(false);
  readonly addErrorMessage = signal<string | null>(null);
  readonly updateErrorMessage = signal<string | null>(null);
  addForm = buildAddForm();

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
    this.courtCasesService.listWitnesses(this.caseId()).subscribe({
      next: (witnesses) => {
        this.witnesses.set(witnesses);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  tone(status: WitnessExamStatus): StatusChipTone {
    return examStatusTone(status);
  }

  addWitness(): void {
    if (this.addForm.invalid) {
      this.addForm.markAllAsTouched();
      return;
    }

    this.adding.set(true);
    this.addErrorMessage.set(null);
    const value = this.addForm.getRawValue();
    this.courtCasesService
      .addWitness(this.caseId(), {
        name: value.name,
        side: value.side || null,
        scheduledOn: value.scheduledOn ? value.scheduledOn.toISOString().slice(0, 10) : null,
      })
      .subscribe({
        next: (witness) => {
          this.witnesses.update((witnesses) => [witness, ...witnesses]);
          this.adding.set(false);
          this.addForm = buildAddForm();
        },
        error: () => {
          this.adding.set(false);
          this.addErrorMessage.set('Failed to add witness. Please try again.');
        },
      });
  }

  updateExamStatus(witness: Witness, examStatus: WitnessExamStatus): void {
    this.updateErrorMessage.set(null);
    this.courtCasesService.updateWitness(this.caseId(), witness.id, { examStatus }).subscribe({
      next: (updated) => {
        this.witnesses.update((witnesses) =>
          witnesses.map((existing) => (existing.id === updated.id ? updated : existing)),
        );
      },
      error: () => {
        this.updateErrorMessage.set('Failed to update exam status. Please try again.');
      },
    });
  }
}
