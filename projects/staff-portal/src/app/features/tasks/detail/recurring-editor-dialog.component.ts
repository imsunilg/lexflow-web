import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { forkJoin } from 'rxjs';
import { CreateTaskRequest, OpsTask, TasksService } from 'shared';

export interface RecurringEditorDialogData {
  seed: OpsTask;
}

const INTERVAL_UNITS = ['Daily', 'Weekly', 'Monthly'] as const;
type IntervalUnit = (typeof INTERVAL_UNITS)[number];

function addInterval(date: Date, unit: IntervalUnit, every: number): Date {
  const result = new Date(date);
  if (unit === 'Daily') result.setDate(result.getDate() + every);
  else if (unit === 'Weekly') result.setDate(result.getDate() + every * 7);
  else result.setMonth(result.getMonth() + every);
  return result;
}

/**
 * "Recurring editor" (PRD Module 10 UI Components). The backend has no
 * recurrence engine at all: `OpsTask.recurrenceId` is a bare grouping GUID
 * with no `task_recurrences` table, no RRULE field, and — critically — no
 * request field to *set* it (`CreateOpsTaskRequest` has no `recurrenceId`
 * parameter). So this dialog cannot create a linked series the way the PRD's
 * RRULE description implies; it bulk-creates N independent tasks with
 * computed due dates from the seed task, and says so plainly in the UI.
 */
@Component({
  selector: 'lf-recurring-editor-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Repeat "{{ data.seed.title }}"</h2>
    <mat-dialog-content class="recurring">
      <p class="recurring__note">
        LexFlow has no recurrence engine yet — this creates independent copies of this task with
        computed due dates. They are not linked as a series (no API field exists for that);
        cancelling or editing one has no effect on the others.
      </p>

      <div class="recurring__row">
        <mat-form-field appearance="outline">
          <mat-label>Every</mat-label>
          <input matInput type="number" min="1" [formControl]="every" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Interval</mat-label>
          <mat-select [formControl]="unit">
            @for (u of units; track u) {
              <mat-option [value]="u">{{ u }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Occurrences</mat-label>
          <input matInput type="number" min="1" max="52" [formControl]="occurrences" />
        </mat-form-field>
      </div>

      @if (!data.seed.dueAt) {
        <p class="recurring__warning">
          This task has no due date — future copies will also be created without one, spaced by
          creation order only.
        </p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="undefined">Cancel</button>
      <button
        mat-flat-button
        color="primary"
        type="button"
        [disabled]="submitting() || every.invalid || occurrences.invalid"
        (click)="submit()"
      >
        Create {{ occurrences.value }} tasks
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .recurring {
      min-width: 420px;
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-1);
    }

    .recurring__note,
    .recurring__warning {
      font-size: var(--lf-text-sm);
      color: var(--lf-on-surface-variant);
      margin: 0;
    }

    .recurring__row {
      display: flex;
      gap: var(--lf-space-1);

      mat-form-field {
        flex: 1;
      }
    }
  `,
})
export class RecurringEditorDialogComponent {
  private readonly dialogRef =
    inject<MatDialogRef<RecurringEditorDialogComponent, number | undefined>>(MatDialogRef);
  private readonly tasksService = inject(TasksService);
  readonly data = inject<RecurringEditorDialogData>(MAT_DIALOG_DATA);

  readonly units = INTERVAL_UNITS;
  readonly unit = new FormControl<IntervalUnit>('Monthly', { nonNullable: true });
  readonly every = new FormControl(1, { nonNullable: true, validators: [Validators.min(1)] });
  readonly occurrences = new FormControl(3, {
    nonNullable: true,
    validators: [Validators.min(1), Validators.max(52)],
  });

  readonly submitting = signal(false);

  submit(): void {
    const { seed } = this.data;
    const count = this.occurrences.value;
    const every = this.every.value;
    const unit = this.unit.value;

    let cursor = seed.dueAt ? new Date(seed.dueAt) : null;
    const requests = Array.from({ length: count }, () => {
      cursor = cursor ? addInterval(cursor, unit, every) : null;
      const request: CreateTaskRequest = {
        title: seed.title,
        description: seed.description,
        matterId: seed.matterId,
        clientId: seed.clientId,
        ownerId: seed.ownerId,
        dueAt: cursor ? cursor.toISOString() : null,
        priority: seed.priority,
        category: seed.category,
      };
      return this.tasksService.create(request);
    });

    this.submitting.set(true);
    forkJoin(requests).subscribe({
      next: (created) => this.dialogRef.close(created.length),
      error: () => this.submitting.set(false),
    });
  }
}
