import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, of } from 'rxjs';
import {
  KbArticle,
  KbArticleVersion,
  KbArticlesService,
  KbTaxonomyService,
  PermissionService,
  UserSummary,
  UsersService,
} from 'shared';
import { KbTabsComponent } from '../kb-tabs.component';

/**
 * Contribution editor (PRD Module 12 UI Components: "contribution editor
 * with review workflow states"). Draft → InReview → Published, enforced
 * server-side (reviewer ≠ author has a DB trigger backstop; ≥1 tag to
 * publish is app-layer only — see `kb-articles.service.ts`'s doc comment).
 *
 * There is no endpoint to list a KB item's already-attached tags (the
 * service method exists server-side but is unwired from any controller) —
 * this editor can only track tags attached *during the current session*,
 * shown with an explicit note; it cannot show tags attached previously.
 */
@Component({
  selector: 'lf-article-editor-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    KbTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './article-editor.page.html',
  styleUrl: './article-editor.page.scss',
})
export class ArticleEditorPage {
  private readonly kbArticlesService = inject(KbArticlesService);
  private readonly kbTaxonomyService = inject(KbTaxonomyService);
  private readonly usersService = inject(UsersService);
  private readonly permissionService = inject(PermissionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly isNew: boolean;
  readonly loading = signal(true);
  readonly article = signal<KbArticle | null>(null);
  readonly versions = signal<KbArticleVersion[]>([]);
  readonly saving = signal(false);
  readonly workflowError = signal<string | null>(null);

  readonly title = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(1)],
  });
  readonly body = new FormControl('', { nonNullable: true });

  /** Session-only — see class doc comment for why this can't reflect tags attached in a prior session. */
  readonly sessionTags = signal<string[]>([]);
  readonly newTagName = new FormControl('', { nonNullable: true });

  readonly reviewerControl = new FormControl('', { nonNullable: true });
  readonly reviewerResults = signal<UserSummary[]>([]);
  private selectedReviewerId: string | null = null;
  readonly userLookupUnavailable = signal(false);

  readonly canContribute = this.permissionService.has('kb.contribute.all');
  readonly canReview = this.permissionService.has('kb.review.all');

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    this.isNew = !id || id === 'new';

    if (this.isNew) {
      this.loading.set(false);
    } else {
      this.kbArticlesService.get(id!).subscribe((article) => {
        this.article.set(article);
        this.title.setValue(article.title);
        this.body.setValue(article.body ?? '');
        this.loading.set(false);
        this.kbArticlesService
          .versions(article.id)
          .subscribe((versions) => this.versions.set(versions));
      });
    }

    this.reviewerControl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => {
        this.selectedReviewerId = null;
        if (!q || this.userLookupUnavailable()) {
          this.reviewerResults.set([]);
          return;
        }
        this.usersService
          .list()
          .pipe(catchError(() => of<UserSummary[]>([])))
          .subscribe((users) => {
            if (users.length === 0) {
              this.userLookupUnavailable.set(true);
              return;
            }
            this.reviewerResults.set(
              users.filter((u) => u.name.toLowerCase().includes(q.toLowerCase())),
            );
          });
      });
  }

  onReviewerSelected(event: MatAutocompleteSelectedEvent): void {
    const label = event.option.value as string;
    const user = this.reviewerResults().find((u) => u.name === label);
    this.selectedReviewerId = user?.id ?? null;
  }

  save(): void {
    if (this.title.invalid) {
      this.title.markAsTouched();
      return;
    }

    this.saving.set(true);
    const request = { title: this.title.value, body: this.body.value || null };
    const save$ = this.article()
      ? this.kbArticlesService.update(this.article()!.id, request)
      : this.kbArticlesService.create(request);

    save$.subscribe({
      next: (article) => {
        this.saving.set(false);
        this.article.set(article);
        if (this.isNew) {
          this.router.navigate(['/knowledge-base/articles', article.id], { replaceUrl: true });
        }
      },
      error: () => this.saving.set(false),
    });
  }

  addTag(): void {
    const article = this.article();
    const name = this.newTagName.value.trim();
    if (!article || !name) return;

    this.kbTaxonomyService
      .attachTag({ kbRefKind: 'Article', kbRefId: article.id, tagName: name })
      .subscribe(() => {
        this.sessionTags.update((tags) => [...new Set([...tags, name])]);
        this.newTagName.setValue('');
      });
  }

  removeTag(name: string): void {
    const article = this.article();
    if (!article) return;
    this.kbTaxonomyService
      .detachTag({ kbRefKind: 'Article', kbRefId: article.id, tagName: name })
      .subscribe(() => {
        this.sessionTags.update((tags) => tags.filter((t) => t !== name));
      });
  }

  submit(): void {
    const article = this.article();
    if (!article) return;
    this.workflowError.set(null);
    this.kbArticlesService.submit(article.id).subscribe({
      next: (updated) => this.article.set(updated),
      error: () => this.workflowError.set('Could not submit for review.'),
    });
  }

  approve(): void {
    const article = this.article();
    if (!article || !this.selectedReviewerId) return;
    if (this.selectedReviewerId === article.authorId) {
      this.workflowError.set('The reviewer cannot be the article author.');
      return;
    }

    this.workflowError.set(null);
    this.kbArticlesService.approve(article.id, { reviewerId: this.selectedReviewerId }).subscribe({
      next: (updated) => this.article.set(updated),
      error: (err) => {
        this.workflowError.set(
          err?.error?.error?.message ?? 'Could not approve and publish this article.',
        );
      },
    });
  }

  sendBack(): void {
    const article = this.article();
    if (!article) return;
    this.workflowError.set(null);
    this.kbArticlesService.sendBack(article.id).subscribe({
      next: (updated) => this.article.set(updated),
      error: () => this.workflowError.set('Could not send this article back to Draft.'),
    });
  }
}
