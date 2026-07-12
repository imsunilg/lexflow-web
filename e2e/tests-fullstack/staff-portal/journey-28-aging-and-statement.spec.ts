import { expect, test } from '@playwright/test';
import { E2E_PORTAL_CLIENT_ID, loginAsStaffReal } from '../../fixtures/real-auth';

/**
 * PRD §37 flagged journey #28: accounts-receivable aging report
 * (`billing/aging/aging-report.page.ts`) plus a client statement of account
 * (`billing/statement/client-statement.page.ts`).
 */
test.describe('Journey 28: aging report and client statement', () => {
  test('the aging report reconciles its buckets and a client statement loads for the seeded client', async ({
    page,
  }) => {
    await loginAsStaffReal(page);

    // 1. Aging report — AC-B6: the aging buckets must sum to the total AR.
    await page.goto('/billing/aging');
    await page.getByRole('button', { name: /refresh/i }).click();
    await expect(page.getByText(/total ar/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.aging__check')).not.toHaveClass(/aging__check--fail/);

    // 2. Client statement for the seeded portal client.
    await page.goto(`/billing/statement/${E2E_PORTAL_CLIENT_ID}`);
    await page.getByRole('button', { name: /refresh/i }).click();
    await expect(page.getByText(/opening balance/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/closing balance/i)).toBeVisible({ timeout: 15_000 });
  });
});
