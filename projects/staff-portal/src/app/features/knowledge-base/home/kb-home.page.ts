import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  EmptyStateComponent,
  KbActsService,
  KbArticlesService,
  KbBookmark,
  KbJudgmentsService,
  KbSearchHit,
  KbSearchResult,
  KbSearchService,
  KbTaxonomyService,
} from 'shared';
import { KbTabsComponent } from '../kb-tabs.component';

interface BookmarkRow {
  bookmark: KbBookmark;
  label: string;
}

const KIND_ICONS: Record<string, string> = {
  Act: 'gavel',
  ActSection: 'menu_book',
  Judgment: 'balance',
  Article: 'article',
};

/**
 * KB home (PRD Module 12 UI Components: "KB home (search-first, recent,
 * popular, my bookmarks)"). There is no usage-tracking anywhere server-side —
 * "recent"/"popular" have no backing endpoint at all, so this page only
 * builds the two features that are real: search (genuinely ES-backed, with
 * direct section/citation shortcuts) and "my bookmarks" (`GET /kb/bookmarks`,
 * per-user).
 */
@Component({
  selector: 'lf-kb-home-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    EmptyStateComponent,
    KbTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './kb-home.page.html',
  styleUrl: './kb-home.page.scss',
})
export class KbHomePage {
  private readonly kbSearchService = inject(KbSearchService);
  private readonly kbActsService = inject(KbActsService);
  private readonly kbJudgmentsService = inject(KbJudgmentsService);
  private readonly kbArticlesService = inject(KbArticlesService);
  private readonly kbTaxonomyService = inject(KbTaxonomyService);
  private readonly router = inject(Router);

  readonly query = new FormControl('', { nonNullable: true });
  readonly searching = signal(false);
  readonly result = signal<KbSearchResult | null>(null);

  readonly bookmarksLoading = signal(true);
  readonly bookmarks = signal<BookmarkRow[]>([]);

  constructor() {
    this.loadBookmarks();
    this.query.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => this.runSearch(q));
  }

  private runSearch(q: string): void {
    if (!q.trim()) {
      this.result.set(null);
      return;
    }
    this.searching.set(true);
    this.kbSearchService.search({ q }).subscribe({
      next: (result) => {
        this.result.set(result);
        this.searching.set(false);
      },
      error: () => this.searching.set(false),
    });
  }

  private loadBookmarks(): void {
    this.bookmarksLoading.set(true);
    this.kbTaxonomyService.listBookmarks().subscribe({
      next: (bookmarks: KbBookmark[]) => {
        if (bookmarks.length === 0) {
          this.bookmarks.set([]);
          this.bookmarksLoading.set(false);
          return;
        }
        forkJoin(bookmarks.map((b) => this.resolveLabel(b))).subscribe((rows) => {
          this.bookmarks.set(rows);
          this.bookmarksLoading.set(false);
        });
      },
      error: () => this.bookmarksLoading.set(false),
    });
  }

  private resolveLabel(bookmark: KbBookmark) {
    const fallback = `${bookmark.kbRefKind} ${bookmark.kbRefId.slice(0, 8)}`;
    let source;
    switch (bookmark.kbRefKind) {
      case 'Act':
        source = this.kbActsService.getAct(bookmark.kbRefId).pipe(map((a) => a?.name ?? fallback));
        break;
      case 'ActSection':
        source = this.kbActsService
          .getSection(bookmark.kbRefId)
          .pipe(map((s) => `${s.number}. ${s.title ?? ''}`.trim()));
        break;
      case 'Judgment':
        source = this.kbJudgmentsService
          .get(bookmark.kbRefId)
          .pipe(map((j) => j.citation ?? fallback));
        break;
      default:
        source = this.kbArticlesService.get(bookmark.kbRefId).pipe(map((a) => a.title ?? fallback));
    }
    return source.pipe(
      map((label) => ({ bookmark, label })),
      catchError(() => of({ bookmark, label: fallback })),
    );
  }

  iconFor(kind: string): string {
    return KIND_ICONS[kind] ?? 'description';
  }

  openHit(hit: KbSearchHit): void {
    this.navigateTo(hit.kind, hit.id);
  }

  openBookmark(row: BookmarkRow): void {
    this.navigateTo(row.bookmark.kbRefKind, row.bookmark.kbRefId);
  }

  private navigateTo(kind: string, id: string): void {
    switch (kind) {
      case 'Act':
        this.router.navigate(['/knowledge-base/acts', id]);
        return;
      case 'ActSection':
        this.kbActsService.getSection(id).subscribe((section) => {
          this.router.navigate(['/knowledge-base/acts', section.actId], {
            queryParams: { sectionId: section.id },
          });
        });
        return;
      case 'Judgment':
        this.router.navigate(['/knowledge-base/judgments', id]);
        return;
      default:
        this.router.navigate(['/knowledge-base/articles', id]);
    }
  }
}
