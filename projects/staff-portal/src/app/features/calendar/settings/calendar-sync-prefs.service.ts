import { Injectable, computed, signal } from '@angular/core';

export const SYNC_PRIVACY_LEVELS = ['freeBusy', 'fullDetail'] as const;
export type SyncPrivacyLevel = (typeof SYNC_PRIVACY_LEVELS)[number];

const STORAGE_KEY = 'lexflow.calendar.syncPrivacyLevel';
const DEFAULT_LEVEL: SyncPrivacyLevel = 'freeBusy';

function readFromStorage(): SyncPrivacyLevel {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === 'freeBusy' || raw === 'fullDetail' ? raw : DEFAULT_LEVEL;
  } catch {
    return DEFAULT_LEVEL;
  }
}

/**
 * Client-only preference for the PRD's "external busy blocks shown (free/busy
 * or full detail per user choice)" (Module 6 User Flow §5). No backend field
 * exists for this today (confirmed against `CalendarService`/the sync
 * connect-disconnect endpoints) — persisted per-browser only, mirroring
 * `SavedMatterViewsService`'s localStorage pattern, until a real settings API
 * exists.
 */
@Injectable({ providedIn: 'root' })
export class CalendarSyncPrefsService {
  private readonly privacyLevelSignal = signal<SyncPrivacyLevel>(readFromStorage());
  readonly privacyLevel = computed(() => this.privacyLevelSignal());

  setPrivacyLevel(level: SyncPrivacyLevel): void {
    this.privacyLevelSignal.set(level);
    try {
      localStorage.setItem(STORAGE_KEY, level);
    } catch {
      // Storage unavailable (e.g. private browsing quota) — preference stays in-memory for this session.
    }
  }
}
