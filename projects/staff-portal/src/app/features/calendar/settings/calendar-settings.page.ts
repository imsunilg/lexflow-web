import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink } from '@angular/router';
import { IcsExportTabComponent } from './ics-export-tab.component';
import { ReminderPolicyTabComponent } from './reminder-policy-tab.component';
import { SyncSettingsTabComponent } from './sync-settings-tab.component';

/**
 * Calendar settings shell (PRD Module 6 UI Components: "sync-settings page
 * (account connect, direction, privacy level), reminder-policy editor ...
 * ICS export per user"). Same `<mat-tab-group>` shell pattern as
 * `MatterWorkspacePage`, hosting one tab component per settings area.
 */
@Component({
  selector: 'lf-calendar-settings-page',
  standalone: true,
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    SyncSettingsTabComponent,
    ReminderPolicyTabComponent,
    IcsExportTabComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './calendar-settings.page.html',
  styleUrl: './calendar-settings.page.scss',
})
export class CalendarSettingsPage {}
