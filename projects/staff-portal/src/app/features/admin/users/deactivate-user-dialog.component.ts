import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import {
  ReassignmentEntry,
  UnresolvedAssignment,
  UserDetail,
  UserSummary,
  UsersService,
} from 'shared';

export interface DeactivateUserDialogData {
  userId: string;
  candidates: UserSummary[];
}

interface AssignmentRow {
  assignment: UnresolvedAssignment;
  newAssigneeUserId: string | null;
}

/**
 * Deactivation wizard (PRD Module 14: "Deactivation wizard forces
 * reassignment of matters/tasks/leads"). `GET /users/{id}/unresolved-assignments`
 * only ever returns `team_lead` entries today — Matter/Task/Lead reassignment
 * isn't wired server-side yet (nothing publishes those rows), so this wizard
 * only shows what the backend can actually surface. If there are zero
 * unresolved assignments, deactivation proceeds immediately with no
 * reassignment step.
 */
@Component({
  selector: 'lf-deactivate-user-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule, MatProgressBarModule, MatSelectModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Deactivate user</h2>
    <mat-dialog-content class="deactivate-user">
      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      } @else if (rows().length === 0) {
        <p>No unresolved assignments — this user can be deactivated immediately.</p>
      } @else {
        <p>
          This user has {{ rows().length }} unresolved assignment{{
            rows().length === 1 ? '' : 's'
          }}
          that must be reassigned before deactivation:
        </p>
        @for (row of rows(); track row.assignment.entityId) {
          <div class="deactivate-user__row">
            <span>{{ row.assignment.description }}</span>
            <mat-select
              placeholder="Reassign to…"
              [value]="row.newAssigneeUserId"
              (selectionChange)="setAssignee(row, $event.value)"
            >
              @for (user of data.candidates; track user.id) {
                <mat-option [value]="user.id">{{ user.name }}</mat-option>
              }
            </mat-select>
          </div>
        }
      }

      @if (error()) {
        <p class="deactivate-user__error">{{ error() }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="undefined">Cancel</button>
      <button
        mat-flat-button
        color="warn"
        type="button"
        [disabled]="loading() || submitting() || !allResolved()"
        (click)="submit()"
      >
        Deactivate
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .deactivate-user {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-2);
      min-width: 420px;
    }

    .deactivate-user__row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--lf-space-2);
    }

    .deactivate-user__error {
      color: var(--lf-error);
      font-size: var(--lf-text-sm);
      margin: 0;
    }
  `,
})
export class DeactivateUserDialogComponent {
  private readonly dialogRef =
    inject<MatDialogRef<DeactivateUserDialogComponent, UserDetail | undefined>>(MatDialogRef);
  readonly data = inject<DeactivateUserDialogData>(MAT_DIALOG_DATA);
  private readonly usersService = inject(UsersService);

  readonly loading = signal(true);
  readonly rows = signal<AssignmentRow[]>([]);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    this.usersService.unresolvedAssignments(this.data.userId).subscribe({
      next: (assignments) => {
        this.rows.set(assignments.map((assignment) => ({ assignment, newAssigneeUserId: null })));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Could not load unresolved assignments.');
      },
    });
  }

  setAssignee(row: AssignmentRow, userId: string): void {
    this.rows.update((rows) =>
      rows.map((r) => (r === row ? { ...r, newAssigneeUserId: userId } : r)),
    );
  }

  allResolved(): boolean {
    return this.rows().every((row) => row.newAssigneeUserId !== null);
  }

  submit(): void {
    if (!this.allResolved()) return;

    this.submitting.set(true);
    this.error.set(null);
    const reassignments: ReassignmentEntry[] = this.rows().map((row) => ({
      entityType: row.assignment.entityType,
      entityId: row.assignment.entityId,
      newAssigneeUserId: row.newAssigneeUserId!,
    }));

    this.usersService.deactivate(this.data.userId, { reassignments }).subscribe({
      next: (user) => this.dialogRef.close(user),
      error: () => {
        this.submitting.set(false);
        this.error.set('Deactivation failed — some assignments may still be unresolved.');
      },
    });
  }
}
