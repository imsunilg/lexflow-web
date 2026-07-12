import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent, RoleDto, RolesService } from 'shared';
import { AdminTabsComponent } from '../admin-tabs.component';
import { RoleFormDialogComponent } from './role-form-dialog.component';

/**
 * Roles list (PRD Module 14). System roles reject edits server-side (403) —
 * their edit action is disabled here rather than left to fail. There is no
 * DELETE route for roles at all, so no delete action exists for any role.
 */
@Component({
  selector: 'lf-roles-list-page',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTooltipModule,
    RouterLink,
    EmptyStateComponent,
    AdminTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './roles-list.page.html',
  styleUrl: './roles-list.page.scss',
})
export class RolesListPage {
  private readonly rolesService = inject(RolesService);
  private readonly dialog = inject(MatDialog);

  readonly loading = signal(true);
  readonly roles = signal<RoleDto[]>([]);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.rolesService.list().subscribe({
      next: (roles) => {
        this.roles.set(roles);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openNew(): void {
    this.dialog
      .open(RoleFormDialogComponent, { data: {} })
      .afterClosed()
      .subscribe((created) => {
        if (created) this.load();
      });
  }

  openEdit(role: RoleDto): void {
    if (role.isSystem) return;
    this.dialog
      .open(RoleFormDialogComponent, { data: { role } })
      .afterClosed()
      .subscribe((updated) => {
        if (updated) this.load();
      });
  }
}
