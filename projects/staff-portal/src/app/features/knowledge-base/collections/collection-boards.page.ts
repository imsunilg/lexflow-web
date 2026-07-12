import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  EmptyStateComponent,
  KbActsService,
  KbArticlesService,
  KbCollection,
  KbCollectionItem,
  KbJudgmentsService,
  KbRefKind,
  KbSearchHit,
  KbSearchService,
  KbTaxonomyService,
} from 'shared';
import { KbTabsComponent } from '../kb-tabs.component';

interface ItemRow {
  item: KbCollectionItem;
  label: string;
}

const KIND_ICONS: Record<string, string> = {
  Act: 'gavel',
  ActSection: 'menu_book',
  Judgment: 'balance',
  Article: 'article',
};

/**
 * Collections boards (PRD Module 12 UI Components: "collections as
 * Kanban-lite boards"). `GET/POST /kb/collections` and
 * `GET/POST /kb/collections/{id}/items` are the only real endpoints — there
 * is no delete/remove-item endpoint (confirmed by reading
 * `kb-taxonomy.service.ts`: only `listCollections`, `createCollection`,
 * `listCollectionItems`, `addCollectionItem` exist), so this page does not
 * offer a way to remove an item once added. Item titles aren't resolvable
 * from the collection-item row alone (it only carries `kbRefKind`/`kbRefId`),
 * so each item's label is fetched per-kind the same way `kb-home.page.ts`
 * resolves bookmark labels.
 */
@Component({
  selector: 'lf-collection-boards-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    EmptyStateComponent,
    KbTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './collection-boards.page.html',
  styleUrl: './collection-boards.page.scss',
})
export class CollectionBoardsPage {
  private readonly kbTaxonomyService = inject(KbTaxonomyService);
  private readonly kbSearchService = inject(KbSearchService);
  private readonly kbActsService = inject(KbActsService);
  private readonly kbJudgmentsService = inject(KbJudgmentsService);
  private readonly kbArticlesService = inject(KbArticlesService);
  private readonly router = inject(Router);

  readonly collectionsLoading = signal(true);
  readonly collections = signal<KbCollection[]>([]);
  readonly selectedId = signal<string | null>(null);

  readonly showNewForm = signal(false);
  readonly newName = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly newDescription = new FormControl('', { nonNullable: true });
  readonly creating = signal(false);

  readonly itemsLoading = signal(false);
  readonly items = signal<ItemRow[]>([]);

  readonly showAddSearch = signal(false);
  readonly addQuery = new FormControl('', { nonNullable: true });
  readonly addSearching = signal(false);
  readonly addHits = signal<KbSearchHit[]>([]);
  readonly adding = signal(false);

  constructor() {
    this.loadCollections();
    this.addQuery.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => this.runAddSearch(q));
  }

  private loadCollections(): void {
    this.collectionsLoading.set(true);
    this.kbTaxonomyService.listCollections().subscribe({
      next: (collections) => {
        this.collections.set(collections);
        this.collectionsLoading.set(false);
        if (collections.length > 0 && !this.selectedId()) {
          this.selectCollection(collections[0].id);
        }
      },
      error: () => this.collectionsLoading.set(false),
    });
  }

  selectCollection(id: string): void {
    this.selectedId.set(id);
    this.showAddSearch.set(false);
    this.addQuery.setValue('');
    this.addHits.set([]);
    this.loadItems(id);
  }

  private loadItems(collectionId: string): void {
    this.itemsLoading.set(true);
    this.items.set([]);
    this.kbTaxonomyService.listCollectionItems(collectionId).subscribe({
      next: (items) => {
        if (items.length === 0) {
          this.items.set([]);
          this.itemsLoading.set(false);
          return;
        }
        forkJoin(items.map((item) => this.resolveLabel(item))).subscribe((rows) => {
          this.items.set(rows);
          this.itemsLoading.set(false);
        });
      },
      error: () => this.itemsLoading.set(false),
    });
  }

  private resolveLabel(item: KbCollectionItem) {
    const fallback = `${item.kbRefKind} ${item.kbRefId.slice(0, 8)}`;
    let source;
    switch (item.kbRefKind) {
      case 'Act':
        source = this.kbActsService.getAct(item.kbRefId).pipe(map((a) => a?.name ?? fallback));
        break;
      case 'ActSection':
        source = this.kbActsService
          .getSection(item.kbRefId)
          .pipe(map((s) => `${s.number}. ${s.title ?? ''}`.trim()));
        break;
      case 'Judgment':
        source = this.kbJudgmentsService.get(item.kbRefId).pipe(map((j) => j.citation ?? fallback));
        break;
      default:
        source = this.kbArticlesService.get(item.kbRefId).pipe(map((a) => a.title ?? fallback));
    }
    return source.pipe(
      map((label) => ({ item, label })),
      catchError(() => of({ item, label: fallback })),
    );
  }

  iconFor(kind: string): string {
    return KIND_ICONS[kind] ?? 'description';
  }

  openItem(row: ItemRow): void {
    this.navigateTo(row.item.kbRefKind, row.item.kbRefId);
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

  toggleNewForm(): void {
    this.showNewForm.update((v) => !v);
    this.newName.reset('');
    this.newDescription.reset('');
  }

  createCollection(): void {
    if (this.newName.invalid) {
      this.newName.markAsTouched();
      return;
    }
    this.creating.set(true);
    this.kbTaxonomyService
      .createCollection({
        name: this.newName.value,
        description: this.newDescription.value || null,
      })
      .subscribe({
        next: (collection) => {
          this.collections.update((cs) => [...cs, collection]);
          this.creating.set(false);
          this.showNewForm.set(false);
          this.selectCollection(collection.id);
        },
        error: () => this.creating.set(false),
      });
  }

  toggleAddSearch(): void {
    this.showAddSearch.update((v) => !v);
    this.addQuery.setValue('');
    this.addHits.set([]);
  }

  private runAddSearch(q: string): void {
    if (!q.trim()) {
      this.addHits.set([]);
      return;
    }
    this.addSearching.set(true);
    this.kbSearchService.search({ q }).subscribe({
      next: (result) => {
        this.addHits.set(result.hits);
        this.addSearching.set(false);
      },
      error: () => this.addSearching.set(false),
    });
  }

  addHit(hit: KbSearchHit): void {
    const collectionId = this.selectedId();
    if (!collectionId) return;

    this.adding.set(true);
    this.kbTaxonomyService
      .addCollectionItem(collectionId, {
        kbRefKind: hit.kind as KbRefKind,
        kbRefId: hit.id,
      })
      .subscribe({
        next: (item) => {
          this.items.update((rows) => [...rows, { item, label: hit.title }]);
          this.adding.set(false);
          this.showAddSearch.set(false);
          this.addQuery.setValue('');
          this.addHits.set([]);
        },
        error: () => this.adding.set(false),
      });
  }
}
