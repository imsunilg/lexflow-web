import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Shared tab strip for the Task Management module's screens (PRD Module 10 UI Components). */
@Component({
  selector: 'lf-tasks-tabs',
  standalone: true,
  imports: [MatTabsModule, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="tasks-tabs" mat-tab-nav-bar [tabPanel]="tabPanel">
      <a
        mat-tab-link
        routerLink="/tasks/board"
        routerLinkActive
        #boardActive="routerLinkActive"
        [active]="boardActive.isActive"
        i18n="@@tasks.tasksTabs.board"
      >
        Board
      </a>
      <a
        mat-tab-link
        routerLink="/tasks/workload"
        routerLinkActive
        #workloadActive="routerLinkActive"
        [active]="workloadActive.isActive"
        i18n="@@tasks.tasksTabs.workload"
      >
        Workload
      </a>
      <a
        mat-tab-link
        routerLink="/tasks/templates"
        routerLinkActive
        #templatesActive="routerLinkActive"
        [active]="templatesActive.isActive"
        i18n="@@tasks.tasksTabs.templates"
      >
        Templates
      </a>
    </nav>
    <mat-tab-nav-panel #tabPanel />
  `,
  styles: `
    .tasks-tabs {
      border-bottom: 1px solid var(--lf-surface-variant);
    }
  `,
})
export class TasksTabsComponent {}
