import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, concatMap, from, map, of, toArray } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

export interface QueuedMutation {
  id: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  body: unknown;
  label: string;
  createdAt: string;
}

const DB_NAME = 'lexflow-offline-queue';
const STORE_NAME = 'mutations';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * PRD §12 "background sync of queued notes/time entries": a small,
 * dependency-free IndexedDB-backed outbox for mutations attempted while
 * offline. There is no cross-browser Background Sync API (Safari doesn't
 * implement it at all), so the reliable mechanism here is the `online`
 * window event plus an explicit `flush()` any offline-banner "Retry" button
 * can call — not `ServiceWorkerRegistration.sync`, which would silently
 * never fire on non-Chromium browsers.
 */
@Injectable({ providedIn: 'root' })
export class OfflineMutationQueueService {
  private readonly http = inject(HttpClient);
  private dbPromise: Promise<IDBDatabase> | null = null;

  readonly pendingCount = signal(0);

  constructor() {
    this.refreshCount();
    window.addEventListener('online', () => this.flush().subscribe());
  }

  private db(): Promise<IDBDatabase> {
    this.dbPromise ??= openDb();
    return this.dbPromise;
  }

  /** Persists a mutation for later replay. Call this from a request's `error` handler when `!navigator.onLine` or the error is a network failure (status 0). */
  async enqueue(mutation: Omit<QueuedMutation, 'id' | 'createdAt'>): Promise<void> {
    const db = await this.db();
    const record: QueuedMutation = {
      ...mutation,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).add(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    this.refreshCount();
  }

  async list(): Promise<QueuedMutation[]> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result as QueuedMutation[]);
      request.onerror = () => reject(request.error);
    });
  }

  private async remove(id: string): Promise<void> {
    const db = await this.db();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    this.refreshCount();
  }

  private refreshCount(): void {
    this.list().then((items) => this.pendingCount.set(items.length));
  }

  /** Replays queued mutations in FIFO order. Each is attempted independently — a still-failing one (e.g. still offline) stays queued for the next `flush()` rather than blocking the rest of the queue from draining. */
  flush(): Observable<void> {
    return from(this.list()).pipe(
      concatMap((mutations) => from(mutations)),
      concatMap((mutation) =>
        this.http.request(mutation.method, mutation.url, { body: mutation.body }).pipe(
          tap(() => this.remove(mutation.id)),
          catchError(() => of(null)),
        ),
      ),
      toArray(),
      map(() => undefined),
    );
  }
}
