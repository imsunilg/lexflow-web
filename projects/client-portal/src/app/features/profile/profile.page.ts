import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import { PortalAuthService } from '../../core/services/portal-auth.service';
import { PortalSessionService } from '../../core/services/portal-session.service';

/**
 * Profile & preferences (PRD Module 17 step 9). Confirmed backend gaps
 * disclosed here rather than faked: no `/preferences` endpoint exists at all
 * (no notification-channel or language settings to persist), and there's no
 * authenticated password-change or 2FA-management endpoint for portal users
 * (only the token-based forgot/reset flow) — no session list either. This
 * page shows the one thing that IS real (the profile identity from login)
 * plus sign-out.
 */
@Component({
  selector: 'lf-portal-profile-page',
  standalone: true,
  imports: [MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
})
export class ProfilePage {
  private readonly authService = inject(PortalAuthService);
  private readonly router = inject(Router);
  private readonly session = inject(PortalSessionService);

  readonly user = this.session.user;

  signOut(): void {
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login']),
    });
  }
}
