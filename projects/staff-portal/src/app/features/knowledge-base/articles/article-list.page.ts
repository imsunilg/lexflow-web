import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router } from '@angular/router';
import { EmptyStateComponent, KbArticle, KbArticlesService, StatusChipComponent } from 'shared';
import { KbTabsComponent } from '../kb-tabs.component';

/** Article list (PRD Module 12): entry point into the contribution editor. */
@Component({
  selector: 'lf-article-list-page',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    EmptyStateComponent,
    StatusChipComponent,
    KbTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './article-list.page.html',
  styleUrl: './article-list.page.scss',
})
export class ArticleListPage {
  private readonly kbArticlesService = inject(KbArticlesService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly articles = signal<KbArticle[]>([]);

  constructor() {
    this.kbArticlesService.list().subscribe({
      next: (articles) => {
        this.articles.set(articles);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openArticle(article: KbArticle): void {
    this.router.navigate(['/knowledge-base/articles', article.id]);
  }

  createArticle(): void {
    this.router.navigate(['/knowledge-base/articles', 'new']);
  }
}
