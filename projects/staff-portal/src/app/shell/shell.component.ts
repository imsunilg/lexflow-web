import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PermissionService } from 'shared';
import { NAV_ITEMS } from './nav-items';

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
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  private readonly permissionService = inject(PermissionService);

  readonly railExpanded = signal(false);

  readonly navItems = computed(() =>
    NAV_ITEMS.filter((item) => !item.permission || this.permissionService.has(item.permission)),
  );

  toggleRail(): void {
    this.railExpanded.update((expanded) => !expanded);
  }
}
