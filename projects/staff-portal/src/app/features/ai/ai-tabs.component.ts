import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Shared tab strip for the AI Studio screens (PRD Module 16 UI Components). */
@Component({
  selector: 'lf-ai-tabs',
  standalone: true,
  imports: [MatTabsModule, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="ai-tabs" mat-tab-nav-bar [tabPanel]="tabPanel">
      <a
        mat-tab-link
        routerLink="/ai-studio"
        routerLinkActive
        #hubActive="routerLinkActive"
        [active]="hubActive.isActive"
        i18n="@@ai.aiTabs.hub"
      >
        Hub
      </a>
      <a
        mat-tab-link
        routerLink="/ai-studio/contract-review"
        routerLinkActive
        #contractActive="routerLinkActive"
        [active]="contractActive.isActive"
        i18n="@@ai.aiTabs.contractReview"
      >
        Contract Review
      </a>
      <a
        mat-tab-link
        routerLink="/ai-studio/draft-studio"
        routerLinkActive
        #draftActive="routerLinkActive"
        [active]="draftActive.isActive"
        i18n="@@ai.aiTabs.draftStudio"
      >
        Draft Studio
      </a>
      <a
        mat-tab-link
        routerLink="/ai-studio/research"
        routerLinkActive
        #researchActive="routerLinkActive"
        [active]="researchActive.isActive"
        i18n="@@ai.aiTabs.research"
      >
        Research
      </a>
    </nav>
    <mat-tab-nav-panel #tabPanel />
  `,
  styles: `
    .ai-tabs {
      border-bottom: 1px solid var(--lf-surface-variant);
    }
  `,
})
export class AiTabsComponent {}
