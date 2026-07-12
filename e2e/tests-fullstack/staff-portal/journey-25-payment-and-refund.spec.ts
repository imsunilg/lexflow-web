import { expect, test } from '@playwright/test';
import { E2E_PORTAL_CLIENT_ID, loginAsStaffReal } from '../../fixtures/real-auth';

/**
 * PRD §37 flagged journey #25: record a manual (non-gateway) payment against
 * a sent invoice via `billing/dialogs/payment-record-dialog.component.ts`,
 * then issue a partial refund against that payment via
 * `billing/dialogs/refund-dialog.component.ts` (opened from the Client
 * Statement page's payment row — that's the dialog's only real entry point,
 * per its own doc comment: "the Client Statement page ... will open this for
 * its payment rows").
 *
 * Deliberately uses payment mode "Cash" (the field's default), not
 * "Gateway" — this is the manual recording path, distinct from Journey 2's
 * real Razorpay checkout.
 */
test.describe('Journey 25: manual payment record + refund', () => {
  test('a manual cash payment is recorded against a sent invoice, then partially refunded', async ({
    page,
  }) => {
    await loginAsStaffReal(page);

    // 1. Create a matter under the seeded portal-enabled client.
    const matterTitle = `E2E Payment Matter ${Date.now()}`;
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

    // 3. Capture the real unbilled time-entry id(s) (same network-observation approach as Journey 2).
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

    // 5. Record a manual payment from the Billing Hub's Sent tab. The dialog opened for a specific
    // invoice locks the client and pre-fills amount/allocation to the full outstanding balance, so
    // no field edits are needed beyond confirming — mode defaults to "Cash", not "Gateway".
    await page.goto('/billing');
    await page.getByRole('tab', { name: /^sent/i }).click();
    const sentRow = page.locator('tr', { hasText: matterId });
    await expect(sentRow).toBeVisible({ timeout: 15_000 });
    await sentRow.getByRole('button', { name: /record payment/i }).click();

    const paymentDialog = page.locator('mat-dialog-container');

    const paymentResponse = page.waitForResponse(
      (r) => r.url().includes('/api/v1/payments') && r.request().method() === 'POST',
    );
    await paymentDialog.getByRole('button', { name: /^record payment$/i }).click();
    const paymentBody = await (await paymentResponse).json();
    const payment: { id: string; receiptNumber: string | null; amount: number } = paymentBody.data;
    await expect(paymentDialog).toBeHidden({ timeout: 15_000 });

    // 6. The invoice flips to Paid.
    await page.goto(`/billing/invoices/${invoiceId}`);
    await expect(page.getByText(/paid/i)).toBeVisible({ timeout: 15_000 });

    // 7. Refund part of that payment from the Client Statement page.
    await page.goto(`/billing/statement/${E2E_PORTAL_CLIENT_ID}`);
    const receiptText = payment.receiptNumber ?? payment.id;
    const paymentRow = page.locator('tr', { hasText: receiptText });
    await expect(paymentRow).toBeVisible({ timeout: 15_000 });
    await paymentRow.getByRole('button', { name: /refund/i }).click();

    const refundDialog = page.locator('mat-dialog-container');
    const refundAmount = (payment.amount / 4).toFixed(2);
    await refundDialog.getByLabel(/^amount$/i).fill(refundAmount);
    await refundDialog
      .getByLabel(/reason/i)
      .fill('E2E journey: partial refund due to a billing adjustment.');
    await refundDialog.getByRole('button', { name: /^refund$/i }).click();

    // Refunds are irreversible (PRD §12), so submitting opens a second, typed-confirmation dialog
    // stacked on top of the first — same pattern as voiding an invoice or reversing a trust entry.
    const dialogs = page.locator('mat-dialog-container');
    await expect(dialogs).toHaveCount(2, { timeout: 10_000 });
    const confirmDialog = dialogs.nth(1);
    const confirmText = await confirmDialog.locator('strong').first().innerText();
    await confirmDialog.locator('.lf-confirm-dialog__input').fill(confirmText);
    await confirmDialog.getByRole('button', { name: /^refund$/i }).click();
    await expect(dialogs).toHaveCount(0, { timeout: 15_000 });
  });
});
