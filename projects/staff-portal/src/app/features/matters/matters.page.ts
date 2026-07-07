import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PlaceholderPageComponent } from '../../shared/placeholder-page/placeholder-page.component';

@Component({
  selector: 'lf-staff-matters-page',
  standalone: true,
  imports: [PlaceholderPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-placeholder-page
    title="Matters"
    description="Matter list and workspace (Overview, Court Cases, Hearings, Documents, Tasks, Billing...) (PRD Module 4)."
  />`,
})
export class MattersPage {}
