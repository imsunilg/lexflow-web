import { Injectable, computed, signal } from '@angular/core';
import { LeadListFilter, SavedLeadView } from '../models/lead.models';

const STORAGE_KEY = 'lexflow.leads.savedViews';

function readFromStorage(): SavedLeadView[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedLeadView[]) : [];
  } catch {
    return [];
  }
}

/**
 * Per-browser "saved views" for the leads list (PRD Module 2: "list view
 * (server-side sort/filter/paginate, saved views)"). No saved-view endpoint
 * is documented anywhere in the PRD's `/leads*` API surface, so these persist
 * client-side only via `localStorage` — private to this browser, not synced
 * across devices. If a real `saved_views`-style endpoint ships later, this
 * service is the only place that needs to change.
 */
@Injectable({ providedIn: 'root' })
export class SavedLeadViewsService {
  private readonly viewsSignal = signal<SavedLeadView[]>(readFromStorage());
  readonly views = computed(() => this.viewsSignal());

  save(name: string, filter: LeadListFilter): SavedLeadView {
    const view: SavedLeadView = { id: crypto.randomUUID(), name, filter };
    this.viewsSignal.update((views) => {
      const updated = [...views, view];
      this.persist(updated);
      return updated;
    });
    return view;
  }

  remove(id: string): void {
    this.viewsSignal.update((views) => {
      const updated = views.filter((view) => view.id !== id);
      this.persist(updated);
      return updated;
    });
  }

  private persist(views: SavedLeadView[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
  }
}
