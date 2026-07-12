import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute } from '@angular/router';
import { catchError, of } from 'rxjs';
import { EmptyStateComponent, StatusChipComponent } from 'shared';
import { PortalMatterTimeline } from '../../core/models/portal.models';
import { PortalMattersService } from '../../core/services/portal-matters.service';

/**
 * Sanitized matter timeline (PRD Module 17 step 3): hearings + published
 * outcomes only — the backend never returns internal notes/strategy on this
 * endpoint, so there is nothing to filter client-side. An unauthorized or
 * foreign matter id 404s (enumeration-safe, per AC-P1) rather than 403 —
 * rendered here as the same "not found" empty state a client would see for a
 * genuinely missing matter.
 */
@Component({
  selector: 'lf-portal-matter-timeline-page',
  standalone: true,
  imports: [
    DatePipe,
    MatIconModule,
    MatProgressBarModule,
    EmptyStateComponent,
    StatusChipComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './matter-timeline.page.html',
  styleUrl: './matter-timeline.page.scss',
})
export class MatterTimelinePage {
  private readonly route = inject(ActivatedRoute);
  private readonly mattersService = inject(PortalMattersService);

  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly timeline = signal<PortalMatterTimeline | null>(null);

  constructor() {
    const matterId = this.route.snapshot.paramMap.get('id');
    if (!matterId) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }

    this.mattersService
      .getTimeline(matterId)
      .pipe(catchError(() => of(null)))
      .subscribe((timeline) => {
        this.loading.set(false);
        if (!timeline) {
          this.notFound.set(true);
          return;
        }
        this.timeline.set(timeline);
      });
  }
}
