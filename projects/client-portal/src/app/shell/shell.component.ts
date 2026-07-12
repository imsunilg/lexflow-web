import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { OfflineBannerComponent } from 'shared';
import { PortalAuthService } from '../core/services/portal-auth.service';
import { PortalBrandingService } from '../core/services/portal-branding.service';
import { NAV_ITEMS } from './nav-items';

/**
 * Portal shell: top bar (firm branding + language toggle + profile menu) and a
 * bottom nav bar (mobile-first, PRD Module 17 — "mobile-first responsive, PWA
 * installable"). On wider viewports the same bar sits comfortably at the
 * bottom too; this is a portal, not a dense internal tool, so one nav pattern
 * suffices at every breakpoint. Loads branding once here (not app-wide via an
 * initializer) since theming is only meaningful once a user is inside the
 * authenticated shell — the login page renders with the default LexFlow theme.
 */
@Component({
  selector: 'lf-portal-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatIconModule,
    MatMenuModule,
    OfflineBannerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  private readonly authService = inject(PortalAuthService);
  private readonly brandingService = inject(PortalBrandingService);
  private readonly router = inject(Router);

  readonly navItems = NAV_ITEMS;
  readonly branding = this.brandingService.branding;
  readonly firmName = computed(() => this.branding()?.firmName ?? 'LexFlow');

  constructor() {
    this.brandingService.loadAndApply().subscribe();
  }

  signOut(): void {
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login']),
    });
  }
}
