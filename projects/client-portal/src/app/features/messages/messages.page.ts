import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent } from 'shared';
import { PortalMessageThread } from '../../core/models/portal.models';
import { PortalMessagesService } from '../../core/services/portal-messages.service';

/** Message threads (PRD Module 17 step 7) — secure, matter-scoped, not email. */
@Component({
  selector: 'lf-portal-messages-page',
  standalone: true,
  imports: [DatePipe, RouterLink, MatProgressBarModule, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './messages.page.html',
  styleUrl: './messages.page.scss',
})
export class MessagesPage {
  private readonly messagesService = inject(PortalMessagesService);

  readonly loading = signal(true);
  readonly threads = signal<PortalMessageThread[]>([]);

  constructor() {
    this.messagesService.listThreads().subscribe((threads) => {
      this.threads.set(threads);
      this.loading.set(false);
    });
  }
}
