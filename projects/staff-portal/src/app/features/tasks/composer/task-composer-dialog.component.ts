import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import {
  CreateTaskRequest,
  Matter,
  MattersService,
  OPS_TASK_CATEGORIES,
  OPS_TASK_PRIORITIES,
  OpsTask,
  ParsedTaskDraft,
  TasksService,
  UserSummary,
  UsersService,
} from 'shared';

/**
 * Task composer (PRD Module 10 UI Components: "Task composer dialog (smart
 * parse: ... → structured)"). `POST /tasks/parse` is real but is a fixed
 * 4-token regex parser (`!priority`, `@mention`, `MATTER-CODE`, and
 * `today|tomorrow|next <weekday>|in N days`) — not a general NLU/date parser.
 * The preview below reflects exactly those tokens; the full form beneath it
 * is always editable before the actual `POST /tasks` create call, so a
 * mis-parsed token is never silently submitted.
 */
@Component({
  selector: 'lf-task-composer-dialog',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './task-composer-dialog.component.html',
  styleUrl: './task-composer-dialog.component.scss',
})
export class TaskComposerDialogComponent {
  private readonly dialogRef =
    inject<MatDialogRef<TaskComposerDialogComponent, OpsTask | undefined>>(MatDialogRef);
  private readonly tasksService = inject(TasksService);
  private readonly mattersService = inject(MattersService);
  private readonly usersService = inject(UsersService);

  readonly priorities = OPS_TASK_PRIORITIES;
  readonly categories = OPS_TASK_CATEGORIES;

  readonly smartText = new FormControl('', { nonNullable: true });
  readonly parsing = signal(false);
  readonly parsePreview = signal<ParsedTaskDraft | null>(null);
  readonly parseError = signal<string | null>(null);

  readonly title = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(3), Validators.maxLength(300)],
  });
  readonly description = new FormControl('', { nonNullable: true });
  readonly dueAt = new FormControl<Date | null>(null);
  readonly priority = new FormControl<(typeof OPS_TASK_PRIORITIES)[number]>('Medium', {
    nonNullable: true,
  });
  readonly category = new FormControl<(typeof OPS_TASK_CATEGORIES)[number] | null>(null);

  readonly matterControl = new FormControl('', { nonNullable: true });
  readonly matterResults = signal<Matter[]>([]);
  private selectedMatterId: string | null = null;

  readonly ownerControl = new FormControl('', { nonNullable: true });
  readonly ownerResults = signal<UserSummary[]>([]);
  private selectedOwnerId: string | null = null;
  /** `users.read.all` is required for `GET /users` — degrade to a plain text-only owner field if forbidden rather than fail the whole dialog. */
  readonly ownerLookupUnavailable = signal(false);

  submitting = false;

  constructor() {
    this.matterControl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => {
        this.selectedMatterId = null;
        if (!q) {
          this.matterResults.set([]);
          return;
        }
        this.mattersService.list({ q }).subscribe((matters) => this.matterResults.set(matters));
      });

    this.ownerControl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => {
        this.selectedOwnerId = null;
        if (!q || this.ownerLookupUnavailable()) {
          this.ownerResults.set([]);
          return;
        }
        this.usersService
          .list()
          .pipe(catchError(() => of<UserSummary[]>([])))
          .subscribe((users) => {
            if (users.length === 0) {
              this.ownerLookupUnavailable.set(true);
              return;
            }
            this.ownerResults.set(
              users.filter((u) => u.name.toLowerCase().includes(q.toLowerCase())),
            );
          });
      });
  }

  runSmartParse(): void {
    const text = this.smartText.value.trim();
    if (!text) return;

    this.parsing.set(true);
    this.parseError.set(null);
    this.tasksService.parse(text).subscribe({
      next: (draft) => {
        this.parsing.set(false);
        this.parsePreview.set(draft);
        this.applyDraft(draft);
      },
      error: () => {
        this.parsing.set(false);
        this.parseError.set('Could not parse that text — fill in the fields below manually.');
      },
    });
  }

  private applyDraft(draft: ParsedTaskDraft): void {
    this.title.setValue(draft.title);
    this.priority.setValue(draft.priority);
    if (draft.dueAt) {
      this.dueAt.setValue(new Date(draft.dueAt));
    }
    if (draft.matterId && draft.matterNumber) {
      this.selectedMatterId = draft.matterId;
      this.matterControl.setValue(draft.matterNumber, { emitEvent: false });
    }
    if (draft.assigneeUserId && draft.assigneeMention) {
      this.selectedOwnerId = draft.assigneeUserId;
      this.ownerControl.setValue(draft.assigneeMention, { emitEvent: false });
    }
  }

  onMatterSelected(event: MatAutocompleteSelectedEvent): void {
    const label = event.option.value as string;
    const matter = this.matterResults().find((m) => `${m.number} — ${m.title}` === label);
    this.selectedMatterId = matter?.id ?? null;
  }

  onOwnerSelected(event: MatAutocompleteSelectedEvent): void {
    const label = event.option.value as string;
    const user = this.ownerResults().find((u) => u.name === label);
    this.selectedOwnerId = user?.id ?? null;
  }

  matterLabel(matter: Matter): string {
    return `${matter.number} — ${matter.title}`;
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }

  submit(): void {
    if (this.title.invalid) {
      this.title.markAsTouched();
      return;
    }

    const request: CreateTaskRequest = {
      title: this.title.value,
      description: this.description.value || null,
      matterId: this.selectedMatterId,
      ownerId: this.selectedOwnerId,
      dueAt: this.dueAt.value ? this.dueAt.value.toISOString() : null,
      priority: this.priority.value,
      category: this.category.value,
    };

    this.submitting = true;
    this.tasksService.create(request).subscribe({
      next: (task) => this.dialogRef.close(task),
      error: () => {
        this.submitting = false;
      },
    });
  }
}
