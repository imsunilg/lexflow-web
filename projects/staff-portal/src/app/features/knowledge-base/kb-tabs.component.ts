import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Shared tab strip for the Knowledge Base module's screens (PRD Module 12 UI Components). */
@Component({
  selector: 'lf-kb-tabs',
  standalone: true,
  imports: [MatTabsModule, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="kb-tabs" mat-tab-nav-bar [tabPanel]="tabPanel">
      <a
        mat-tab-link
        routerLink="/knowledge-base/home"
        routerLinkActive
        #homeActive="routerLinkActive"
        [active]="homeActive.isActive"
      >
        Home
      </a>
      <a
        mat-tab-link
        routerLink="/knowledge-base/articles"
        routerLinkActive
        #articlesActive="routerLinkActive"
        [active]="articlesActive.isActive"
      >
        Articles
      </a>
      <a
        mat-tab-link
        routerLink="/knowledge-base/collections"
        routerLinkActive
        #collectionsActive="routerLinkActive"
        [active]="collectionsActive.isActive"
      >
        Collections
      </a>
    </nav>
    <mat-tab-nav-panel #tabPanel />
  `,
  styles: `
    .kb-tabs {
      border-bottom: 1px solid var(--lf-surface-variant);
    }
  `,
})
export class KbTabsComponent {}
