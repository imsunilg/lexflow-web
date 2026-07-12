import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import {
  BranchDto,
  BranchesService,
  DepartmentDto,
  DepartmentsService,
  RoleDto,
  RolesService,
  UserDetail,
  UsersService,
} from 'shared';

/**
 * Invite dialog (PRD Module 14: "invite by email (role + branch + department
 * preassigned) -> activation link"). `POST /users/invite` issues a real 72h
 * activation token; the activation link itself is consumed by the existing
 * `AcceptInvitationPage` (reuses `POST /auth/reset` — see that file's doc
 * comment), not built here.
 */
@Component({
  selector: 'lf-invite-user-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title i18n="@@admin.inviteUserDialog.title">Invite user</h2>
    <mat-dialog-content class="invite-user">
      <form [formGroup]="form">
        <mat-form-field appearance="outline">
          <mat-label i18n="@@admin.inviteUserDialog.nameLabel">Name</mat-label>
          <input matInput formControlName="name" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label i18n="@@admin.inviteUserDialog.emailLabel">Email</mat-label>
          <input matInput type="email" formControlName="email" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label i18n="@@admin.inviteUserDialog.roleLabel">Role</mat-label>
          <mat-select formControlName="roleId">
            @for (role of roles(); track role.id) {
              <mat-option [value]="role.id">{{ role.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label i18n="@@admin.inviteUserDialog.branchLabel">Branch (optional)</mat-label>
          <mat-select formControlName="branchId">
            <mat-option [value]="null" i18n="@@admin.inviteUserDialog.branchNoneOption"
              >(none)</mat-option
            >
            @for (branch of branches(); track branch.id) {
              <mat-option [value]="branch.id">{{ branch.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label i18n="@@admin.inviteUserDialog.departmentLabel"
            >Department (optional)</mat-label
          >
          <mat-select formControlName="departmentId">
            <mat-option [value]="null" i18n="@@admin.inviteUserDialog.departmentNoneOption"
              >(none)</mat-option
            >
            @for (department of departments(); track department.id) {
              <mat-option [value]="department.id">{{ department.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </form>

      @if (submitting()) {
        <mat-progress-bar mode="indeterminate" />
      }
      @if (error()) {
        <p class="invite-user__error">{{ error() }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-button
        type="button"
        [mat-dialog-close]="undefined"
        i18n="@@admin.inviteUserDialog.cancelButton"
      >
        Cancel
      </button>
      <button
        mat-flat-button
        color="primary"
        type="button"
        [disabled]="form.invalid || submitting()"
        (click)="submit()"
        i18n="@@admin.inviteUserDialog.submitButton"
      >
        Send invitation
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .invite-user {
      display: flex;
      flex-direction: column;
      min-width: 420px;
    }

    .invite-user form {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-1);
    }

    .invite-user__error {
      color: var(--lf-error);
      font-size: var(--lf-text-sm);
      margin: 0;
    }
  `,
})
export class InviteUserDialogComponent {
  private readonly dialogRef =
    inject<MatDialogRef<InviteUserDialogComponent, UserDetail | undefined>>(MatDialogRef);
  private readonly usersService = inject(UsersService);
  private readonly rolesService = inject(RolesService);
  private readonly branchesService = inject(BranchesService);
  private readonly departmentsService = inject(DepartmentsService);

  readonly roles = signal<RoleDto[]>([]);
  readonly branches = signal<BranchDto[]>([]);
  readonly departments = signal<DepartmentDto[]>([]);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    roleId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    branchId: new FormControl<string | null>(null),
    departmentId: new FormControl<string | null>(null),
  });

  constructor() {
    this.rolesService.list().subscribe((roles) => this.roles.set(roles));
    this.branchesService.list().subscribe((branches) => this.branches.set(branches));
    this.departmentsService.list().subscribe((departments) => this.departments.set(departments));
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);
    const value = this.form.getRawValue();
    this.usersService
      .invite({
        name: value.name,
        email: value.email,
        roleId: value.roleId,
        branchId: value.branchId,
        departmentId: value.departmentId,
      })
      .subscribe({
        next: (user) => this.dialogRef.close(user),
        error: () => {
          this.submitting.set(false);
          this.error.set('Could not send this invitation.');
        },
      });
  }
}
