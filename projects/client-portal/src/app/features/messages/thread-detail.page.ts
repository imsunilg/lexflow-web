import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';
import { API_BASE_URL, EmptyStateComponent, OfflineMutationQueueService } from 'shared';
import { PORTAL_MESSAGE_MAX_LENGTH, PortalMessage } from '../../core/models/portal.models';
import { PortalMessagesService } from '../../core/services/portal-messages.service';

/** Thread detail — a response-time-expectation banner is shown since the backend has no read-receipt/SLA data to render one dynamically (PRD step 7's "response-time expectation banner" is a static firm-policy note, not computed). No attachment support server-side, so this composer is text-only. */
@Component({
  selector: 'lf-portal-thread-detail-page',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatProgressBarModule,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './thread-detail.page.html',
  styleUrl: './thread-detail.page.scss',
})
export class ThreadDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly messagesService = inject(PortalMessagesService);
  private readonly offlineQueue = inject(OfflineMutationQueueService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly apiBaseUrl = inject(API_BASE_URL, { optional: true }) ?? '/api/portal/v1';

  readonly threadId = this.route.snapshot.paramMap.get('threadId')!;
  readonly loading = signal(true);
  readonly messages = signal<PortalMessage[]>([]);
  readonly sending = signal(false);

  readonly body = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(PORTAL_MESSAGE_MAX_LENGTH)],
  });

  constructor() {
    this.messagesService.listMessages(this.threadId).subscribe((messages) => {
      this.messages.set(messages);
      this.loading.set(false);
    });
  }

  send(): void {
    if (this.body.invalid || !this.body.value.trim()) {
      this.body.markAsTouched();
      return;
    }

    const body = this.body.value;
    this.sending.set(true);
    this.messagesService.postMessage(this.threadId, { body }).subscribe({
      next: (message) => {
        this.sending.set(false);
        this.messages.update((messages) => [...messages, message]);
        this.body.reset('');
      },
      error: () => {
        this.sending.set(false);
        this.queueMessageOffline(body);
      },
    });
  }

  /** PRD §12 "background sync of queued ... mutations": a message that fails to send while offline is queued instead of lost — it replays on reconnect or via the shell's offline-banner "Retry". */
  private queueMessageOffline(body: string): void {
    if (navigator.onLine) return;

    this.offlineQueue
      .enqueue({
        method: 'POST',
        url: `${this.apiBaseUrl}/threads/${this.threadId}/messages`,
        body: { body },
        label: 'Message',
      })
      .then(() => {
        this.body.reset('');
        this.snackBar.open('Offline — this message will send automatically.', 'Dismiss', {
          duration: 4000,
        });
      });
  }
}
