import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { PermissionService, RoleDto, RolesService } from 'shared';
import { AdminTabsComponent } from '../admin-tabs.component';

/**
 * Permission matrix viewer (PRD Module 14: "permission matrix viewer (role ×
 * permission)"). Built from the two real, already-loaded sources of truth —
 * `PermissionService.catalog()` (every permission key) and `RolesService.list()`
 * (every role's actual `permissionIds`) — cross-referenced client-side, since
 * there's no dedicated matrix endpoint. A checked cell means the role's
 * `permissionIds` includes that catalog entry's id.
 */
@Component({
  selector: 'lf-permission-matrix-page',
  standalone: true,
  imports: [MatIconModule, MatProgressBarModule, RouterLink, AdminTabsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './permission-matrix.page.html',
  styleUrl: './permission-matrix.page.scss',
})
export class PermissionMatrixPage {
  private readonly rolesService = inject(RolesService);
  private readonly permissionService = inject(PermissionService);

  readonly loading = signal(true);
  readonly roles = signal<RoleDto[]>([]);

  readonly rows = computed(() =>
    this.permissionService.catalog().map((entry) => ({
      entry,
      grants: this.roles().map((role) => role.permissionIds.includes(entry.id)),
    })),
  );

  constructor() {
    this.rolesService.list().subscribe({
      next: (roles) => {
        this.roles.set(roles);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
