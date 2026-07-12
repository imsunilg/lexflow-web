import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { SETTINGS_SECTIONS } from 'shared';
import { AdminTabsComponent } from '../admin-tabs.component';

interface SettingsCard {
  path: string;
  label: string;
  icon: string;
}

/**
 * Settings hub (PRD Module 15). Card grid linking to the 9 generic
 * `SETTINGS_SECTIONS` (each routed to `/admin/settings/{key}` and rendered by
 * `SettingsSectionPage`) plus the 3 dedicated-controller areas — Number
 * series, Tax rates, Payment gateways — which have their own pages because
 * they're collection endpoints, not a single JSON blob.
 */
@Component({
  selector: 'lf-settings-hub-page',
  standalone: true,
  imports: [MatCardModule, MatIconModule, RouterLink, AdminTabsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-hub.page.html',
  styleUrl: './settings-hub.page.scss',
})
export class SettingsHubPage {
  private static readonly SECTION_ICONS: Record<string, string> = {
    firm_details: 'apartment',
    branding: 'palette',
    theme: 'contrast',
    smtp: 'mail',
    sms_gateway: 'sms',
    whatsapp: 'chat',
    business_hours: 'schedule',
    data: 'storage',
    security: 'security',
  };

  readonly sectionCards: SettingsCard[] = SETTINGS_SECTIONS.map((section) => ({
    path: `/admin/settings/${section.key}`,
    label: section.label,
    icon: SettingsHubPage.SECTION_ICONS[section.key] ?? 'settings',
  }));

  readonly collectionCards: SettingsCard[] = [
    { path: '/admin/settings/number-series', label: 'Number series', icon: 'format_list_numbered' },
    { path: '/admin/settings/tax-rates', label: 'Tax rates', icon: 'percent' },
    { path: '/admin/settings/gateways', label: 'Payment gateways', icon: 'payments' },
  ];
}
