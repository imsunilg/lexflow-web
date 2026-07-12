import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import {
  CommEmailService,
  EmailMessage,
  EmailThread,
  EmptyStateComponent,
  Matter,
  MattersService,
} from 'shared';
import { CommTabsComponent } from '../comm-tabs.component';
import { ConnectMailboxDialogComponent } from './connect-mailbox-dialog.component';
import {
  EmailComposerDialogComponent,
  EmailComposerDialogData,
} from './email-composer-dialog.component';
import { MailboxRegistryService } from './mailbox-registry.service';

/**
 * Three-pane email inbox (PRD Module 11 UI Components: "Inbox (three-pane),
 * composer, thread view with matter-link banner"). Left: filters + known
 * mailboxes (see `MailboxRegistryService` — there is no mailbox-listing
 * endpoint). Middle: thread list. Right: selected thread's messages +
 * matter-link banner + reply.
 */
@Component({
  selector: 'lf-email-inbox-page',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSlideToggleModule,
    EmptyStateComponent,
    CommTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './email-inbox.page.html',
  styleUrl: './email-inbox.page.scss',
})
export class EmailInboxPage {
  private readonly commEmailService = inject(CommEmailService);
  private readonly mattersService = inject(MattersService);
  private readonly dialog = inject(MatDialog);
  readonly mailboxRegistry = inject(MailboxRegistryService);

  readonly triageOnly = new FormControl(false, { nonNullable: true });
  readonly matterControl = new FormControl('', { nonNullable: true });
  readonly matterResults = signal<Matter[]>([]);
  readonly activeMatterId = signal<string | null>(null);
  readonly activeMatterLabel = signal<string | null>(null);

  readonly threadsLoading = signal(true);
  readonly threads = signal<EmailThread[]>([]);

  readonly selectedThreadId = signal<string | null>(null);
  readonly messagesLoading = signal(false);
  readonly messages = signal<EmailMessage[]>([]);

  readonly selectedThread = computed(() =>
    this.threads().find((t) => t.id === this.selectedThreadId()),
  );

  constructor() {
    this.load();
    this.triageOnly.valueChanges.subscribe(() => this.load());

    this.matterControl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => {
        if (!q) {
          this.matterResults.set([]);
          return;
        }
        this.mattersService.list({ q }).subscribe((matters) => this.matterResults.set(matters));
      });
  }

  load(): void {
    this.threadsLoading.set(true);
    const request = this.triageOnly.value
      ? this.commEmailService.triageQueue()
      : this.commEmailService.listThreads(this.activeMatterId() ?? undefined);

    request.subscribe({
      next: (threads) => {
        this.threads.set(threads);
        this.threadsLoading.set(false);
        for (const thread of threads) {
          if (thread.mailboxId) this.mailboxRegistry.noteSeenMailboxId(thread.mailboxId);
        }
      },
      error: () => this.threadsLoading.set(false),
    });
  }

  onMatterSelected(event: MatAutocompleteSelectedEvent): void {
    const label = event.option.value as string;
    const matter = this.matterResults().find((m) => `${m.number} — ${m.title}` === label);
    if (!matter) return;
    this.activeMatterId.set(matter.id);
    this.activeMatterLabel.set(label);
    this.triageOnly.setValue(false, { emitEvent: false });
    this.load();
  }

  clearMatterFilter(): void {
    this.activeMatterId.set(null);
    this.activeMatterLabel.set(null);
    this.matterControl.setValue('');
    this.load();
  }

  selectThread(thread: EmailThread): void {
    this.selectedThreadId.set(thread.id);
    this.messagesLoading.set(true);
    this.commEmailService.listMessages(thread.id).subscribe({
      next: (messages) => {
        this.messages.set(messages);
        this.messagesLoading.set(false);
      },
      error: () => this.messagesLoading.set(false),
    });
  }

  openConnectMailbox(): void {
    this.dialog.open(ConnectMailboxDialogComponent);
  }

  openComposer(): void {
    this.dialog
      .open<EmailComposerDialogComponent, EmailComposerDialogData, EmailThread>(
        EmailComposerDialogComponent,
        { data: { mailboxes: this.mailboxRegistry.mailboxes() } },
      )
      .afterClosed()
      .subscribe((thread) => {
        if (thread) this.load();
      });
  }

  openReply(): void {
    const thread = this.selectedThread();
    const lastMessage = this.messages().at(-1);
    if (!thread || !lastMessage || !thread.mailboxId) return;

    this.dialog
      .open<EmailComposerDialogComponent, EmailComposerDialogData, EmailThread>(
        EmailComposerDialogComponent,
        {
          data: {
            mailboxes: this.mailboxRegistry.mailboxes(),
            replyTo: {
              mailboxId: thread.mailboxId,
              threadId: thread.id,
              toAddresses: lastMessage.fromAddr ? [lastMessage.fromAddr] : [],
              subject: thread.subject ? `Re: ${thread.subject}` : 'Re:',
              inReplyToMessageIdHdr: lastMessage.messageIdHdr,
              matterId: thread.matterId,
              clientId: thread.clientId,
            },
          },
        },
      )
      .afterClosed()
      .subscribe((updated) => {
        if (updated) this.selectThread(updated);
      });
  }

  linkToActiveMatter(): void {
    const thread = this.selectedThread();
    const matterId = this.activeMatterId();
    if (!thread || !matterId) return;
    this.commEmailService.linkThread(thread.id, { matterId }).subscribe((updated) => {
      this.threads.update((all) => all.map((t) => (t.id === updated.id ? updated : t)));
    });
  }
}
