import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Shared tab strip for the Communication module's screens (PRD Module 11 UI Components). */
@Component({
  selector: 'lf-comm-tabs',
  standalone: true,
  imports: [MatTabsModule, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="comm-tabs" mat-tab-nav-bar [tabPanel]="tabPanel">
      <a
        mat-tab-link
        routerLink="/communication/inbox"
        routerLinkActive
        #inboxActive="routerLinkActive"
        [active]="inboxActive.isActive"
      >
        Inbox
      </a>
      <a
        mat-tab-link
        routerLink="/communication/sms"
        routerLinkActive
        #smsActive="routerLinkActive"
        [active]="smsActive.isActive"
      >
        SMS
      </a>
      <a
        mat-tab-link
        routerLink="/communication/whatsapp"
        routerLinkActive
        #waActive="routerLinkActive"
        [active]="waActive.isActive"
      >
        WhatsApp
      </a>
      <a
        mat-tab-link
        routerLink="/communication/calls"
        routerLinkActive
        #callsActive="routerLinkActive"
        [active]="callsActive.isActive"
      >
        Calls
      </a>
    </nav>
    <mat-tab-nav-panel #tabPanel />
  `,
  styles: `
    .comm-tabs {
      border-bottom: 1px solid var(--lf-surface-variant);
    }
  `,
})
export class CommTabsComponent {}
