import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PlaceholderPageComponent } from '../../shared/placeholder-page/placeholder-page.component';

@Component({
  selector: 'lf-staff-knowledge-base-page',
  standalone: true,
  imports: [PlaceholderPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-placeholder-page
    title="Knowledge Base"
    description="Search, Acts, Judgments, Articles, Collections (PRD Module 12)."
  />`,
})
export class KnowledgeBasePage {}
