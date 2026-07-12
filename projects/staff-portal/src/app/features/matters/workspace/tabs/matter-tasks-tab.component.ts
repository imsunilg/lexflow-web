import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EmptyStateComponent } from 'shared';

/**
 * Tasks tab for the matter workspace (PRD Module 4).
 * No matter-scoped task-listing API exists in this codebase yet, so this is
 * intentionally a static empty state with no fetch.
 */
@Component({
  selector: 'lf-matter-tasks-tab',
  standalone: true,
  imports: [EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lf-empty-state
      icon="checklist"
      title="No tasks yet"
      i18n-title="@@matters.matterTasksTab.emptyTitle"
      message="Task management isn't built in this environment yet."
      i18n-message="@@matters.matterTasksTab.emptyMessage"
    />
  `,
})
export class MatterTasksTabComponent {
  readonly matterId = input.required<string>();
}
