import { expect, test } from '@playwright/test';
import { E2E_PORTAL_CLIENT_ID, loginAsStaffReal } from '../../fixtures/real-auth';

/**
 * PRD §37 flagged journey #23: batch billing wizard -> Filter step -> Review
 * step -> generate draft invoices -> verify they land in the Billing Hub.
 *
 * AC-B1 requires the review step's Generate call to complete in <=60s even
 * for up to 200 matters. `minWip: 0` below intentionally matches every
 * matter in the tenant with any unbilled time at all (there's no per-test
 * scoping filter beyond branch/matter-type ids, and this test's seeded
 * tenant has no branch/matter-type ids to key off of) — so this may generate
 * more draft invoices than just the one this test creates. The assertions
 * only check that *this* test's matter shows up among the generated drafts
 * and then in the hub, not that it's the only one.
 */
test.describe('Journey 23: batch billing wizard -> draft invoices in the Billing Hub', () => {
  test('a matter with unbilled time gets a draft invoice via the batch billing wizard', async ({
    page,
  }) => {
    await loginAsStaffReal(page);

    // 1. Create a matter under the seeded portal-enabled client.
    const matterTitle = `E2E Batch Matter ${Date.now()}`;
    await page.goto('/matters/list');
    await page.getByRole('button', { name: /new matter/i }).click();
    await page.getByLabel(/client id/i).fill(E2E_PORTAL_CLIENT_ID);
    await page.getByLabel(/^title/i).fill(matterTitle);
    await page.getByLabel(/matter type/i).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: /run conflict check/i }).click();
    await expect(page.getByRole('button', { name: /create matter/i })).toBeEnabled({
      timeout: 15_000,
    });
    await page.getByRole('button', { name: /create matter/i }).click();
    await expect(page).toHaveURL(/\/matters\/([0-9a-f-]+)$/, { timeout: 15_000 });
    const matterId = page.url().match(/\/matters\/([0-9a-f-]+)$/)![1];

    // 2. Log unbilled time against the matter so it has WIP for the batch to pick up.
    await page.goto('/time/timesheet');
    await page.getByLabel(/matter/i).fill(matterTitle);
    await page.getByText(matterTitle).first().click();
    await page.locator('[data-matter-row] .timesheet-grid__cell', { hasText: '' }).first().click();
    await page.getByRole('textbox').first().fill('3');
    await page.keyboard.press('Enter');

    // 3. Run the batch billing wizard: Filter -> Review -> Generate.
    await page.goto('/billing/batch');
    await page.getByLabel(/minimum wip/i).fill('0');
    await page.getByRole('button', { name: /^next$/i }).click();

    await page.getByRole('button', { name: /^generate$/i }).click();

    // 4. Generation can take up to a minute for large batches (AC-B1); wait for the summary line.
    await expect(page.getByText(/draft.*created, total/i)).toBeVisible({ timeout: 65_000 });

    const resultRow = page.locator('table.batch-billing-wizard__table tr', { hasText: matterId });
    await expect(resultRow).toBeVisible({ timeout: 5_000 });

    // 5. Confirm the same invoice shows up in the Billing Hub's Draft Invoices tab.
    await page.goto('/billing');
    await page.getByRole('tab', { name: /draft invoices/i }).click();
    await expect(page.locator('tr', { hasText: matterId })).toBeVisible({ timeout: 15_000 });
  });
});
