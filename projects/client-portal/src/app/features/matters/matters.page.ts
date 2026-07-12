import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent, StatusChipComponent } from 'shared';
import { PortalMatterSummary } from '../../core/models/portal.models';
import { PortalMattersService } from '../../core/services/portal-matters.service';

/** Matters list (PRD Module 17 step 3) — each card links to its sanitized timeline. */
@Component({
  selector: 'lf-portal-matters-page',
  standalone: true,
  imports: [RouterLink, MatProgressBarModule, EmptyStateComponent, StatusChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './matters.page.html',
  styleUrl: './matters.page.scss',
})
export class MattersPage {
  private readonly mattersService = inject(PortalMattersService);

  readonly loading = signal(true);
  readonly matters = signal<PortalMatterSummary[]>([]);

  constructor() {
    this.mattersService.getMyMatters().subscribe((matters) => {
      this.matters.set(matters);
      this.loading.set(false);
    });
  }
}
