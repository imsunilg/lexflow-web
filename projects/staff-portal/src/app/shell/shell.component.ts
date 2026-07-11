import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService, NotificationsService, PermissionService, TimerService } from 'shared';
import { NAV_ITEMS } from './nav-items';
import { SearchOverlayComponent } from './search-overlay.component';

/**
 * App shell: left icon-rail nav (72px collapsed / 280px expanded) + top bar
 * (global search, timer chip, quick-add, notifications, avatar), per PRD §12
 * layout spec and §13 navigation structure. Nav items without read permission
 * are hidden, not just disabled (§13 "role trimming").
 */
@Component({
  selector: 'lf-staff-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatBadgeModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatMenuModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  private readonly permissionService = inject(PermissionService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  private readonly timerService = inject(TimerService);
  private readonly notificationsService = inject(NotificationsService);

  readonly railExpanded = signal(false);

  readonly navItems = computed(() =>
    NAV_ITEMS.filter((item) => !item.permission || this.permissionService.has(item.permission)),
  );

  readonly currentUser = this.permissionService.currentUser;

  readonly runningTimer = this.timerService.current;
  readonly timerDisplay = computed(() => formatElapsed(this.timerService.elapsedSeconds()));

  readonly notifications = this.notificationsService.notifications;
  readonly unreadCount = this.notificationsService.unreadCount;

  constructor() {
    // The shell only mounts once the auth guard has already let the user through,
    // so this is exactly the right place to start the timer chip and notification
    // bell's live state — both `connect*` calls are idempotent (safe even if the
    // shell were ever re-created within a session).
    this.timerService.connect();
    this.notificationsService.connectRealtime();
    this.notificationsService.load().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  toggleRail(): void {
    this.railExpanded.update((expanded) => !expanded);
  }

  openSearch(): void {
    this.dialog.open(SearchOverlayComponent, {
      position: { top: '96px' },
      panelClass: 'search-overlay-panel',
      autoFocus: false,
    });
  }

  /** ⌘K (Mac) / Ctrl+K (Windows/Linux) opens global search from anywhere in the shell (PRD §12/§26). */
  @HostListener('document:keydown', ['$event'])
  onGlobalKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.openSearch();
    }
  }

  markNotificationRead(id: string): void {
    this.notificationsService.markAsRead(id).subscribe();
  }

  signOut(): void {
    // AuthService.logout() clears local session state in `finalize`, so navigating
    // to /login is correct whether the server-side call succeeds or fails.
    this.authService.logout().subscribe({
      next: () => this.router.navigateByUrl('/login'),
      error: () => this.router.navigateByUrl('/login'),
    });
  }
}

function formatElapsed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
}
