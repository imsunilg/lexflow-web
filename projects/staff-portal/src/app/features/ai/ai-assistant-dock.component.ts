import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router } from '@angular/router';
import { AiBadgeComponent, AiChatTurn, AiCitation, AiContextService, AiService } from 'shared';
import { AiCitationLinkComponent } from './ai-citation-link.component';

interface DockMessage {
  role: 'user' | 'assistant';
  content: string;
  citations?: AiCitation[];
  interactionId?: string;
  noAuthorityFound?: boolean;
}

/**
 * Collapsible AI assistant dock (PRD Module 16 feature 1: "side-panel chat,
 * context-aware of current record; commands: /summarize, /draft, /research,
 * /timeline"). Mirrors `ChatDockComponent`'s collapsible-right-rail pattern.
 *
 * Chat is a single request/response (no SSE — see `ai.models.ts`). Slash
 * commands are a frontend-only convention (the backend never parses them):
 * `/research <question>` calls the real research endpoint; `/draft`
 * navigates to the Draft Studio (prefilling matter context if set);
 * `/summarize` and `/timeline` have no backing feature in this build's scope
 * (Document/Case Summary) and fall through as plain chat text, which is what
 * the backend would do with them anyway since it doesn't special-case
 * commands either.
 */
@Component({
  selector: 'lf-ai-assistant-dock',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    AiBadgeComponent,
    AiCitationLinkComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ai-assistant-dock.component.html',
  styleUrl: './ai-assistant-dock.component.scss',
})
export class AiAssistantDockComponent {
  private readonly aiService = inject(AiService);
  private readonly aiContext = inject(AiContextService);
  private readonly router = inject(Router);

  readonly expanded = signal(false);
  readonly messages = signal<DockMessage[]>([]);
  readonly sending = signal(false);
  readonly newMessage = new FormControl('', { nonNullable: true });

  private history: AiChatTurn[] = [];

  readonly hasContext = this.aiContext.matterId;

  toggle(): void {
    this.expanded.update((v) => !v);
  }

  send(): void {
    const raw = this.newMessage.value.trim();
    if (!raw || this.sending()) return;
    this.newMessage.setValue('');

    if (raw.startsWith('/draft')) {
      const matterId = this.aiContext.matterId();
      this.router.navigate(['/ai-studio/draft-studio'], {
        queryParams: matterId ? { matterId } : {},
      });
      return;
    }

    if (raw.startsWith('/research')) {
      const question = raw.replace('/research', '').trim();
      if (!question) return;
      this.messages.update((rows) => [...rows, { role: 'user', content: raw }]);
      this.sending.set(true);
      this.aiService.research({ question, webGroundedMode: false }).subscribe({
        next: (result) => {
          this.sending.set(false);
          this.messages.update((rows) => [
            ...rows,
            {
              role: 'assistant',
              content: result.answer,
              citations: result.citations,
              interactionId: result.interactionId,
              noAuthorityFound: result.noAuthorityFound,
            },
          ]);
        },
        error: () => this.sending.set(false),
      });
      return;
    }

    this.messages.update((rows) => [...rows, { role: 'user', content: raw }]);
    this.sending.set(true);
    this.aiService
      .chat({
        message: raw,
        matterId: this.aiContext.matterId(),
        documentId: this.aiContext.documentId(),
        history: this.history,
      })
      .subscribe({
        next: (result) => {
          this.sending.set(false);
          this.history = [
            ...this.history,
            { role: 'user', content: raw },
            { role: 'assistant', content: result.text },
          ];
          this.messages.update((rows) => [
            ...rows,
            {
              role: 'assistant',
              content: result.text,
              citations: result.citations,
              interactionId: result.interactionId,
            },
          ]);
        },
        error: () => this.sending.set(false),
      });
  }
}
