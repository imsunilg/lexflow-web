import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { TeamDto, TeamsService, UpsertTeamRequest, UserSummary } from 'shared';

export interface TeamFormDialogData {
  team?: TeamDto;
  users: UserSummary[];
}

/**
 * Create/edit dialog for `TeamsController` (PRD Module 14). Backs both flows
 * off `MAT_DIALOG_DATA.team` — when present, submits go through `update()`
 * instead of `create()`, and the dialog closes with the resulting `TeamDto`
 * (or `undefined` on cancel) so the list page can reload.
 */
@Component({
  selector: 'lf-team-form-dialog',
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
    <h2 mat-dialog-title i18n="@@admin.teamFormDialog.title">
      {{ isEdit ? 'Edit team' : 'New team' }}
    </h2>

    <mat-dialog-content class="team-form">
      <mat-form-field appearance="outline">
        <mat-label i18n="@@admin.teamFormDialog.nameLabel">Name</mat-label>
        <input matInput [formControl]="name" required />
        @if (name.invalid && name.touched) {
          <mat-error i18n="@@admin.teamFormDialog.nameRequired">Name is required.</mat-error>
        }
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label i18n="@@admin.teamFormDialog.leadLabel">Lead</mat-label>
        <mat-select [formControl]="leadUserId">
          <mat-option [value]="null" i18n="@@admin.teamFormDialog.leadNoneOption">None</mat-option>
          @for (user of users; track user.id) {
            <mat-option [value]="user.id">{{ user.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label i18n="@@admin.teamFormDialog.membersLabel">Members</mat-label>
        <mat-select [formControl]="memberUserIds" multiple>
          @for (user of users; track user.id) {
            <mat-option [value]="user.id">{{ user.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      @if (error) {
        <p class="team-form__error">{{ error }}</p>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button
        mat-button
        type="button"
        (click)="cancel()"
        i18n="@@admin.teamFormDialog.cancelButton"
      >
        Cancel
      </button>
      <button
        mat-flat-button
        color="primary"
        type="button"
        [disabled]="submitting"
        (click)="submit()"
        i18n="@@admin.teamFormDialog.submitButton"
      >
        {{ isEdit ? 'Save' : 'Create team' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .team-form {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-1);
      min-width: 420px;
    }

    .team-form__error {
      color: var(--lf-error);
      font-size: var(--lf-text-sm);
      margin: 0;
    }
  `,
})
export class TeamFormDialogComponent {
  private readonly dialogRef =
    inject<MatDialogRef<TeamFormDialogComponent, TeamDto | undefined>>(MatDialogRef);
  private readonly teamsService = inject(TeamsService);
  readonly data = inject<TeamFormDialogData>(MAT_DIALOG_DATA);

  readonly isEdit = !!this.data.team;
  readonly users = this.data.users;

  readonly name = new FormControl(this.data.team?.name ?? '', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(200)],
  });
  readonly leadUserId = new FormControl<string | null>(this.data.team?.leadUserId ?? null);
  readonly memberUserIds = new FormControl(this.data.team?.memberUserIds ?? [], {
    nonNullable: true,
  });

  submitting = false;
  error: string | null = null;

  cancel(): void {
    this.dialogRef.close(undefined);
  }

  submit(): void {
    this.name.markAsTouched();
    if (this.name.invalid) return;

    const request: UpsertTeamRequest = {
      name: this.name.value,
      leadUserId: this.leadUserId.value,
      memberUserIds: this.memberUserIds.value,
    };

    this.submitting = true;
    this.error = null;
    const request$ = this.data.team
      ? this.teamsService.update(this.data.team.id, request)
      : this.teamsService.create(request);

    request$.subscribe({
      next: (team) => this.dialogRef.close(team),
      error: () => {
        this.submitting = false;
        this.error = `Could not ${this.isEdit ? 'update' : 'create'} the team — please try again.`;
      },
    });
  }
}
