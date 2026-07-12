import { Injectable, signal } from '@angular/core';

/**
 * Tracks "the record currently being viewed" so the global AI assistant dock
 * can be context-aware (PRD Module 16: "side-panel chat, context-aware of
 * current record"). Pages that represent a single matter/document opt in by
 * calling `setMatter`/`setDocument` in their constructor and `clear()` on
 * destroy (via `DestroyRef.onDestroy`) — wiring every page in the app to
 * announce itself is out of scope for this build; only the Matter workspace
 * does so today, since it's the PRD's own example ("why can Aditi see this
 * matter"). Everywhere else, the assistant has no record context, matching
 * `AiChatRequest.matterId`/`documentId` both being optional server-side.
 */
@Injectable({ providedIn: 'root' })
export class AiContextService {
  private readonly matterIdSignal = signal<string | null>(null);
  private readonly documentIdSignal = signal<string | null>(null);

  readonly matterId = this.matterIdSignal.asReadonly();
  readonly documentId = this.documentIdSignal.asReadonly();

  setMatter(matterId: string): void {
    this.matterIdSignal.set(matterId);
    this.documentIdSignal.set(null);
  }

  setDocument(documentId: string, matterId?: string | null): void {
    this.documentIdSignal.set(documentId);
    this.matterIdSignal.set(matterId ?? null);
  }

  clear(): void {
    this.matterIdSignal.set(null);
    this.documentIdSignal.set(null);
  }
}
