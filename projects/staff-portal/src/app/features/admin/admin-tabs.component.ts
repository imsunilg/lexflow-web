import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Shared tab strip for the User Management + Settings screens (PRD Module 14/15). */
@Component({
  selector: 'lf-admin-tabs',
  standalone: true,
  imports: [MatTabsModule, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="admin-tabs" mat-tab-nav-bar [tabPanel]="tabPanel">
      @for (link of links; track link.path) {
        <a
          mat-tab-link
          [routerLink]="link.path"
          routerLinkActive
          #rla="routerLinkActive"
          [active]="rla.isActive"
        >
          {{ link.label }}
        </a>
      }
    </nav>
    <mat-tab-nav-panel #tabPanel />
  `,
  styles: `
    .admin-tabs {
      border-bottom: 1px solid var(--lf-surface-variant);
    }
  `,
})
export class AdminTabsComponent {
  readonly links = [
    { path: '/admin/users', label: 'Users' },
    { path: '/admin/roles', label: 'Roles' },
    { path: '/admin/teams', label: 'Teams' },
    { path: '/admin/departments', label: 'Departments' },
    { path: '/admin/branches', label: 'Branches' },
    { path: '/admin/access', label: 'Access' },
    { path: '/admin/settings', label: 'Settings' },
    { path: '/admin/workflow-rules', label: 'Workflow Rules' },
    { path: '/admin/audit', label: 'Audit' },
  ];
}
