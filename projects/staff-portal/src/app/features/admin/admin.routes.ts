import { Routes } from '@angular/router';

/** PRD Module 14/15 UI Components — Users, Roles, Teams, Departments, Branches, Access, Settings, Workflow Rules, Audit. */
export const ADMIN_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'users' },
  {
    path: 'users',
    loadComponent: () => import('./users/users-list.page').then((m) => m.UsersListPage),
  },
  {
    path: 'users/:id',
    loadComponent: () => import('./users/user-detail.page').then((m) => m.UserDetailPage),
  },
  {
    path: 'roles',
    loadComponent: () => import('./roles/roles-list.page').then((m) => m.RolesListPage),
  },
  {
    path: 'roles/matrix',
    loadComponent: () =>
      import('./roles/permission-matrix.page').then((m) => m.PermissionMatrixPage),
  },
  {
    path: 'teams',
    loadComponent: () => import('./teams/teams-list.page').then((m) => m.TeamsListPage),
  },
  {
    path: 'departments',
    loadComponent: () =>
      import('./departments/departments-list.page').then((m) => m.DepartmentsListPage),
  },
  {
    path: 'branches',
    loadComponent: () => import('./branches/branches-list.page').then((m) => m.BranchesListPage),
  },
  {
    path: 'access',
    loadComponent: () =>
      import('./access/effective-permission-inspector.page').then(
        (m) => m.EffectivePermissionInspectorPage,
      ),
  },
  {
    path: 'access/sessions',
    loadComponent: () =>
      import('./access/sessions-login-history.page').then((m) => m.SessionsLoginHistoryPage),
  },
  {
    path: 'settings',
    loadComponent: () => import('./settings/settings-hub.page').then((m) => m.SettingsHubPage),
  },
  {
    path: 'settings/number-series',
    loadComponent: () =>
      import('./settings/number-series/number-series.page').then((m) => m.NumberSeriesPage),
  },
  {
    path: 'settings/tax-rates',
    loadComponent: () => import('./settings/tax-rates/tax-rates.page').then((m) => m.TaxRatesPage),
  },
  {
    path: 'settings/gateways',
    loadComponent: () =>
      import('./settings/gateways/payment-gateways.page').then((m) => m.PaymentGatewaysPage),
  },
  {
    path: 'settings/:section',
    loadComponent: () =>
      import('./settings/section/settings-section.page').then((m) => m.SettingsSectionPage),
  },
  {
    path: 'workflow-rules',
    loadComponent: () =>
      import('./workflow-rules/workflow-rules-list.page').then((m) => m.WorkflowRulesListPage),
  },
  {
    path: 'workflow-rules/:id',
    loadComponent: () =>
      import('./workflow-rules/workflow-rule-builder.page').then((m) => m.WorkflowRuleBuilderPage),
  },
  {
    path: 'audit',
    loadComponent: () => import('./audit/audit-log.page').then((m) => m.AuditLogPage),
  },
];
