import { expect, test } from '@playwright/test';
import { E2E_PORTAL_CLIENT_ID, loginAsStaffReal } from '../../fixtures/real-auth';

/**
 * PRD §37 flagged journey #21 (Module 9 User Flow 1): start the persistent
 * timer against a real matter, stop it (creating a Draft time entry, per
 * `TimerService.stop()`'s own doc comment — duration/rounding are
 * server-computed), then submit that entry for approval from the Entries
 * list.
 */
test.describe('Journey 21: timer start/stop -> timesheet entry -> submit for approval', () => {
  test('a running timer becomes a draft time entry and is submitted for approval', async ({
    page,
  }) => {
    await loginAsStaffReal(page);

    // 1. Create a matter to time against.
    const matterTitle = `E2E Timer Matter ${Date.now()}`;
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
    await expect(page).toHaveURL(/\/matters\/[0-9a-f-]+$/, { timeout: 15_000 });

    // 2. Start the persistent timer chip (in the shell's top bar, present on
    // every authenticated page) against that matter.
    await page.goto('/dashboard');
    const timerChip = page.getByRole('button', { name: /^timer$/i });
    await timerChip.click();
    await page.getByRole('menuitem', { name: /start timer/i }).click();

    await expect(page.getByRole('heading', { name: /start timer/i })).toBeVisible();
    await page.getByLabel(/matter \(optional\)/i).fill(matterTitle);
    await page.getByText(matterTitle).first().click();
    await page.getByRole('button', { name: /^start$/i }).click();

    // 3. Let the timer actually run for a few real seconds (this is a real
    // elapsed-time measurement, not a mocked clock), then stop it.
    await expect(timerChip).toHaveClass(/timer-chip--running/, { timeout: 15_000 });
    await page.waitForTimeout(3_000);

    await timerChip.click();
    await page.getByRole('menuitem', { name: /^stop$/i }).click();
    await expect(page.getByRole('heading', { name: /stop timer/i })).toBeVisible();
    await page
      .getByLabel(/narrative/i)
      .fill('E2E journey 21: timed work logged via the persistent timer chip.');
    await page.getByRole('button', { name: /stop.*save/i }).click();

    // 4. The stopped timer produces a Draft entry (server-computed duration/
    // rounding) — find it in the Entries list and submit it for approval.
    await page.goto('/time/entries');
    const row = page.locator('tr', { hasText: matterTitle });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row).toContainText(/draft/i);

    await row.getByRole('button', { name: /^submit$/i }).click();
    await expect(row).toContainText(/submitted/i, { timeout: 15_000 });
  });
});
