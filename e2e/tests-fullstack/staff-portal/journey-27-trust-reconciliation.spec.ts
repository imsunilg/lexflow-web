import { expect, test } from '@playwright/test';
import { loginAsStaffReal } from '../../fixtures/real-auth';

/**
 * PRD §37 flagged journey #27: trust reconciliation -> import a bank
 * statement CSV -> auto-match -> sign off
 * (`billing/reconciliation/reconciliation-workspace.page.ts`).
 *
 * There is no separate auto-match endpoint — matching happens server-side as
 * part of submitting the reconciliation itself, which returns
 * `isBalanced`/`exceptionCount` directly (see that page's own doc comment).
 * Reconciliation is tenant-wide (one firm trust bank account), not
 * per-client, so unlike the other Billing journeys this one needs no matter
 * or client id.
 */
test.describe('Journey 27: trust reconciliation from a CSV bank statement', () => {
  test('a CSV bank statement is imported, submitted for matching, and signed off', async ({
    page,
  }) => {
    await loginAsStaffReal(page);

    await page.goto('/billing/reconciliation');

    // 1. Import a small bank-statement CSV (date, description, amount), built inline — there is no
    // multipart/CSV-upload endpoint; the workspace parses this client-side then submits `lines[]` as JSON.
    const csv = [
      'date,description,amount',
      '2026-07-01,Bank charges,-50',
      '2026-07-05,Wire transfer in,1000',
    ].join('\n');

    await page.locator('input[type="file"]').setInputFiles({
      name: 'e2e-bank-statement.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv, 'utf-8'),
    });
    await expect(page.getByText(/2 row\(s\) parsed/i)).toBeVisible({ timeout: 10_000 });

    // 2. Period + bank statement balance (period defaults to first-of-month -> today).
    await page.getByLabel(/bank statement balance/i).fill('950');

    // 3. Submit for auto-match.
    await page.getByRole('button', { name: /submit reconciliation/i }).click();
    await expect(page.getByText(/ledger balance:/i)).toBeVisible({ timeout: 20_000 });

    // 4. Sign off. Two manufactured bank lines almost certainly won't match any real ledger entry,
    // so this will show exceptions and route through the typed-confirmation dialog; if the
    // environment happens to balance perfectly instead, sign-off proceeds directly — both are real
    // app paths, handled honestly rather than assuming one.
    await page.getByRole('button', { name: /^sign off$/i }).click();

    const confirmDialog = page.locator('mat-dialog-container', {
      hasText: 'Sign off with open exceptions',
    });
    const confirmDialogAppeared = await confirmDialog
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    if (confirmDialogAppeared) {
      await confirmDialog.locator('.lf-confirm-dialog__input').fill('SIGN OFF');
      await confirmDialog.getByRole('button', { name: /^sign off$/i }).click();
    }

    await expect(page.getByText(/^signed off\.$/i)).toBeVisible({ timeout: 15_000 });
  });
});
