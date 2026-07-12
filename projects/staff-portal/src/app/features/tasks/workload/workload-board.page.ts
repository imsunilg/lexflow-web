import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { EmptyStateComponent, TasksService, TaskWorkload, UserSummary, UsersService } from 'shared';
import { TasksTabsComponent } from '../tasks-tabs.component';

interface WorkloadColumn {
  userId: string;
  displayName: string;
  workload: TaskWorkload;
  barPct: number;
}

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay();
  // Monday-based week start: Sunday (0) rolls back 6 days, otherwise back to Monday.
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  return result;
}

function toDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Workload board (PRD Module 10 UI Components: "workload board (assignee
 * columns with counts/capacity)"). `GET /tasks/workload` returns one row per
 * owner with pure task-status counts — there is no capacity/hours field
 * anywhere server-side, so the bar below each column is purely a task-count
 * visualization (proportional to `total` vs. the max `total` in view), never
 * labeled as "capacity".
 */
@Component({
  selector: 'lf-workload-board-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatNativeDateModule,
    MatProgressBarModule,
    EmptyStateComponent,
    TasksTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workload-board.page.html',
  styleUrl: './workload-board.page.scss',
})
export class WorkloadBoardPage {
  private readonly tasksService = inject(TasksService);
  private readonly usersService = inject(UsersService);

  readonly weekStart = signal(startOfWeek(new Date()));
  readonly loading = signal(true);
  readonly rows = signal<TaskWorkload[]>([]);
  readonly userNames = signal<Map<string, string>>(new Map());
  readonly directoryUnavailable = signal(false);

  readonly weekControl = new FormControl<Date | null>(startOfWeek(new Date()));

  readonly weekLabel = computed(() => {
    const start = this.weekStart();
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  });

  readonly columns = computed<WorkloadColumn[]>(() => {
    const rows = this.rows();
    const names = this.userNames();
    const max = Math.max(1, ...rows.map((r) => r.total));
    return rows
      .map((workload) => ({
        userId: workload.userId,
        displayName: names.get(workload.userId) ?? workload.userId,
        workload,
        barPct: Math.round((workload.total / max) * 100),
      }))
      .sort((a, b) => b.workload.total - a.workload.total);
  });

  constructor() {
    this.loadUsers();
    this.load();
  }

  private loadUsers(): void {
    this.usersService
      .list()
      .pipe(catchError(() => of<UserSummary[]>([])))
      .subscribe((users) => {
        if (users.length === 0) {
          this.directoryUnavailable.set(true);
          return;
        }
        this.userNames.set(new Map(users.map((u) => [u.id, u.name])));
      });
  }

  load(): void {
    this.loading.set(true);
    this.tasksService.workload(toDateOnly(this.weekStart())).subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  stepWeek(delta: number): void {
    const next = new Date(this.weekStart());
    next.setDate(next.getDate() + delta * 7);
    const monday = startOfWeek(next);
    this.weekStart.set(monday);
    this.weekControl.setValue(monday, { emitEvent: false });
    this.load();
  }

  thisWeek(): void {
    const monday = startOfWeek(new Date());
    this.weekStart.set(monday);
    this.weekControl.setValue(monday, { emitEvent: false });
    this.load();
  }

  onWeekPicked(date: Date | null): void {
    if (!date) return;
    const monday = startOfWeek(date);
    this.weekStart.set(monday);
    this.weekControl.setValue(monday, { emitEvent: false });
    this.load();
  }
}
