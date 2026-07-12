import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Shared tab strip for the Leads module's Kanban/List/Import screens (PRD §13 nav: "Leads (Kanban | List | Import)"). */
@Component({
  selector: 'lf-leads-tabs',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatTabsModule, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="leads-tabs" mat-tab-nav-bar [tabPanel]="tabPanel">
      <a
        mat-tab-link
        routerLink="/leads/kanban"
        routerLinkActive
        #kanbanActive="routerLinkActive"
        [active]="kanbanActive.isActive"
      >
        <span i18n="@@leads.leadsTabs.kanbanTab">Kanban</span>
      </a>
      <a
        mat-tab-link
        routerLink="/leads/list"
        routerLinkActive
        #listActive="routerLinkActive"
        [active]="listActive.isActive"
      >
        <span i18n="@@leads.leadsTabs.listTab">List</span>
      </a>
      <a
        mat-tab-link
        routerLink="/leads/import"
        routerLinkActive
        #importActive="routerLinkActive"
        [active]="importActive.isActive"
      >
        <span i18n="@@leads.leadsTabs.importTab">Import</span>
      </a>
    </nav>
    <mat-tab-nav-panel #tabPanel />
  `,
  styles: `
    .leads-tabs {
      border-bottom: 1px solid var(--lf-surface-variant);
    }
  `,
})
export class LeadsTabsComponent {}
