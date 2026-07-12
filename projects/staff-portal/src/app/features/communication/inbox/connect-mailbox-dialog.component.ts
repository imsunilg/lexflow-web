import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CommEmailService } from 'shared';
import { KnownMailbox, MailboxRegistryService } from './mailbox-registry.service';

const PROVIDERS = ['Gmail', 'MicrosoftGraph'] as const;

/**
 * Two-step mailbox connect flow. The OAuth wiring server-side is real (a
 * genuine authorize-URL build + real token exchange on callback), but this
 * app has no deployed redirect endpoint to catch the provider's callback
 * automatically — so step 2 asks the user to paste back the `code` query
 * param from the provider's redirect manually, exactly as `POST
 * /comm/email/accounts/callback` expects it. There is no mailbox-listing
 * endpoint, so a successfully connected mailbox is remembered only via
 * `MailboxRegistryService` (a local cache, not a server record of "known
 * mailboxes").
 */
@Component({
  selector: 'lf-connect-mailbox-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title i18n="@@communication.connectMailboxDialog.title">Connect a mailbox</h2>
    <mat-dialog-content class="connect-mailbox">
      @if (!authorizeUrl()) {
        <p class="connect-mailbox__hint" i18n="@@communication.connectMailboxDialog.step1Hint">
          Step 1: choose a provider and get an authorization link.
        </p>
        <mat-form-field appearance="outline">
          <mat-label i18n="@@communication.connectMailboxDialog.providerLabel">Provider</mat-label>
          <mat-select [formControl]="provider">
            @for (p of providers; track p) {
              <mat-option [value]="p">{{ p }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label i18n="@@communication.connectMailboxDialog.redirectUriLabel"
            >Redirect URI</mat-label
          >
          <input matInput [formControl]="redirectUri" />
        </mat-form-field>
        <button
          mat-flat-button
          color="primary"
          type="button"
          (click)="getAuthorizeUrl()"
          i18n="@@communication.connectMailboxDialog.getAuthLinkButton"
        >
          Get authorization link
        </button>
      } @else {
        <p class="connect-mailbox__hint" i18n="@@communication.connectMailboxDialog.step2Hint">
          Step 2: open the link below, authorize LexFlow, then paste the
          <code>code</code> value from the redirect URL here.
        </p>
        <a class="connect-mailbox__link" [href]="authorizeUrl()" target="_blank" rel="noopener">{{
          authorizeUrl()
        }}</a>
        <mat-form-field appearance="outline">
          <mat-label i18n="@@communication.connectMailboxDialog.authCodeLabel"
            >Authorization code</mat-label
          >
          <input matInput [formControl]="code" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label i18n="@@communication.connectMailboxDialog.labelLabel"
            >Label for this mailbox</mat-label
          >
          <input
            matInput
            [formControl]="label"
            placeholder="e.g. Litigation team inbox"
            i18n-placeholder="@@communication.connectMailboxDialog.labelPlaceholder"
          />
        </mat-form-field>
        @if (error()) {
          <p class="connect-mailbox__error">{{ error() }}</p>
        }
        <button
          mat-flat-button
          color="primary"
          type="button"
          [disabled]="code.invalid || submitting()"
          (click)="completeConnection()"
          i18n="@@communication.connectMailboxDialog.completeConnectionButton"
        >
          Complete connection
        </button>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-button
        type="button"
        [mat-dialog-close]="undefined"
        i18n="@@communication.connectMailboxDialog.cancelButton"
      >
        Cancel
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .connect-mailbox {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-1);
      min-width: 420px;
    }

    .connect-mailbox__hint {
      margin: 0;
      font-size: var(--lf-text-sm);
      color: var(--lf-on-surface-variant);
    }

    .connect-mailbox__link {
      word-break: break-all;
      font-size: var(--lf-text-sm);
    }

    .connect-mailbox__error {
      color: var(--lf-error);
      font-size: var(--lf-text-sm);
      margin: 0;
    }
  `,
})
export class ConnectMailboxDialogComponent {
  private readonly dialogRef =
    inject<MatDialogRef<ConnectMailboxDialogComponent, KnownMailbox | undefined>>(MatDialogRef);
  private readonly commEmailService = inject(CommEmailService);
  private readonly mailboxRegistry = inject(MailboxRegistryService);

  readonly providers = PROVIDERS;
  readonly provider = new FormControl<(typeof PROVIDERS)[number]>('Gmail', { nonNullable: true });
  readonly redirectUri = new FormControl(`${window.location.origin}/communication/inbox`, {
    nonNullable: true,
    validators: [Validators.required],
  });
  readonly code = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly label = new FormControl('', { nonNullable: true });

  readonly authorizeUrl = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  getAuthorizeUrl(): void {
    this.commEmailService
      .connectAccount({ provider: this.provider.value, redirectUri: this.redirectUri.value })
      .subscribe({
        next: (url) => this.authorizeUrl.set(url),
        error: () => this.error.set('Could not start the OAuth flow — check gateway settings.'),
      });
  }

  completeConnection(): void {
    if (this.code.invalid) return;

    this.submitting.set(true);
    this.error.set(null);
    // The API only exposes the connect+list-threads endpoints via CommEmailService,
    // but the callback route lives on the same controller — call it directly here.
    this.commEmailService
      .connectAccountCallback({
        provider: this.provider.value,
        code: this.code.value,
        redirectUri: this.redirectUri.value,
      })
      .subscribe({
        next: (mailboxId) => {
          const mailbox: KnownMailbox = {
            id: mailboxId,
            label: this.label.value || `${this.provider.value} mailbox`,
            provider: this.provider.value,
          };
          this.mailboxRegistry.add(mailbox);
          this.dialogRef.close(mailbox);
        },
        error: () => {
          this.submitting.set(false);
          this.error.set('That code was rejected — request a fresh authorization link and retry.');
        },
      });
  }
}
