import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Shared tab strip for the Reports module's screens (PRD Module 13 UI Components). */
@Component({
  selector: 'lf-reports-tabs',
  standalone: true,
  imports: [MatTabsModule, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="reports-tabs" mat-tab-nav-bar [tabPanel]="tabPanel">
      <a
        mat-tab-link
        routerLink="/reports/hub"
        routerLinkActive
        #hubActive="routerLinkActive"
        [active]="hubActive.isActive"
      >
        Hub
      </a>
      <a
        mat-tab-link
        routerLink="/reports/saved"
        routerLinkActive
        #savedActive="routerLinkActive"
        [active]="savedActive.isActive"
      >
        My Reports
      </a>
      <a
        mat-tab-link
        routerLink="/reports/builder"
        routerLinkActive
        #builderActive="routerLinkActive"
        [active]="builderActive.isActive"
      >
        New Custom Report
      </a>
    </nav>
    <mat-tab-nav-panel #tabPanel />
  `,
  styles: `
    .reports-tabs {
      border-bottom: 1px solid var(--lf-surface-variant);
    }
  `,
})
export class ReportsTabsComponent {}
