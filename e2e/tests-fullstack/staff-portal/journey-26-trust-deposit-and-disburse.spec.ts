import { expect, test } from '@playwright/test';
import { E2E_PORTAL_CLIENT_ID, loginAsStaffReal } from '../../fixtures/real-auth';

/** Strips currency symbols/thousands separators so `lfCurrency`-formatted text can be compared numerically. */
function parseCurrency(text: string): number {
  return Number(text.replace(/[^0-9.-]/g, ''));
}

/**
 * PRD §37 flagged journey #26: trust accounting -> deposit and disburse
 * trust funds for a client, verify the ledger's running balance
 * (`billing/trust/trust-ledger.page.ts`).
 *
 * Reached via `/billing/trust/:clientId` — the same route the Billing Hub's
 * Trust tab navigates to once a client is picked from its name-search
 * (`billing-hub.page.ts`'s `openTrustLedger()`). This test goes there
 * directly since the hub's search only matches on a client's display name,
 * which isn't known ahead of time for the seeded portal client id this
 * suite reuses.
 */
test.describe('Journey 26: trust deposit and disburse with running-balance verification', () => {
  test('depositing then disbursing trust funds keeps an accurate running balance', async ({
    page,
  }) => {
    await loginAsStaffReal(page);

    await page.goto(`/billing/trust/${E2E_PORTAL_CLIENT_ID}`);
    await expect(page.getByRole('heading', { name: /trust ledger/i })).toBeVisible({
      timeout: 15_000,
    });

    const balanceValue = page.locator('.trust-ledger__balance-value');
    const initialBalance =
      (await balanceValue.count()) > 0 ? parseCurrency(await balanceValue.innerText()) : 0;

    // 1. Deposit.
    const depositAmount = 5000;
    const depositPurpose = `E2E deposit ${Date.now()}`;
    await page.getByRole('button', { name: /^deposit$/i }).click();
    await page.getByLabel(/^amount$/i).fill(String(depositAmount));
    await page.getByLabel(/^purpose$/i).fill(depositPurpose);
    await page.getByRole('button', { name: /record deposit/i }).click();

    const depositRow = page.locator('tr', { hasText: depositPurpose });
    await expect(depositRow).toBeVisible({ timeout: 15_000 });
    const depositRunningBalance = parseCurrency(await depositRow.locator('td').nth(3).innerText());
    expect(depositRunningBalance).toBeCloseTo(initialBalance + depositAmount, 2);

    // 2. Disburse (requires a typed-confirmation dialog with the authorization ref; AC-B4's
    // no-negative-balance rule is enforced server-side).
    const disburseAmount = 2000;
    const disbursePurpose = `E2E disbursement ${Date.now()}`;
    const authRef = `E2E-AUTH-${Date.now()}`;
    await page.getByRole('button', { name: /^disburse$/i }).click();
    await page.getByLabel(/^amount$/i).fill(String(disburseAmount));
    await page.getByLabel(/^purpose$/i).fill(disbursePurpose);
    await page.getByLabel(/authorization ref \(required\)/i).fill(authRef);
    await page
      .getByRole('button', { name: /^disburse$/i })
      .last()
      .click();

    const confirmDialog = page.locator('mat-dialog-container');
    await confirmDialog.waitFor({ state: 'visible', timeout: 5_000 });
    await confirmDialog.locator('.lf-confirm-dialog__input').fill(authRef);
    await confirmDialog.getByRole('button', { name: /^disburse$/i }).click();

    const disburseRow = page.locator('tr', { hasText: disbursePurpose });
    await expect(disburseRow).toBeVisible({ timeout: 15_000 });
    const disburseRunningBalance = parseCurrency(
      await disburseRow.locator('td').nth(3).innerText(),
    );
    expect(disburseRunningBalance).toBeCloseTo(depositRunningBalance - disburseAmount, 2);
  });
});
