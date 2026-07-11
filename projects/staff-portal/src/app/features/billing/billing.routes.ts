import { Routes } from '@angular/router';

/** PRD Module 8 nav — hub + the non-dialog screens (§11 Billing screen list). */
export const BILLING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./billing-hub.page').then((m) => m.BillingHubPage),
    data: { permission: 'billing.read' },
  },
  {
    path: 'batch',
    loadComponent: () =>
      import('./batch/batch-billing-wizard.page').then((m) => m.BatchBillingWizardPage),
    data: { permission: 'invoice.create' },
  },
  {
    path: 'aging',
    loadComponent: () => import('./aging/aging-report.page').then((m) => m.AgingReportPage),
    data: { permission: 'billing.read' },
  },
  {
    path: 'reconciliation',
    loadComponent: () =>
      import('./reconciliation/reconciliation-workspace.page').then(
        (m) => m.ReconciliationWorkspacePage,
      ),
    data: { permission: 'trust.deposit' },
  },
  {
    path: 'statement/:clientId',
    loadComponent: () =>
      import('./statement/client-statement.page').then((m) => m.ClientStatementPage),
    data: { permission: 'billing.read' },
  },
  {
    path: 'trust/:clientId',
    loadComponent: () => import('./trust/trust-ledger.page').then((m) => m.TrustLedgerPage),
    data: { permission: 'billing.read' },
  },
  {
    path: 'invoices/new',
    loadComponent: () =>
      import('./invoice-editor/invoice-editor.page').then((m) => m.InvoiceEditorPage),
    data: { permission: 'invoice.create' },
  },
  {
    path: 'invoices/:id',
    loadComponent: () =>
      import('./invoice-editor/invoice-editor.page').then((m) => m.InvoiceEditorPage),
    data: { permission: 'billing.read' },
  },
];
