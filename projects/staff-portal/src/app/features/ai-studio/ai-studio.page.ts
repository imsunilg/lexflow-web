import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PlaceholderPageComponent } from '../../shared/placeholder-page/placeholder-page.component';

@Component({
  selector: 'lf-staff-ai-studio-page',
  standalone: true,
  imports: [PlaceholderPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-placeholder-page
    title="AI Studio"
    description="Assistant, contract review, drafting, research (PRD Module 16)."
  />`,
})
export class AiStudioPage {}
