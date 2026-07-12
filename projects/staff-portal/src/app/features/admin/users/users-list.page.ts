import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { EmptyStateComponent, UserSummary, UsersService } from 'shared';
import { AdminTabsComponent } from '../admin-tabs.component';
import { InviteUserDialogComponent } from './invite-user-dialog.component';

/**
 * Users list (PRD Module 14: "Users: invite by email ... activation link").
 * `GET /users` has no search/filter params — this is the full roster,
 * filtered client-side.
 */
@Component({
  selector: 'lf-users-list-page',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    EmptyStateComponent,
    AdminTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './users-list.page.html',
  styleUrl: './users-list.page.scss',
})
export class UsersListPage {
  private readonly usersService = inject(UsersService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly users = signal<UserSummary[]>([]);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.usersService.list().subscribe({
      next: (users) => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openInvite(): void {
    this.dialog
      .open(InviteUserDialogComponent)
      .afterClosed()
      .subscribe((invited) => {
        if (invited) {
          this.snackBar.open(`Invitation sent to ${invited.email}.`, 'Dismiss', { duration: 4000 });
          this.load();
        }
      });
  }

  openUser(user: UserSummary): void {
    this.router.navigate(['/admin/users', user.id]);
  }
}
