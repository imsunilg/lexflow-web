import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CALENDAR_SYNC_PROVIDERS, CalendarService, CalendarSyncProvider } from 'shared';
import { CalendarSyncPrefsService, SyncPrivacyLevel } from './calendar-sync-prefs.service';

const PROVIDER_LABELS: Record<CalendarSyncProvider, string> = {
  google: 'Google Calendar',
  microsoft: 'Microsoft 365',
};

/**
 * Sync-settings tab (PRD Module 6 UI Components: "sync-settings page
 * (account connect, direction, privacy level)").
 *
 * Honest gap: the backend exposes only `connect`/`disconnect` — there is no
 * endpoint to list connected accounts or their sync-health status (confirmed
 * against `CalendarService`/the controller). This tab can therefore only
 * start a new OAuth connection; it cannot show which accounts are already
 * connected, and "Disconnect" has no `accountId` to call
 * `disconnectSync(provider, accountId, removeRemoteEvents)` with, so it stays
 * disabled here pending an accounts-listing endpoint.
 *
 * The "privacy level" (free/busy vs full detail) has no backend field either
 * — it is staged client-side only via `CalendarSyncPrefsService`
 * (localStorage), the same no-backend pattern `SavedMatterViewsService` uses
 * for saved views.
 */
@Component({
  selector: 'lf-sync-settings-tab',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatRadioModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sync-settings-tab.component.html',
  styleUrl: './sync-settings-tab.component.scss',
})
export class SyncSettingsTabComponent {
  private readonly calendarService = inject(CalendarService);
  private readonly syncPrefsService = inject(CalendarSyncPrefsService);

  readonly providers = CALENDAR_SYNC_PROVIDERS;
  readonly providerLabels = PROVIDER_LABELS;

  readonly privacyLevel = this.syncPrefsService.privacyLevel;

  readonly connecting = signal<CalendarSyncProvider | null>(null);
  readonly errorMessage = signal<string | null>(null);

  connect(provider: CalendarSyncProvider): void {
    this.connecting.set(provider);
    this.errorMessage.set(null);
    this.calendarService.connectSync(provider).subscribe({
      next: (result) => {
        this.connecting.set(null);
        window.open(result.redirectUrl, '_blank', 'noopener,noreferrer');
      },
      error: () => {
        this.connecting.set(null);
        this.errorMessage.set(
          `Couldn't start the ${PROVIDER_LABELS[provider]} connection. Please try again.`,
        );
      },
    });
  }

  setPrivacyLevel(level: SyncPrivacyLevel): void {
    this.syncPrefsService.setPrivacyLevel(level);
  }
}
