import { Injectable, computed, signal } from '@angular/core';
import { MatterFilter, SavedMatterView } from '../models/matter.models';

const STORAGE_KEY = 'lexflow.matters.savedViews';

function readFromStorage(): SavedMatterView[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedMatterView[]) : [];
  } catch {
    return [];
  }
}

/** Per-browser saved views for the matter list (PRD Module 4 UI: "saved views") — same client-side-only design as `SavedLeadViewsService`, since no saved-view endpoint is documented for matters either. */
@Injectable({ providedIn: 'root' })
export class SavedMatterViewsService {
  private readonly viewsSignal = signal<SavedMatterView[]>(readFromStorage());
  readonly views = computed(() => this.viewsSignal());

  save(name: string, filter: MatterFilter): SavedMatterView {
    const view: SavedMatterView = { id: crypto.randomUUID(), name, filter };
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

  private persist(views: SavedMatterView[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
  }
}
