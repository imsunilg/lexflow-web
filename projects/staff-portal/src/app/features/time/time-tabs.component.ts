import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Shared tab strip for the Time module's screens (PRD §11 "Time (5): Timesheet grid, Entry list, Approval queue, Utilization view"). */
@Component({
  selector: 'lf-time-tabs',
  standalone: true,
  imports: [MatTabsModule, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="time-tabs" mat-tab-nav-bar [tabPanel]="tabPanel">
      <a
        mat-tab-link
        routerLink="/time/timesheet"
        routerLinkActive
        #timesheetActive="routerLinkActive"
        [active]="timesheetActive.isActive"
      >
        Timesheet
      </a>
      <a
        mat-tab-link
        routerLink="/time/entries"
        routerLinkActive
        #entriesActive="routerLinkActive"
        [active]="entriesActive.isActive"
      >
        Entries
      </a>
      <a
        mat-tab-link
        routerLink="/time/approvals"
        routerLinkActive
        #approvalsActive="routerLinkActive"
        [active]="approvalsActive.isActive"
      >
        Approvals
      </a>
      <a
        mat-tab-link
        routerLink="/time/utilization"
        routerLinkActive
        #utilizationActive="routerLinkActive"
        [active]="utilizationActive.isActive"
      >
        Utilization
      </a>
    </nav>
    <mat-tab-nav-panel #tabPanel />
  `,
  styles: `
    .time-tabs {
      border-bottom: 1px solid var(--lf-surface-variant);
    }
  `,
})
export class TimeTabsComponent {}
