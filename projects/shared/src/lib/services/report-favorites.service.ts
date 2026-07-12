import { Injectable, computed, signal } from '@angular/core';

const STORAGE_KEY = 'lexflow.reports.favoriteKeys';

function readFromStorage(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * Reports hub favorites (PRD Module 13 UI Components: "reports hub (catalog
 * cards, favorites, recent)"). No favorites/recent endpoint exists anywhere
 * in `ReportsController` — favoriting a standard report key persists
 * client-side only via `localStorage`, mirroring `SavedLeadViewsService`'s
 * same documented-gap pattern. "Recent" isn't tracked server-side either and
 * is out of scope for the same reason (no run-history-per-user endpoint).
 */
@Injectable({ providedIn: 'root' })
export class ReportFavoritesService {
  private readonly keysSignal = signal<Set<string>>(new Set(readFromStorage()));
  readonly keys = computed(() => this.keysSignal());

  isFavorite(reportKey: string): boolean {
    return this.keysSignal().has(reportKey);
  }

  toggle(reportKey: string): void {
    this.keysSignal.update((keys) => {
      const updated = new Set(keys);
      if (updated.has(reportKey)) {
        updated.delete(reportKey);
      } else {
        updated.add(reportKey);
      }
      this.persist(updated);
      return updated;
    });
  }

  private persist(keys: Set<string>): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...keys]));
  }
}
