import { expect, test } from '@playwright/test';
import { loginAsStaffReal } from '../../fixtures/real-auth';

/**
 * PRD §37 journey #40: Admin -> audit log browser.
 *
 * `audit-log.page.ts`'s own doc comment is explicit about scope: `GET
 * /settings/audit` is the ONLY audit-read endpoint in the whole backend, and
 * it covers settings + payment-gateway changes only, filtered by `section`
 * (the settings blob's own key, e.g. `firm_details`) — not a general
 * cross-entity audit trail, no actor/date filter, no IP/UA. This journey
 * produces a real audit event by editing the `firm_details` settings section
 * (a plain top-level JSON blob with no secrets, so nothing here needs
 * masking), then searches the audit log by that same section and confirms
 * the change shows up with a real before/after diff.
 */
test.describe('Journey 40: Admin audit log browser', () => {
  test('editing firm details produces a real, searchable audit entry', async ({ page }) => {
    await loginAsStaffReal(page);

    // 1. Produce an audit event: change the firm's display name.
    const newDisplayName = `E2E Firm ${Date.now()}`;
    await page.goto('/admin/settings/firm_details');
    await page.getByLabel(/^legal name$/i).fill('E2E Test Firm LLP');
    await page.getByLabel(/display name/i).fill(newDisplayName);
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByText(/settings saved/i)).toBeVisible({ timeout: 15_000 });

    // 2. Search the audit log filtered to the "firm_details" section.
    await page.goto('/admin/audit');
    await page.getByLabel(/^section$/i).fill('firm_details');
    await page.getByRole('button', { name: /^search$/i }).click();
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15_000 });

    // 3. There's no ordering guarantee documented for this feed (and prior
    // test runs may have left other `firm_details` entries behind), so expand
    // every row's diff rather than assuming the newest one is first, then
    // confirm this run's new display name shows up in some entry's "after".
    const viewDiffButtons = page.getByRole('button', { name: /view diff/i });
    const count = await viewDiffButtons.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await page
        .getByRole('button', { name: /view diff/i })
        .nth(i)
        .click();
    }
    await expect(page.getByText(new RegExp(newDisplayName))).toBeVisible({ timeout: 15_000 });
  });
});
