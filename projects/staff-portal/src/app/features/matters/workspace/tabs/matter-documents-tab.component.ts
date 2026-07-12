import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EmptyStateComponent } from 'shared';

/**
 * Documents & Evidence tab for the matter workspace (PRD Module 4).
 * No document-listing API exists for matters in this codebase yet (DMS module
 * isn't built), so this is intentionally a static empty state with no fetch.
 */
@Component({
  selector: 'lf-matter-documents-tab',
  standalone: true,
  imports: [EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lf-empty-state
      icon="folder"
      title="No documents yet"
      i18n-title="@@matters.matterDocumentsTab.emptyTitle"
      message="The Documents module isn't built in this environment yet."
      i18n-message="@@matters.matterDocumentsTab.emptyMessage"
    />
  `,
})
export class MatterDocumentsTabComponent {
  readonly matterId = input.required<string>();
}
