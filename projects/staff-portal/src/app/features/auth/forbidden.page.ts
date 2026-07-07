import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PlaceholderPageComponent } from '../../shared/placeholder-page/placeholder-page.component';

/** Shown when a deep link targets a route the user lacks permission for (PRD §13). */
@Component({
  selector: 'lf-staff-forbidden-page',
  standalone: true,
  imports: [PlaceholderPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-placeholder-page
      title="403 — Access denied"
      description="You don't have permission to view this page. Request access from your administrator."
    />
  `,
})
export class ForbiddenPage {}
