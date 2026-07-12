import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  AiCitation,
  DocumentsService,
  KbActsService,
  KbArticlesService,
  KbJudgmentsService,
} from 'shared';

/**
 * Resolves an `AiCitation{kind, id}` into a human label and, where a real
 * route exists, a clickable link (PRD Module 16: "can cite firm documents
 * (with links) via RAG" / research's "pin-able citations"). `label` is
 * always `null` from the API — every label here is resolved client-side per
 * kind, mirroring the exact resolution pattern `kb-home.page.ts` already
 * uses for bookmarks.
 *
 * "Document" citations are deliberately NOT rendered as a raw `<a href>` to
 * `DocumentsService.previewUrl()` — that URL requires the JWT auth
 * interceptor, which a plain anchor navigation bypasses (the same bug
 * self-caught in the Module 12 Judgment reader). Since staff-portal has no
 * single document-detail route to navigate to either, Document citations
 * resolve to a title-only label with no click action.
 */
@Component({
  selector: 'lf-ai-citation-link',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (navigable()) {
      <button type="button" class="ai-citation-link" (click)="open()">{{ label() }}</button>
    } @else {
      <span class="ai-citation-link ai-citation-link--static">{{ label() }}</span>
    }
  `,
  styles: `
    .ai-citation-link {
      display: inline;
      border: none;
      background: transparent;
      padding: 0;
      font: inherit;
      color: var(--lf-primary);
      cursor: pointer;
      text-decoration: underline;
    }

    .ai-citation-link--static {
      color: var(--lf-on-surface-variant);
      cursor: default;
      text-decoration: none;
    }
  `,
})
export class AiCitationLinkComponent {
  private readonly router = inject(Router);
  private readonly kbActsService = inject(KbActsService);
  private readonly kbJudgmentsService = inject(KbJudgmentsService);
  private readonly kbArticlesService = inject(KbArticlesService);
  private readonly documentsService = inject(DocumentsService);

  readonly citation = input.required<AiCitation>();

  readonly label = signal('Loading…');
  readonly navigable = signal(false);

  constructor() {
    this.resolve();
  }

  private resolve(): void {
    const { kind, id } = this.citation();
    switch (kind) {
      case 'KbActSection':
        this.kbActsService.getSection(id).subscribe({
          next: (section) => {
            this.label.set(`${section.number}. ${section.title ?? ''}`.trim());
            this.navigable.set(true);
          },
          error: () => this.label.set(`Act section ${id.slice(0, 8)}`),
        });
        return;
      case 'KbJudgment':
        this.kbJudgmentsService.get(id).subscribe({
          next: (judgment) => {
            this.label.set(judgment.citation ?? `Judgment ${id.slice(0, 8)}`);
            this.navigable.set(true);
          },
          error: () => this.label.set(`Judgment ${id.slice(0, 8)}`),
        });
        return;
      case 'KbArticle':
        this.kbArticlesService.get(id).subscribe({
          next: (article) => {
            this.label.set(article.title ?? `Article ${id.slice(0, 8)}`);
            this.navigable.set(true);
          },
          error: () => this.label.set(`Article ${id.slice(0, 8)}`),
        });
        return;
      case 'Matter':
        this.label.set(`Matter ${id.slice(0, 8)}`);
        this.navigable.set(true);
        return;
      case 'Document':
        this.documentsService.get(id).subscribe({
          next: (doc) => this.label.set(doc.title ?? `Document ${id.slice(0, 8)}`),
          error: () => this.label.set(`Document ${id.slice(0, 8)}`),
        });
        return;
      default:
        this.label.set(`${kind} ${id.slice(0, 8)}`);
    }
  }

  open(): void {
    const { kind, id } = this.citation();
    switch (kind) {
      case 'KbActSection':
        this.kbActsService.getSection(id).subscribe((section) => {
          this.router.navigate(['/knowledge-base/acts', section.actId], {
            queryParams: { sectionId: section.id },
          });
        });
        return;
      case 'KbJudgment':
        this.router.navigate(['/knowledge-base/judgments', id]);
        return;
      case 'KbArticle':
        this.router.navigate(['/knowledge-base/articles', id]);
        return;
      case 'Matter':
        this.router.navigate(['/matters', id]);
        return;
    }
  }
}
