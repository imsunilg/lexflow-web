import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { AiTabsComponent } from './ai-tabs.component';

/**
 * AI Studio hub (PRD Module 16). Card links into the 4 features this build
 * covers. The AI Legal Assistant itself isn't a routed page — it's the
 * global collapsible dock (`AiAssistantDockComponent`, mounted in the shell)
 * — this card just explains where to find it.
 */
@Component({
  selector: 'lf-ai-hub-page',
  standalone: true,
  imports: [MatIconModule, RouterLink, AiTabsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ai-hub">
      <lf-ai-tabs />
      <h1 i18n="@@ai.aiHub.title">AI Studio</h1>
      <p class="ai-hub__note" i18n="@@ai.aiHub.note">
        Every AI output here is labeled AI-generated and requires an explicit Save/Insert action —
        nothing an AI feature produces is applied automatically.
      </p>
      <div class="ai-hub__grid">
        <div class="ai-hub__card">
          <mat-icon>auto_awesome</mat-icon>
          <h2 i18n="@@ai.aiHub.assistantTitle">AI Assistant</h2>
          <p i18n="@@ai.aiHub.assistantDescription">
            Chat with the assistant from the floating dock in the bottom-right corner.
          </p>
        </div>
        <a class="ai-hub__card" [routerLink]="['/ai-studio/contract-review']">
          <mat-icon>gavel</mat-icon>
          <h2 i18n="@@ai.aiHub.contractReviewTitle">Contract Review</h2>
          <p i18n="@@ai.aiHub.contractReviewDescription">
            Clause extraction and risk flags for an existing document.
          </p>
        </a>
        <a class="ai-hub__card" [routerLink]="['/ai-studio/draft-studio']">
          <mat-icon>edit_note</mat-icon>
          <h2 i18n="@@ai.aiHub.draftStudioTitle">Draft Studio</h2>
          <p i18n="@@ai.aiHub.draftStudioDescription">
            Guided intake to generate a notice or agreement draft.
          </p>
        </a>
        <a class="ai-hub__card" [routerLink]="['/ai-studio/research']">
          <mat-icon>menu_book</mat-icon>
          <h2 i18n="@@ai.aiHub.researchTitle">Research</h2>
          <p i18n="@@ai.aiHub.researchDescription">
            Ask a question and get a cited answer from the firm's knowledge base.
          </p>
        </a>
      </div>
    </div>
  `,
  styles: `
    .ai-hub {
      padding: var(--lf-space-3);
    }

    .ai-hub__note {
      color: var(--lf-on-surface-variant);
      font-size: var(--lf-text-sm);
      max-width: 640px;
    }

    .ai-hub__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: var(--lf-space-2);
    }

    .ai-hub__card {
      display: block;
      padding: var(--lf-space-2);
      border: 1px solid var(--lf-surface-variant);
      border-radius: var(--lf-radius);
      text-decoration: none;
      color: inherit;

      h2 {
        font-size: var(--lf-text-md);
        margin: var(--lf-space-1) 0 4px;
      }

      p {
        margin: 0;
        font-size: var(--lf-text-sm);
        color: var(--lf-on-surface-variant);
      }
    }
  `,
})
export class AiHubPage {}
