import { expect, test } from '@playwright/test';
import { E2E_PORTAL_CLIENT_ID, loginAsStaffReal } from '../../fixtures/real-auth';

/** Strips currency symbols/thousands separators so `lfCurrency`-formatted text can be compared numerically. */
function parseCurrency(text: string): number {
  return Number(text.replace(/[^0-9.-]/g, ''));
}

/**
 * PRD §37 flagged journey #24: issue a credit note against a real Sent
 * invoice via the Billing Hub's row action
 * (`billing/dialogs/credit-note-dialog.component.ts`).
 *
 * Builds the invoice through the same WIP -> submit -> approve -> send
 * pipeline as Journey 2 (minus the payment/Razorpay leg) so the credit note
 * is issued against a genuinely Sent invoice, not a fabricated one.
 */
test.describe('Journey 24: issue a credit note against a sent invoice', () => {
  test('unbilled time becomes a sent invoice, then a credit note is issued against it', async ({
    page,
  }) => {
    await loginAsStaffReal(page);

    // 1. Create a matter under the seeded portal-enabled client.
    const matterTitle = `E2E Credit Note Matter ${Date.now()}`;
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

    // 2. Log unbilled time.
    await page.goto('/time/timesheet');
    await page.getByLabel(/matter/i).fill(matterTitle);
    await page.getByText(matterTitle).first().click();
    await page.locator('[data-matter-row] .timesheet-grid__cell', { hasText: '' }).first().click();
    await page.getByRole('textbox').first().fill('2');
    await page.keyboard.press('Enter');

    // 3. Capture the real unbilled time-entry id(s), same network-observation approach as Journey 2
    // (there is no id shown in the DOM — the invoice editor's own hint says these must be pasted
    // in manually "from the Time module").
    const entriesResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/time-entries') && response.request().method() === 'GET',
    );
    await page.goto(`/time/entries?matterId=${matterId}`);
    const entriesBody = await (await entriesResponse).json();
    const entryIds: string[] = (entriesBody.data ?? [])
      .filter((entry: { matterId: string }) => entry.matterId === matterId)
      .map((entry: { id: string }) => entry.id);
    expect(entryIds.length).toBeGreaterThan(0);

    // 4. Create, submit, approve, and send the invoice.
    await page.goto('/billing/invoices/new');
    await page.getByLabel(/^matter/i).fill(matterTitle);
    await page.getByText(matterTitle).first().click();
    await page.getByLabel(/unbilled time-entry ids/i).fill(entryIds.join(','));
    await page.getByLabel(/due in \(days\)/i).fill('15');
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByText(/draft/i)).toBeVisible({ timeout: 15_000 });
    const invoiceId = page.url().match(/\/invoices\/([0-9a-f-]+)$/)![1];

    await page.getByRole('button', { name: /submit for approval/i }).click();
    await expect(page.getByText(/submitted/i)).toBeVisible({ timeout: 15_000 });

    await page.goto('/billing');
    await page.getByRole('tab', { name: /approvals/i }).click();
    await page
      .locator('tr', { hasText: matterId })
      .getByRole('button', { name: /approve/i })
      .click();

    await page.goto(`/billing/invoices/${invoiceId}`);
    await page.getByRole('button', { name: /^send$/i }).click();
    await expect(page.getByText(/sent/i)).toBeVisible({ timeout: 15_000 });

    // 5. Issue a credit note against the sent invoice from the Billing Hub's Sent tab.
    await page.goto('/billing');
    await page.getByRole('tab', { name: /^sent/i }).click();
    const sentRow = page.locator('tr', { hasText: matterId });
    await expect(sentRow).toBeVisible({ timeout: 15_000 });
    await sentRow.getByRole('button', { name: /credit note/i }).click();

    const dialog = page.locator('mat-dialog-container');
    const summaryText = await dialog.locator('.credit-note-dialog__invoice').innerText();
    const grandTotal = parseCurrency(summaryText);
    expect(grandTotal).toBeGreaterThan(0);

    await dialog.getByLabel(/^amount$/i).fill((grandTotal / 2).toFixed(2));
    await dialog.getByLabel(/reason/i).fill('E2E journey: partial billing error correction.');
    await dialog.getByRole('button', { name: /issue credit note/i }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
  });
});
