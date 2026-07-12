import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { forkJoin } from 'rxjs';
import {
  ConfirmDialogComponent,
  EmptyStateComponent,
  TeamDto,
  TeamsService,
  UserSummary,
  UsersService,
} from 'shared';
import { AdminTabsComponent } from '../admin-tabs.component';
import { TeamFormDialogComponent, TeamFormDialogData } from './team-form-dialog.component';

/**
 * Teams list (PRD Module 14 UI Components: "Teams" tab). `TeamsController`
 * has full CRUD, so this page supports create, edit, and delete. Lead/member
 * names are resolved client-side from `GET /users` (`UsersService.list()`),
 * fetched once alongside the team list and reused by the form dialog for its
 * lead/member pickers.
 */
@Component({
  selector: 'lf-teams-list-page',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    EmptyStateComponent,
    AdminTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './teams-list.page.html',
  styleUrl: './teams-list.page.scss',
})
export class TeamsListPage {
  private readonly teamsService = inject(TeamsService);
  private readonly usersService = inject(UsersService);
  private readonly dialog = inject(MatDialog);

  readonly loading = signal(true);
  readonly teams = signal<TeamDto[]>([]);
  readonly users = signal<UserSummary[]>([]);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    forkJoin({
      teams: this.teamsService.list(),
      users: this.usersService.list(),
    }).subscribe({
      next: ({ teams, users }) => {
        this.teams.set(teams);
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

  memberCount(team: TeamDto): number {
    return team.memberUserIds.length;
  }

  openNew(): void {
    this.dialog
      .open<TeamFormDialogComponent, TeamFormDialogData, TeamDto | undefined>(
        TeamFormDialogComponent,
        { data: { users: this.users() } },
      )
      .afterClosed()
      .subscribe((result) => {
        if (result) this.load();
      });
  }

  openEdit(team: TeamDto): void {
    this.dialog
      .open<TeamFormDialogComponent, TeamFormDialogData, TeamDto | undefined>(
        TeamFormDialogComponent,
        { data: { team, users: this.users() } },
      )
      .afterClosed()
      .subscribe((result) => {
        if (result) this.load();
      });
  }

  deleteTeam(team: TeamDto): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Delete team',
          message: `Delete "${team.name}"? This cannot be undone.`,
          destructive: true,
          confirmLabel: 'Delete',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.teamsService.delete(team.id).subscribe(() => this.load());
      });
  }
}
