import { Directive, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subscription } from 'rxjs';
import { AnalyticsRange } from 'shared';

/**
 * Common loading/error/empty/data state machine shared by all 12 dashboard
 * widgets (PRD Module 1: "each widget isolates failures — failed widget shows
 * retry card; never blank page"). Concrete widgets only implement `fetch()`;
 * refetching on `refreshTrigger` (SignalR push / 5-min poll bump, see
 * `DashboardRealtimeService`) and, for analytics widgets, on `range` changes,
 * is handled once here. This class is never used as a directive directly —
 * it's `@Directive()`-decorated (rather than a plain class) only because
 * Angular's compiler requires that on any base class contributing inherited
 * signal `input()`s to a concrete `@Component` subclass.
 */
@Directive()
export abstract class DashboardWidgetBase<T> {
  protected readonly destroyRef = inject(DestroyRef);

  readonly refreshTrigger = input(0);
  readonly range = input<AnalyticsRange>();

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly data = signal<T | null>(null);

  private inFlight?: Subscription;

  protected abstract fetch(range: AnalyticsRange | undefined): Observable<T>;

  constructor() {
    effect(() => {
      const trigger = this.refreshTrigger();
      const range = this.range();
      void trigger;
      this.load(range);
    });
  }

  load(range = this.range()): void {
    this.inFlight?.unsubscribe();
    this.loading.set(true);
    this.error.set(false);
    this.inFlight = this.fetch(range)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.data.set(result);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }
}
