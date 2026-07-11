import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CalendarService } from 'shared';

/**
 * ICS export tab (PRD Module 6 UI Components: "ICS export per user
 * (read-only secret URL, revocable)"; Security Rules: "ICS secret 128-bit,
 * regenerable"). `GET /calendar/ics/token` is documented as idempotent-create
 * (see `IcsTokenResult` JSDoc in `calendar.models.ts`) — it's called on load
 * to fetch-or-provision the secret URL. "Regenerate" revokes the current
 * token then provisions a new one, with an explicit confirmation first since
 * the old URL stops working immediately (matches AC-CAL4's revocation intent
 * for external access, applied here to the ICS feed).
 */
@Component({
  selector: 'lf-ics-export-tab',
  standalone: true,
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ics-export-tab.component.html',
  styleUrl: './ics-export-tab.component.scss',
})
export class IcsExportTabComponent {
  private readonly calendarService = inject(CalendarService);

  readonly loading = signal(true);
  readonly regenerating = signal(false);
  readonly url = signal<string | null>(null);
  readonly copied = signal(false);
  readonly errorMessage = signal<string | null>(null);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.calendarService.icsToken().subscribe({
      next: (result) => {
        this.url.set(result.url);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set("Couldn't load your ICS export link. Please try again.");
        this.loading.set(false);
      },
    });
  }

  copy(): void {
    const url = this.url();
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  regenerate(): void {
    const confirmed = window.confirm(
      'Regenerate your ICS export link? The current URL will stop working immediately — any calendar app subscribed to it will need the new link.',
    );
    if (!confirmed) return;

    this.regenerating.set(true);
    this.errorMessage.set(null);
    this.calendarService.revokeIcsToken().subscribe({
      next: () => {
        this.calendarService.icsToken().subscribe({
          next: (result) => {
            this.url.set(result.url);
            this.regenerating.set(false);
          },
          error: () => {
            this.errorMessage.set(
              'Old link was revoked, but a new one could not be provisioned. Please retry.',
            );
            this.regenerating.set(false);
            this.url.set(null);
          },
        });
      },
      error: () => {
        this.errorMessage.set("Couldn't revoke the current link. Please try again.");
        this.regenerating.set(false);
      },
    });
  }
}
