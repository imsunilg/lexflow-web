import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ArgumentNote, CourtCasesService, EmptyStateComponent } from 'shared';

function buildAddForm(): FormGroup<{
  stage: FormControl<string>;
  body: FormControl<string>;
}> {
  return new FormGroup({
    stage: new FormControl('', { nonNullable: true }),
    body: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
}

/**
 * Arguments tab for the case detail page (PRD Module 5: "Arguments notes:
 * rich-text per hearing/stage; citations linked to Knowledge Base
 * judgments"). No rich-text-editor library is a dependency in this app, so
 * `body` is a plain textarea rendered with `white-space: pre-wrap` rather
 * than a WYSIWYG editor; citation linking to Knowledge Base judgments isn't
 * wired up (no citation picker exists), so `citationJudgmentIds` is always
 * omitted on create — only the note's own citation count (if any already
 * exist server-side) is displayed.
 */
@Component({
  selector: 'lf-case-arguments-tab',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="arguments-tab">
      @if (loading()) {
        <div class="arguments-tab__spinner">
          <mat-spinner diameter="32" />
        </div>
      } @else if (error()) {
        <lf-empty-state
          icon="error_outline"
          title="Couldn't load argument notes"
          ctaLabel="Retry"
          (cta)="load()"
        />
      } @else {
        @if (notes().length === 0) {
          <lf-empty-state icon="gavel" title="No argument notes yet" />
        } @else {
          <div class="arguments-tab__list">
            @for (note of notes(); track note.id) {
              <div class="arguments-tab__card">
                @if (note.stage) {
                  <span class="arguments-tab__stage">{{ note.stage }}</span>
                }
                <p class="arguments-tab__body">{{ note.body }}</p>
                @if (note.citationJudgmentIds.length > 0) {
                  <span class="arguments-tab__citations">
                    {{ note.citationJudgmentIds.length }} citation(s)
                  </span>
                }
              </div>
            }
          </div>
        }

        <div class="arguments-tab__add">
          <h3 class="arguments-tab__add-title">Add argument note</h3>
          <form [formGroup]="addForm" class="arguments-tab__form">
            <mat-form-field appearance="outline">
              <mat-label>Stage (optional)</mat-label>
              <input matInput formControlName="stage" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="arguments-tab__body-field">
              <mat-label>Note</mat-label>
              <textarea matInput formControlName="body" rows="4"></textarea>
              @if (addForm.controls.body.hasError('required') && addForm.controls.body.touched) {
                <mat-error>A note is required.</mat-error>
              }
            </mat-form-field>
          </form>

          <button
            mat-flat-button
            color="primary"
            type="button"
            [disabled]="addForm.invalid || adding()"
            (click)="addArgument()"
          >
            @if (adding()) {
              <mat-spinner diameter="18" />
            } @else {
              Add note
            }
          </button>

          @if (addErrorMessage()) {
            <p class="arguments-tab__error" role="alert">{{ addErrorMessage() }}</p>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .arguments-tab {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-3);
    }

    .arguments-tab__spinner {
      display: flex;
      justify-content: center;
      padding: var(--lf-space-4);
    }

    .arguments-tab__list {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-2);
    }

    .arguments-tab__card {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: var(--lf-space-2);
      border: 1px solid var(--lf-surface-variant);
      border-radius: 8px;
    }

    .arguments-tab__stage {
      font-size: var(--lf-text-xs);
      font-weight: 600;
      color: var(--lf-on-surface-variant);
      text-transform: uppercase;
    }

    .arguments-tab__body {
      margin: 0;
      white-space: pre-wrap;
    }

    .arguments-tab__citations {
      font-size: var(--lf-text-xs);
      color: var(--lf-on-surface-variant);
    }

    .arguments-tab__add {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-2);
      padding-top: var(--lf-space-2);
      border-top: 1px dashed var(--lf-surface-variant);
    }

    .arguments-tab__add-title {
      margin: 0;
      font-size: var(--lf-text-md);
    }

    .arguments-tab__form {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-1);
    }

    .arguments-tab__body-field {
      width: 100%;
    }

    .arguments-tab__error {
      margin: 0;
      color: var(--lf-error);
      font-size: var(--lf-text-sm);
    }
  `,
})
export class CaseArgumentsTabComponent {
  private readonly courtCasesService = inject(CourtCasesService);

  readonly caseId = input.required<string>();

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly notes = signal<ArgumentNote[]>([]);

  readonly adding = signal(false);
  readonly addErrorMessage = signal<string | null>(null);
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
    this.courtCasesService.listArguments(this.caseId()).subscribe({
      next: (notes) => {
        this.notes.set(notes);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  addArgument(): void {
    if (this.addForm.invalid) {
      this.addForm.markAllAsTouched();
      return;
    }

    this.adding.set(true);
    this.addErrorMessage.set(null);
    const value = this.addForm.getRawValue();
    this.courtCasesService
      .addArgument(this.caseId(), { stage: value.stage || null, body: value.body })
      .subscribe({
        next: (note) => {
          this.notes.update((notes) => [note, ...notes]);
          this.adding.set(false);
          this.addForm = buildAddForm();
        },
        error: () => {
          this.adding.set(false);
          this.addErrorMessage.set('Failed to add argument note. Please try again.');
        },
      });
  }
}
