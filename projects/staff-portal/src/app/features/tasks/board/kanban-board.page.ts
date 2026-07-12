import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import {
  ApiErrorEnvelope,
  EmptyStateComponent,
  OPS_TASK_CATEGORIES,
  OPS_TASK_PRIORITIES,
  OPS_TASK_STATUSES,
  OpsTask,
  OpsTaskStatus,
  PermissionService,
  TaskFilter,
  TasksService,
} from 'shared';
import { TaskComposerDialogComponent } from '../composer/task-composer-dialog.component';
import {
  TaskDetailDrawerComponent,
  TaskDetailDrawerData,
} from '../detail/task-detail-drawer.component';
import { TasksTabsComponent } from '../tasks-tabs.component';

interface KanbanColumn {
  status: OpsTaskStatus;
  tasks: OpsTask[];
}

/**
 * Kanban board (PRD Module 10 UI Components: "Kanban (CDK drag between status
 * columns)"). The server does not enforce forward-only status adjacency, so
 * any column-to-column drop is attempted as-is; it can still be rejected
 * (409 `TASK_BLOCKED` if a predecessor isn't Done, 409 `CHECKLIST_INCOMPLETE`
 * for a mandatory item), in which case the card reverts to its origin column.
 */
@Component({
  selector: 'lf-kanban-board-page',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    CdkDropList,
    CdkDropListGroup,
    CdkDrag,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSlideToggleModule,
    EmptyStateComponent,
    TasksTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './kanban-board.page.html',
  styleUrl: './kanban-board.page.scss',
})
export class KanbanBoardPage {
  private readonly tasksService = inject(TasksService);
  private readonly permissionService = inject(PermissionService);
  private readonly dialog = inject(MatDialog);

  readonly statuses = OPS_TASK_STATUSES;
  readonly priorities = OPS_TASK_PRIORITIES;
  readonly categories = OPS_TASK_CATEGORIES;
  readonly canSeeTeam = computed(() => this.permissionService.has('tasks.read.team'));

  readonly loading = signal(true);
  readonly tasks = signal<OpsTask[]>([]);
  readonly dropError = signal<string | null>(null);

  readonly mineOnly = new FormControl(true, { nonNullable: true });
  readonly priorityFilter = new FormControl<(typeof OPS_TASK_PRIORITIES)[number] | null>(null);
  readonly categoryFilter = new FormControl<(typeof OPS_TASK_CATEGORIES)[number] | null>(null);
  readonly overdueOnly = new FormControl(false, { nonNullable: true });

  readonly columns = computed<KanbanColumn[]>(() =>
    this.statuses.map((status) => ({
      status,
      tasks: this.tasks().filter((t) => t.status === status),
    })),
  );

  constructor() {
    this.load();
    this.mineOnly.valueChanges.subscribe(() => this.load());
    this.priorityFilter.valueChanges.subscribe(() => this.load());
    this.categoryFilter.valueChanges.subscribe(() => this.load());
    this.overdueOnly.valueChanges.subscribe(() => this.load());
  }

  private buildFilter(): TaskFilter {
    const filter: TaskFilter = {};
    if (this.mineOnly.value || !this.canSeeTeam()) {
      const me = this.permissionService.currentUser()?.id;
      if (me) filter.assigneeId = me;
    }
    if (this.priorityFilter.value) filter.priority = this.priorityFilter.value;
    if (this.categoryFilter.value) filter.category = this.categoryFilter.value;
    if (this.overdueOnly.value) filter.overdue = true;
    return filter;
  }

  load(): void {
    this.loading.set(true);
    this.tasksService.list(this.buildFilter()).subscribe({
      next: (tasks) => {
        this.tasks.set(tasks);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  dropListId(status: OpsTaskStatus): string {
    return `kanban-${status}`;
  }

  onDrop(event: CdkDragDrop<OpsTask[], OpsTask[], OpsTask>, targetStatus: OpsTaskStatus): void {
    const task = event.item.data;
    if (task.status === targetStatus) return;

    this.dropError.set(null);
    const previousStatus = task.status;
    this.tasks.update((all) =>
      all.map((t) => (t.id === task.id ? { ...t, status: targetStatus } : t)),
    );

    this.tasksService.setStatus(task.id, targetStatus).subscribe({
      next: (updated) => {
        this.tasks.update((all) => all.map((t) => (t.id === updated.id ? updated : t)));
      },
      error: (err: HttpErrorResponse) => {
        this.tasks.update((all) =>
          all.map((t) => (t.id === task.id ? { ...t, status: previousStatus } : t)),
        );
        const envelope = err.error as Partial<ApiErrorEnvelope> | null;
        this.dropError.set(envelope?.error?.message ?? 'That status change was rejected.');
      },
    });
  }

  openComposer(): void {
    this.dialog
      .open(TaskComposerDialogComponent)
      .afterClosed()
      .subscribe((created) => {
        if (created) this.load();
      });
  }

  openDetail(taskId: string): void {
    this.dialog
      .open<TaskDetailDrawerComponent, TaskDetailDrawerData>(TaskDetailDrawerComponent, {
        data: { taskId },
        width: '640px',
      })
      .afterClosed()
      .subscribe((result) => {
        if (result === 'changed') this.load();
      });
  }

  isOverdue(task: OpsTask): boolean {
    if (!task.dueAt || task.status === 'Done' || task.status === 'Cancelled') return false;
    return new Date(task.dueAt).getTime() < Date.now();
  }
}
