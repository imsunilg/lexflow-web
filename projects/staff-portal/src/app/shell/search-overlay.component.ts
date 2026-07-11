import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { SearchResultGroup, SearchService } from 'shared';
import { catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';

const RECENT_SEARCHES_KEY = 'lexflow.recentSearches';
const MAX_RECENT_SEARCHES = 5;

/**
 * ⌘K global search overlay (PRD §26). Opened via `MatDialog` from the shell so
 * focus-trapping, Escape-to-close, and backdrop click all come for free. Calls
 * `GET /search?q=` through `SearchService` — that endpoint doesn't exist server-side
 * yet (see SearchService's doc comment), so a 404 is treated the same as a
 * zero-results response rather than surfaced as an error, keeping the overlay fully
 * usable/demoable ahead of the backend shipping.
 */
@Component({
  selector: 'lf-staff-search-overlay',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatIconModule,
    MatListModule,
    MatProgressSpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="search-overlay">
      <div class="search-overlay__input">
        <mat-icon>search</mat-icon>
        <input
          #searchInput
          type="text"
          [formControl]="queryControl"
          placeholder="Search leads, clients, matters, documents…"
          aria-label="Global search"
        />
        @if (loading()) {
          <mat-spinner diameter="18" />
        }
      </div>

      @if (queryControl.value.length === 0 && recentSearches().length > 0) {
        <div class="search-overlay__section-label">Recent searches</div>
        <mat-nav-list>
          @for (recent of recentSearches(); track recent) {
            <button mat-list-item type="button" (click)="queryControl.setValue(recent)">
              {{ recent }}
            </button>
          }
        </mat-nav-list>
      }

      @if (queryControl.value.length > 0) {
        @if (!loading() && groups().length === 0) {
          <p class="search-overlay__empty">No results for "{{ queryControl.value }}".</p>
        }
        @for (group of groups(); track group.type) {
          <div class="search-overlay__section-label">{{ group.label }}</div>
          <mat-nav-list>
            @for (item of group.items; track item.id) {
              <button mat-list-item type="button" (click)="openResult(item.url)">
                <span matListItemTitle>{{ item.title }}</span>
                @if (item.subtitle) {
                  <span matListItemLine>{{ item.subtitle }}</span>
                }
              </button>
            }
          </mat-nav-list>
        }
      }
    </div>
  `,
  styles: `
    .search-overlay {
      width: min(560px, 90vw);
      max-height: 70vh;
      overflow-y: auto;
    }

    .search-overlay__input {
      display: flex;
      align-items: center;
      gap: var(--lf-space-1);
      padding: var(--lf-space-2);
      border-bottom: 1px solid var(--lf-outline);
    }

    .search-overlay__input input {
      flex: 1;
      border: none;
      outline: none;
      font-size: var(--lf-text-md);
      background: transparent;
      color: var(--lf-on-surface);
    }

    .search-overlay__section-label {
      padding: var(--lf-space-1) var(--lf-space-2) 0;
      font-size: var(--lf-text-xs);
      color: var(--lf-on-surface-variant);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .search-overlay__empty {
      padding: var(--lf-space-3);
      text-align: center;
      color: var(--lf-on-surface-variant);
    }
  `,
})
export class SearchOverlayComponent {
  private readonly searchService = inject(SearchService);
  private readonly router = inject(Router);
  private readonly dialogRef = inject(MatDialogRef<SearchOverlayComponent>);
  private readonly destroyRef = inject(DestroyRef);

  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  readonly queryControl = new FormControl('', { nonNullable: true });
  readonly groups = signal<SearchResultGroup[]>([]);
  readonly loading = signal(false);
  readonly recentSearches = signal(this.readRecentSearches());

  constructor() {
    this.queryControl.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((query) => {
          const trimmed = query.trim();
          if (trimmed.length === 0) {
            this.groups.set([]);
            return of<SearchResultGroup[]>([]);
          }

          this.loading.set(true);
          return this.searchService
            .search(trimmed)
            .pipe(catchError(() => of<SearchResultGroup[]>([])));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((groups) => {
        this.loading.set(false);
        this.groups.set(groups);
      });

    setTimeout(() => this.searchInput()?.nativeElement.focus());
  }

  openResult(url: string): void {
    this.rememberSearch(this.queryControl.value.trim());
    this.dialogRef.close();
    this.router.navigateByUrl(url);
  }

  private rememberSearch(query: string): void {
    if (!query) {
      return;
    }
    const updated = [query, ...this.recentSearches().filter((q) => q !== query)].slice(
      0,
      MAX_RECENT_SEARCHES,
    );
    this.recentSearches.set(updated);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  }

  private readRecentSearches(): string[] {
    try {
      const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }
}
