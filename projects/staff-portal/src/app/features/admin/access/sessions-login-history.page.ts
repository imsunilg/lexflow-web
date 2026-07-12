import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  EmptyStateComponent,
  LoginHistoryEntry,
  LoginHistoryService,
  SessionInfo,
  SessionsService,
  UserSummary,
  UsersService,
} from 'shared';
import { AdminTabsComponent } from '../admin-tabs.component';

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Sessions & login-history browser (PRD Module 14). Sessions are per-user
 * only — `UsersService.sessions(userId)` is the sole listing endpoint, there
 * is no "all active sessions across the firm" view. Login history optionally
 * filters by the same selected user plus a `from` date
 * (`LoginHistoryService.list(userId?, from?)`); omitting the user shows
 * history for all users the caller is permitted to see.
 */
@Component({
  selector: 'lf-sessions-login-history-page',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    EmptyStateComponent,
    AdminTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sessions-login-history.page.html',
  styleUrl: './sessions-login-history.page.scss',
})
export class SessionsLoginHistoryPage {
  private readonly usersService = inject(UsersService);
  private readonly sessionsService = inject(SessionsService);
  private readonly loginHistoryService = inject(LoginHistoryService);
  private readonly snackBar = inject(MatSnackBar);

  readonly users = signal<UserSummary[]>([]);
  readonly usersLoading = signal(true);

  readonly userControl = new FormControl<string | null>(null);
  readonly fromControl = new FormControl<Date | null>(null);

  readonly sessions = signal<SessionInfo[]>([]);
  readonly sessionsLoading = signal(false);
  readonly sessionsError = signal<string | null>(null);
  readonly revokingId = signal<string | null>(null);

  readonly loginHistory = signal<LoginHistoryEntry[]>([]);
  readonly loginHistoryLoading = signal(false);
  readonly loginHistoryError = signal<string | null>(null);
  readonly loginHistoryLoaded = signal(false);

  constructor() {
    this.usersService.list().subscribe({
      next: (users) => {
        this.users.set(users);
        this.usersLoading.set(false);
      },
      error: () => this.usersLoading.set(false),
    });
    this.searchLoginHistory();
  }

  onUserChange(): void {
    this.sessions.set([]);
    this.sessionsError.set(null);
    const userId = this.userControl.value;
    if (userId) {
      this.loadSessions(userId);
    }
  }

  loadSessions(userId: string): void {
    this.sessionsLoading.set(true);
    this.sessionsError.set(null);
    this.usersService.sessions(userId).subscribe({
      next: (sessions) => {
        this.sessions.set(sessions);
        this.sessionsLoading.set(false);
      },
      error: () => {
        this.sessionsLoading.set(false);
        this.sessionsError.set('Could not load sessions for this user.');
      },
    });
  }

  revoke(session: SessionInfo): void {
    this.revokingId.set(session.id);
    this.sessionsService.revoke(session.id).subscribe({
      next: () => {
        this.revokingId.set(null);
        this.snackBar.open('Session revoked.', 'Dismiss', { duration: 3000 });
        const userId = this.userControl.value;
        if (userId) this.loadSessions(userId);
      },
      error: () => {
        this.revokingId.set(null);
        this.snackBar.open('Could not revoke this session.', 'Dismiss', { duration: 4000 });
      },
    });
  }

  searchLoginHistory(): void {
    this.loginHistoryLoading.set(true);
    this.loginHistoryError.set(null);
    const userId = this.userControl.value ?? undefined;
    const from = this.fromControl.value ? toIsoDate(this.fromControl.value) : undefined;
    this.loginHistoryService.list(userId, from).subscribe({
      next: (entries) => {
        this.loginHistory.set(entries);
        this.loginHistoryLoading.set(false);
        this.loginHistoryLoaded.set(true);
      },
      error: () => {
        this.loginHistoryLoading.set(false);
        this.loginHistoryLoaded.set(true);
        this.loginHistoryError.set('Could not load login history.');
      },
    });
  }

  userLabel(user: UserSummary): string {
    return `${user.name} (${user.email})`;
  }

  isSessionActive(session: SessionInfo): boolean {
    return session.isActive && !session.revokedAt;
  }
}
