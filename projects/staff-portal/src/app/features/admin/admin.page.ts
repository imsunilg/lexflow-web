import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PlaceholderPageComponent } from '../../shared/placeholder-page/placeholder-page.component';

@Component({
  selector: 'lf-staff-admin-page',
  standalone: true,
  imports: [PlaceholderPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-placeholder-page
    title="Admin"
    description="Users, Roles, Teams, Departments, Branches, Settings, Workflow Rules, Audit Logs, Integrations (PRD Module 14/15)."
  />`,
})
export class AdminPage {}
