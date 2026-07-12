import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ChatChannel, ChatHubService, ChatMessage, ChatService, PermissionService } from 'shared';

/**
 * Collapsible chat dock (PRD Module 11 UI Components: "chat dock
 * (collapsible right rail, unread badges)"). There is no server-side
 * unread/last-read tracking at all (confirmed: `ChatMember` has no
 * `lastReadSeq` column, no `POST /chat/.../read` endpoint) — this component
 * tracks "last seen `seq` per channel" itself, in memory, reset on reload.
 * It joins every channel's SignalR group on load so `messageReceived`
 * pushes arrive even while collapsed, incrementing that channel's unread
 * count.
 */
@Component({
  selector: 'lf-chat-dock',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatBadgeModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat-dock.component.html',
  styleUrl: './chat-dock.component.scss',
})
export class ChatDockComponent {
  private readonly chatService = inject(ChatService);
  private readonly chatHub = inject(ChatHubService);
  private readonly permissionService = inject(PermissionService);

  readonly expanded = signal(false);
  readonly channels = signal<ChatChannel[]>([]);
  readonly activeChannelId = signal<string | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly newMessage = new FormControl('', { nonNullable: true });

  private readonly lastSeenSeq = new Map<string, number>();
  readonly unreadByChannel = signal<Record<string, number>>({});

  readonly totalUnread = computed(() =>
    Object.values(this.unreadByChannel()).reduce((sum, n) => sum + n, 0),
  );

  readonly activeChannel = computed(() =>
    this.channels().find((c) => c.id === this.activeChannelId()),
  );

  constructor() {
    this.chatService.listChannels().subscribe((channels) => {
      this.channels.set(channels);
      for (const channel of channels) {
        this.chatHub.joinChannel(channel.id);
      }
    });

    this.chatHub
      .onMessageReceived()
      .pipe(takeUntilDestroyed())
      .subscribe((message) => this.onIncomingMessage(message));
  }

  private onIncomingMessage(message: ChatMessage): void {
    if (message.channelId === this.activeChannelId() && this.expanded()) {
      this.messages.update((current) => [...current, message]);
      this.lastSeenSeq.set(message.channelId, message.seq);
      return;
    }

    const seen = this.lastSeenSeq.get(message.channelId) ?? 0;
    if (message.seq <= seen) return;
    this.unreadByChannel.update((current) => ({
      ...current,
      [message.channelId]: (current[message.channelId] ?? 0) + 1,
    }));
  }

  toggle(): void {
    this.expanded.update((v) => !v);
  }

  openChannel(channel: ChatChannel): void {
    this.activeChannelId.set(channel.id);
    this.unreadByChannel.update((current) => ({ ...current, [channel.id]: 0 }));

    this.chatService.listMessages(channel.id).subscribe((messages) => {
      this.messages.set(messages);
      const lastSeq = messages.at(-1)?.seq ?? 0;
      this.lastSeenSeq.set(channel.id, lastSeq);
    });
  }

  send(): void {
    const channel = this.activeChannel();
    const body = this.newMessage.value.trim();
    if (!channel || !body) return;

    this.chatService.postMessage(channel.id, body).subscribe((message) => {
      this.messages.update((current) => [...current, message]);
      this.lastSeenSeq.set(channel.id, message.seq);
      this.newMessage.setValue('');
    });
  }

  channelLabel(channel: ChatChannel): string {
    return channel.name ?? `${channel.kind} channel`;
  }

  isMine(message: ChatMessage): boolean {
    return message.senderId === this.permissionService.currentUser()?.id;
  }
}
