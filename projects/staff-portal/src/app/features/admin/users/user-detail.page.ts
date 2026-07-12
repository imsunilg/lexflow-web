import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  BranchDto,
  BranchesService,
  ConfirmDialogComponent,
  DepartmentDto,
  DepartmentsService,
  UserDetail,
  UserSummary,
  UsersService,
} from 'shared';
import { AdminTabsComponent } from '../admin-tabs.component';
import { DeactivateUserDialogComponent } from './deactivate-user-dialog.component';

/**
 * User detail/edit (PRD Module 14). `costRate` has no server-side visibility
 * restriction despite the PRD calling for one — shown to anyone who can load
 * this page (gated only by `users.read.all`), not hidden further client-side
 * since that wouldn't be real security. `notificationPrefsJson` is
 * write-only (never returned by `GET`) — the form offers it as "set new
 * preferences", not a pre-filled editor. No photo/signature/working-hours
 * fields exist server-side, so none are shown here.
 */
@Component({
  selector: 'lf-user-detail-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTooltipModule,
    RouterLink,
    AdminTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-detail.page.html',
  styleUrl: './user-detail.page.scss',
})
export class UserDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly usersService = inject(UsersService);
  private readonly branchesService = inject(BranchesService);
  private readonly departmentsService = inject(DepartmentsService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly userId = this.route.snapshot.paramMap.get('id')!;
  readonly loading = signal(true);
  readonly user = signal<UserDetail | null>(null);
  readonly branches = signal<BranchDto[]>([]);
  readonly departments = signal<DepartmentDto[]>([]);
  readonly allUsers = signal<UserSummary[]>([]);
  readonly saving = signal(false);
  readonly busy = signal(false);

  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true }),
    designation: new FormControl('', { nonNullable: true }),
    barEnrollmentNo: new FormControl('', { nonNullable: true }),
    phone: new FormControl('', { nonNullable: true }),
    costRate: new FormControl<number | null>(null),
    branchId: new FormControl<string | null>(null),
    departmentId: new FormControl<string | null>(null),
    tz: new FormControl('', { nonNullable: true }),
    locale: new FormControl('', { nonNullable: true }),
    notificationPrefsJson: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    this.branchesService.list().subscribe((branches) => this.branches.set(branches));
    this.departmentsService.list().subscribe((departments) => this.departments.set(departments));
    this.usersService.list().subscribe((users) => this.allUsers.set(users));
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.usersService.get(this.userId).subscribe({
      next: (user) => {
        this.user.set(user);
        this.form.patchValue({
          name: user.name,
          designation: user.designation ?? '',
          barEnrollmentNo: user.barEnrollmentNo ?? '',
          phone: user.phone ?? '',
          costRate: user.costRate,
          branchId: user.branchId,
          departmentId: user.departmentId,
          tz: user.tz ?? '',
          locale: user.locale ?? '',
        });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  save(): void {
    this.saving.set(true);
    const value = this.form.getRawValue();
    this.usersService
      .update(this.userId, {
        name: value.name,
        designation: value.designation || null,
        barEnrollmentNo: value.barEnrollmentNo || null,
        phone: value.phone || null,
        costRate: value.costRate,
        branchId: value.branchId,
        departmentId: value.departmentId,
        tz: value.tz || null,
        locale: value.locale || null,
        notificationPrefsJson: value.notificationPrefsJson || undefined,
      })
      .subscribe({
        next: (user) => {
          this.user.set(user);
          this.saving.set(false);
          this.snackBar.open('User updated.', 'Dismiss', { duration: 3000 });
        },
        error: () => {
          this.saving.set(false);
          this.snackBar.open('Could not save changes.', 'Dismiss', { duration: 4000 });
        },
      });
  }

  suspend(): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Suspend user',
          message: 'This immediately revokes active sessions. The user can be reactivated later.',
          confirmLabel: 'Suspend',
          destructive: true,
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.busy.set(true);
        this.usersService.suspend(this.userId).subscribe({
          next: (user) => {
            this.user.set(user);
            this.busy.set(false);
          },
          error: () => {
            this.busy.set(false);
            this.snackBar.open('Could not suspend this user.', 'Dismiss', { duration: 4000 });
          },
        });
      });
  }

  reactivate(): void {
    this.busy.set(true);
    this.usersService.reactivate(this.userId).subscribe({
      next: (user) => {
        this.user.set(user);
        this.busy.set(false);
      },
      error: () => {
        this.busy.set(false);
        this.snackBar.open('Could not reactivate this user.', 'Dismiss', { duration: 4000 });
      },
    });
  }

  deactivate(): void {
    const candidates = this.allUsers().filter((u) => u.id !== this.userId);
    this.dialog
      .open(DeactivateUserDialogComponent, { data: { userId: this.userId, candidates } })
      .afterClosed()
      .subscribe((user) => {
        if (user) {
          this.user.set(user);
          this.snackBar.open('User deactivated.', 'Dismiss', { duration: 4000 });
        }
      });
  }
}
