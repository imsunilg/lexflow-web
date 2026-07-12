import { Injectable, signal } from '@angular/core';

export interface KnownMailbox {
  id: string;
  label: string;
  provider: string;
}

const STORAGE_KEY = 'lexflow.knownMailboxes';

/**
 * Client-side-only registry of connected mailboxes, keyed by browser
 * `localStorage`. There is no `GET /mailboxes` (or equivalent listing)
 * endpoint anywhere server-side — `POST /comm/email/accounts/callback`
 * returns a new mailbox's id once, at connection time, and is never
 * re-listable afterwards. This service is the frontend's only way to
 * remember which mailboxes exist across page reloads; it is not backed by
 * any API and is per-browser, not per-tenant — a second user or a cleared
 * browser profile won't see mailboxes connected elsewhere.
 */
@Injectable({ providedIn: 'root' })
export class MailboxRegistryService {
  private readonly mailboxesSignal = signal<KnownMailbox[]>(this.readFromStorage());
  readonly mailboxes = this.mailboxesSignal.asReadonly();

  add(mailbox: KnownMailbox): void {
    const next = [...this.mailboxesSignal().filter((m) => m.id !== mailbox.id), mailbox];
    this.mailboxesSignal.set(next);
    this.writeToStorage(next);
  }

  /** Best-effort: also learns mailbox ids seen on loaded threads, in case they were connected in a different browser session. */
  noteSeenMailboxId(mailboxId: string): void {
    if (this.mailboxesSignal().some((m) => m.id === mailboxId)) return;
    this.add({ id: mailboxId, label: `Mailbox ${mailboxId.slice(0, 8)}`, provider: 'unknown' });
  }

  private readFromStorage(): KnownMailbox[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as KnownMailbox[]) : [];
    } catch {
      return [];
    }
  }

  private writeToStorage(mailboxes: KnownMailbox[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mailboxes));
    } catch {
      // Storage unavailable (private browsing, quota) — the in-memory signal still works for this session.
    }
  }
}
