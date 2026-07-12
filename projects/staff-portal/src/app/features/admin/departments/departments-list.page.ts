import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { forkJoin } from 'rxjs';
import {
  ConfirmDialogComponent,
  DepartmentDto,
  DepartmentsService,
  EmptyStateComponent,
  UserSummary,
  UsersService,
} from 'shared';
import { AdminTabsComponent } from '../admin-tabs.component';
import {
  DepartmentFormDialogComponent,
  DepartmentFormDialogData,
} from './department-form-dialog.component';

/**
 * Departments list (PRD Module 14 UI Components: "Departments" tab).
 * `DepartmentsController` has full CRUD, so this page supports create, edit,
 * and delete. Departments are flat here — a single `headUserId`, no
 * reporting-manager chain or parent department, since the backend doesn't
 * model one. Head names are resolved client-side from `GET /users`
 * (`UsersService.list()`), fetched once alongside the department list.
 */
@Component({
  selector: 'lf-departments-list-page',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    EmptyStateComponent,
    AdminTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './departments-list.page.html',
  styleUrl: './departments-list.page.scss',
})
export class DepartmentsListPage {
  private readonly departmentsService = inject(DepartmentsService);
  private readonly usersService = inject(UsersService);
  private readonly dialog = inject(MatDialog);

  readonly loading = signal(true);
  readonly departments = signal<DepartmentDto[]>([]);
  readonly users = signal<UserSummary[]>([]);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    forkJoin({
      departments: this.departmentsService.list(),
      users: this.usersService.list(),
    }).subscribe({
      next: ({ departments, users }) => {
        this.departments.set(departments);
        this.users.set(users);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  userName(id: string | null): string {
    if (!id) return '—';
    return this.users().find((u) => u.id === id)?.name ?? '—';
  }

  openNew(): void {
    this.dialog
      .open<DepartmentFormDialogComponent, DepartmentFormDialogData, DepartmentDto | undefined>(
        DepartmentFormDialogComponent,
        { data: { users: this.users() } },
      )
      .afterClosed()
      .subscribe((result) => {
        if (result) this.load();
      });
  }

  openEdit(department: DepartmentDto): void {
    this.dialog
      .open<DepartmentFormDialogComponent, DepartmentFormDialogData, DepartmentDto | undefined>(
        DepartmentFormDialogComponent,
        { data: { department, users: this.users() } },
      )
      .afterClosed()
      .subscribe((result) => {
        if (result) this.load();
      });
  }

  deleteDepartment(department: DepartmentDto): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Delete department',
          message: `Delete "${department.name}"? This cannot be undone.`,
          destructive: true,
          confirmLabel: 'Delete',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.departmentsService.delete(department.id).subscribe(() => this.load());
      });
  }
}
