import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  Client,
  ClientPortalUser,
  ClientsService,
  EmptyStateComponent,
  StatusChipComponent,
  StatusChipTone,
} from 'shared';

function portalUserStatusTone(status: ClientPortalUser['status']): StatusChipTone {
  switch (status) {
    case 'Active':
      return 'success';
    case 'Invited':
      return 'warn';
    case 'Deactivated':
      return 'neutral';
  }
}

/**
 * Portal-access manager for the client 360 detail page (PRD Module 3 / §17
 * multi-user portal model). Reads the already-loaded `Client` from its input
 * rather than refetching it, and emits `portalToggled` so the host page can
 * refresh its own sticky-header portal chip without a full reload.
 */
@Component({
  selector: 'lf-portal-access-manager',
  standalone: true,
  imports: [
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MatTooltipModule,
    EmptyStateComponent,
    StatusChipComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="portal-manager">
      <div class="portal-manager__toggle-row">
        <mat-slide-toggle
          [checked]="client().portalEnabled"
          [disabled]="!client().email || togglingAccess()"
          [matTooltip]="
            !client().email
              ? 'Add an email address to this client before enabling portal access.'
              : ''
          "
          (change)="onToggle($event)"
        >
          Enable portal access
        </mat-slide-toggle>
        @if (togglingAccess()) {
          <mat-spinner diameter="18" />
        }
      </div>

      @if (toggleErrorMessage()) {
        <p class="portal-manager__error" role="alert">{{ toggleErrorMessage() }}</p>
      }

      @if (!client().portalEnabled) {
        <lf-empty-state icon="lock" title="Portal access is off for this client." />
      } @else if (loading()) {
        <div class="portal-manager__spinner">
          <mat-spinner diameter="32" />
        </div>
      } @else if (error()) {
        <lf-empty-state
          icon="error_outline"
          title="Couldn't load portal users"
          message="Something went wrong while loading portal users."
          ctaLabel="Retry"
          (cta)="loadPortalUsers()"
        />
      } @else if (portalUsers().length === 0) {
        <lf-empty-state icon="group" title="No portal users yet." />
      } @else {
        <div class="portal-manager__list">
          @for (user of portalUsers(); track user.id) {
            <div class="portal-manager__row">
              <span class="portal-manager__email">{{ user.email }}</span>
              <lf-status-chip [label]="user.status" [toneOverride]="tone(user)" />
              @if (user.twoFaEnabled) {
                <lf-status-chip label="2FA" toneOverride="info" />
              }
              @if (user.status === 'Invited') {
                <button
                  mat-button
                  type="button"
                  [disabled]="resendingId() === user.id"
                  (click)="resendInvite(user)"
                >
                  Resend invite
                </button>
                @if (resentId() === user.id) {
                  <span class="portal-manager__confirmation">Invite resent.</span>
                }
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .portal-manager {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-2);
    }

    .portal-manager__toggle-row {
      display: flex;
      align-items: center;
      gap: var(--lf-space-2);
    }

    .portal-manager__spinner {
      display: flex;
      justify-content: center;
      padding: var(--lf-space-4);
    }

    .portal-manager__list {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-1);
    }

    .portal-manager__row {
      display: flex;
      align-items: center;
      gap: var(--lf-space-2);
      padding: var(--lf-space-1) 0;
      border-bottom: 1px solid var(--lf-surface-variant);
    }

    .portal-manager__email {
      flex: 1;
      font-size: var(--lf-text-sm);
    }

    .portal-manager__confirmation {
      font-size: var(--lf-text-xs);
      color: var(--lf-success);
    }

    .portal-manager__error {
      margin: 0;
      color: var(--lf-error);
      font-size: var(--lf-text-sm);
    }
  `,
})
export class PortalAccessManagerComponent {
  private readonly clientsService = inject(ClientsService);

  readonly clientId = input.required<string>();
  readonly client = input.required<Client>();
  readonly portalToggled = output<Client>();

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly portalUsers = signal<ClientPortalUser[]>([]);

  readonly togglingAccess = signal(false);
  readonly toggleErrorMessage = signal<string | null>(null);

  readonly resendingId = signal<string | null>(null);
  readonly resentId = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.clientId();
      if (id) {
        this.loadPortalUsers();
      }
    });
  }

  loadPortalUsers(): void {
    this.loading.set(true);
    this.error.set(false);
    this.clientsService.listPortalUsers(this.clientId()).subscribe({
      next: (users) => {
        this.portalUsers.set(users);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        // The list-portal-users endpoint is an ASSUMPTION per ClientsService's
        // own doc comment — degrade to an empty list rather than an error
        // card when it 404s, since that's the expected shape today.
        if (err instanceof HttpErrorResponse && err.status === 404) {
          this.portalUsers.set([]);
          this.error.set(false);
        } else {
          this.error.set(true);
        }
      },
    });
  }

  tone(user: ClientPortalUser): StatusChipTone {
    return portalUserStatusTone(user.status);
  }

  onToggle(event: MatSlideToggleChange): void {
    const enable = event.checked;
    this.togglingAccess.set(true);
    this.toggleErrorMessage.set(null);
    this.clientsService.setPortalAccess(this.clientId(), enable).subscribe({
      next: (updatedClient) => {
        this.togglingAccess.set(false);
        this.portalToggled.emit(updatedClient);
        this.loadPortalUsers();
      },
      error: (err: unknown) => {
        this.togglingAccess.set(false);
        event.source.checked = !enable;
        if (err instanceof HttpErrorResponse && err.error?.code === 'CLIENT_EMAIL_REQUIRED') {
          this.toggleErrorMessage.set(
            'Add an email address to this client before enabling portal access.',
          );
        } else {
          this.toggleErrorMessage.set('Failed to update portal access. Please try again.');
        }
      },
    });
  }

  resendInvite(user: ClientPortalUser): void {
    this.resendingId.set(user.id);
    this.resentId.set(null);
    this.clientsService.resendPortalInvite(this.clientId()).subscribe({
      next: () => {
        this.resendingId.set(null);
        this.resentId.set(user.id);
      },
      error: () => {
        this.resendingId.set(null);
      },
    });
  }
}
