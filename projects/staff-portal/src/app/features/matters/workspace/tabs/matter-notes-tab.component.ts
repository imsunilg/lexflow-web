import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EmptyStateComponent } from 'shared';

/**
 * Notes tab for the matter workspace (PRD Module 4).
 * No shared/matter-notes API exists in this codebase yet (mirrors the same
 * gap in the Clients module's own Notes tab), so this is intentionally a
 * static empty state with no fetch.
 */
@Component({
  selector: 'lf-matter-notes-tab',
  standalone: true,
  imports: [EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lf-empty-state
      icon="note"
      title="Notes aren't available yet"
      i18n-title="@@matters.matterNotesTab.emptyTitle"
      message="No shared notes API exists in this environment yet."
      i18n-message="@@matters.matterNotesTab.emptyMessage"
    />
  `,
})
export class MatterNotesTabComponent {
  readonly matterId = input.required<string>();
}
