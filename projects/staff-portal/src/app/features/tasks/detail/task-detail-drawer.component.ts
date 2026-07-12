import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { forkJoin, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import {
  ApiErrorEnvelope,
  Matter,
  MattersService,
  OPS_TASK_STATUSES,
  OpsTask,
  OpsTaskStatus,
  TASK_ASSIGNEE_ROLES,
  TaskAssignee,
  TaskAssigneeRole,
  TaskChecklistItem,
  TaskComment,
  TasksService,
  UserSummary,
  UsersService,
} from 'shared';
import { RecurringEditorDialogComponent } from './recurring-editor-dialog.component';

export interface TaskDetailDrawerData {
  taskId: string;
}

interface DependencyRow {
  taskId: string;
  title: string;
  status: OpsTaskStatus;
}

/**
 * Task detail drawer (PRD Module 10 UI Components: "detail drawer (checklist,
 * comments thread, activity, dependencies graph mini-view)"). The
 * "dependencies graph" is rendered as a simple predecessor list, not a real
 * graph: `GET /tasks/{id}/dependencies` returns bare GUIDs with no structured
 * path, and cycle rejection surfaces only a message string, not a path array
 * (see `TasksService.addDependency`'s doc comment).
 */
@Component({
  selector: 'lf-task-detail-drawer',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './task-detail-drawer.component.html',
  styleUrl: './task-detail-drawer.component.scss',
})
export class TaskDetailDrawerComponent {
  private readonly dialogRef =
    inject<MatDialogRef<TaskDetailDrawerComponent, 'changed' | undefined>>(MatDialogRef);
  private readonly dialog = inject(MatDialog);
  readonly data = inject<TaskDetailDrawerData>(MAT_DIALOG_DATA);
  private readonly tasksService = inject(TasksService);
  private readonly mattersService = inject(MattersService);
  private readonly usersService = inject(UsersService);

  readonly statuses = OPS_TASK_STATUSES;
  readonly assigneeRoles = TASK_ASSIGNEE_ROLES;

  readonly loading = signal(true);
  readonly task = signal<OpsTask | null>(null);
  readonly matter = signal<Matter | null>(null);
  readonly assignees = signal<TaskAssignee[]>([]);
  readonly checklist = signal<TaskChecklistItem[]>([]);
  readonly comments = signal<TaskComment[]>([]);
  readonly dependencies = signal<DependencyRow[]>([]);

  readonly statusError = signal<string | null>(null);
  readonly dependencyError = signal<string | null>(null);
  private changed = false;

  readonly newChecklistLabel = new FormControl('', { nonNullable: true });
  readonly newChecklistMandatory = new FormControl(false, { nonNullable: true });
  readonly newComment = new FormControl('', { nonNullable: true });

  readonly assigneeControl = new FormControl('', { nonNullable: true });
  readonly assigneeResults = signal<UserSummary[]>([]);
  readonly assigneeRole = new FormControl<TaskAssigneeRole>('collaborator', { nonNullable: true });
  private selectedAssigneeId: string | null = null;
  readonly userLookupUnavailable = signal(false);

  readonly dependencyControl = new FormControl('', { nonNullable: true });
  readonly dependencyResults = signal<OpsTask[]>([]);
  private selectedDependencyId: string | null = null;

  constructor() {
    this.load();

    this.assigneeControl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => {
        this.selectedAssigneeId = null;
        if (!q || this.userLookupUnavailable()) {
          this.assigneeResults.set([]);
          return;
        }
        this.usersService
          .list()
          .pipe(catchError(() => of<UserSummary[]>([])))
          .subscribe((users) => {
            if (users.length === 0) {
              this.userLookupUnavailable.set(true);
              return;
            }
            this.assigneeResults.set(
              users.filter((u) => u.name.toLowerCase().includes(q.toLowerCase())),
            );
          });
      });

    this.dependencyControl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => {
        this.selectedDependencyId = null;
        if (!q) {
          this.dependencyResults.set([]);
          return;
        }
        const matterId = this.task()?.matterId;
        this.tasksService.list(matterId ? { matterId } : {}).subscribe((tasks) => {
          const currentId = this.task()?.id;
          this.dependencyResults.set(
            tasks.filter(
              (t) => t.id !== currentId && t.title.toLowerCase().includes(q.toLowerCase()),
            ),
          );
        });
      });
  }

  private load(): void {
    this.loading.set(true);
    this.tasksService.get(this.data.taskId).subscribe((task) => {
      this.task.set(task);
      this.loading.set(false);

      if (task.matterId) {
        this.mattersService.get(task.matterId).subscribe((matter) => this.matter.set(matter));
      }

      this.tasksService.listAssignees(task.id).subscribe((a) => this.assignees.set(a));
      this.tasksService.listChecklist(task.id).subscribe((c) => this.checklist.set(c));
      this.tasksService.listComments(task.id).subscribe((c) => this.comments.set(c));
      this.hydrateDependencies(task.id);
    });
  }

  private hydrateDependencies(taskId: string): void {
    this.tasksService.listDependencies(taskId).subscribe((ids) => {
      if (ids.length === 0) {
        this.dependencies.set([]);
        return;
      }
      forkJoin(
        ids.map((id) => this.tasksService.get(id).pipe(catchError(() => of(null)))),
      ).subscribe((tasks) => {
        this.dependencies.set(
          tasks
            .filter((t): t is OpsTask => t !== null)
            .map((t) => ({ taskId: t.id, title: t.title, status: t.status })),
        );
      });
    });
  }

  checklistProgressPct(): number {
    const items = this.checklist();
    if (items.length === 0) return 0;
    return Math.round((items.filter((i) => i.isDone).length / items.length) * 100);
  }

  setStatus(status: OpsTaskStatus): void {
    const task = this.task();
    if (!task) return;

    this.statusError.set(null);
    this.tasksService.setStatus(task.id, status).subscribe({
      next: (updated) => {
        this.task.set(updated);
        this.changed = true;
      },
      error: (err: HttpErrorResponse) => {
        const envelope = err.error as Partial<ApiErrorEnvelope> | null;
        this.statusError.set(envelope?.error?.message ?? 'That status change was rejected.');
      },
    });
  }

  toggleChecklistItem(item: TaskChecklistItem): void {
    const task = this.task();
    if (!task) return;
    this.tasksService.setChecklistItemDone(task.id, item.id, !item.isDone).subscribe((updated) => {
      this.checklist.update((items) => items.map((i) => (i.id === updated.id ? updated : i)));
      this.changed = true;
    });
  }

  addChecklistItem(): void {
    const task = this.task();
    const label = this.newChecklistLabel.value.trim();
    if (!task || !label) return;

    this.tasksService
      .addChecklistItem(task.id, label, this.newChecklistMandatory.value, this.checklist().length)
      .subscribe((item) => {
        this.checklist.update((items) => [...items, item]);
        this.newChecklistLabel.setValue('');
        this.newChecklistMandatory.setValue(false);
        this.changed = true;
      });
  }

  addComment(): void {
    const task = this.task();
    const body = this.newComment.value.trim();
    if (!task || !body) return;

    this.tasksService.addComment(task.id, body).subscribe((comment) => {
      this.comments.update((items) => [...items, comment]);
      this.newComment.setValue('');
      this.changed = true;
    });
  }

  onAssigneeSelected(event: MatAutocompleteSelectedEvent): void {
    const label = event.option.value as string;
    const user = this.assigneeResults().find((u) => u.name === label);
    this.selectedAssigneeId = user?.id ?? null;
  }

  addAssignee(): void {
    const task = this.task();
    if (!task || !this.selectedAssigneeId) return;

    const userId = this.selectedAssigneeId;
    const role = this.assigneeRole.value;
    this.tasksService.addAssignee(task.id, userId, role).subscribe(() => {
      this.assignees.update((rows) => [...rows, { taskId: task.id, userId, role }]);
      this.assigneeControl.setValue('');
      this.selectedAssigneeId = null;
      this.changed = true;
    });
  }

  removeAssignee(userId: string): void {
    const task = this.task();
    if (!task) return;
    this.tasksService.removeAssignee(task.id, userId).subscribe(() => {
      this.assignees.update((rows) => rows.filter((r) => r.userId !== userId));
      this.changed = true;
    });
  }

  onDependencySelected(event: MatAutocompleteSelectedEvent): void {
    const label = event.option.value as string;
    const candidate = this.dependencyResults().find((t) => t.title === label);
    this.selectedDependencyId = candidate?.id ?? null;
  }

  addDependency(): void {
    const task = this.task();
    if (!task || !this.selectedDependencyId) return;

    this.dependencyError.set(null);
    const dependsOnTaskId = this.selectedDependencyId;
    this.tasksService.addDependency(task.id, dependsOnTaskId).subscribe({
      next: () => {
        this.dependencyControl.setValue('');
        this.selectedDependencyId = null;
        this.hydrateDependencies(task.id);
        this.changed = true;
      },
      error: (err: HttpErrorResponse) => {
        const envelope = err.error as Partial<ApiErrorEnvelope> | null;
        this.dependencyError.set(envelope?.error?.message ?? 'That dependency could not be added.');
      },
    });
  }

  removeDependency(dependsOnTaskId: string): void {
    const task = this.task();
    if (!task) return;
    this.tasksService.removeDependency(task.id, dependsOnTaskId).subscribe(() => {
      this.dependencies.update((rows) => rows.filter((r) => r.taskId !== dependsOnTaskId));
      this.changed = true;
    });
  }

  openRecurringEditor(): void {
    const task = this.task();
    if (!task) return;
    this.dialog
      .open(RecurringEditorDialogComponent, { data: { seed: task } })
      .afterClosed()
      .subscribe((count) => {
        if (count) this.changed = true;
      });
  }

  close(): void {
    this.dialogRef.close(this.changed ? 'changed' : undefined);
  }
}
