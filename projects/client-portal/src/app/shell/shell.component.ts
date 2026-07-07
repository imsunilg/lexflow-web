import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { NAV_ITEMS } from './nav-items';

/**
 * Portal shell: top bar (firm branding + language toggle + profile menu) and a
 * bottom nav bar (mobile-first, PRD Module 17 — "mobile-first responsive, PWA
 * installable"). On wider viewports the same bar sits comfortably at the
 * bottom too; this is a portal, not a dense internal tool, so one nav pattern
 * suffices at every breakpoint.
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  readonly navItems = NAV_ITEMS;
}
