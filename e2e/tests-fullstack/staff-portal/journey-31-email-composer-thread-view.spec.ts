import { expect, test } from '@playwright/test';
import { E2E_PORTAL_CLIENT_ID, loginAsStaffReal } from '../../fixtures/real-auth';

/**
 * PRD §37 flagged journey #31: composer + thread view — compose and
 * associate an email with a matter/client, verify it appears in thread view.
 *
 * Documented gap (shared with journey-30): actually *sending* an email
 * requires a mailbox connected via real Gmail/Microsoft OAuth
 * (`CommEmailService.send()` requires a real `mailboxId` the server
 * recognizes as owned by this tenant), and this environment has no seeded or
 * creatable OAuth credential to get one (see journey-30's header comment).
 * So a real send — and therefore a real thread ever existing to view — is
 * not reachable here. This journey instead verifies, for real:
 *   1. The composer opens, can be filled out (To/Subject/Body), and can be
 *      associated with a real matter via the matter autocomplete (a real
 *      `GET /matters?q=` call).
 *   2. Its own "From mailbox" field honestly reports there are no known
 *      mailboxes, and clicking Send with no mailbox selected is a genuine,
 *      honest no-op (the dialog stays open, nothing is submitted) rather
 *      than pretending to send.
 *   3. The inbox's thread view honestly shows zero threads, because zero
 *      threads can exist without a connected mailbox — there is no
 *      simulated/fake "send" path that would fake a thread into existing.
 */
test.describe('Journey 31: email composer — compose, associate with a matter, honest send boundary', () => {
  test('the composer can be filled and matter-linked, but sending is honestly blocked without a connected mailbox', async ({
    page,
  }) => {
    await loginAsStaffReal(page);

    // 1. Create a real matter to associate the drafted email with.
    const matterTitle = `E2E Comm Matter ${Date.now()}`;
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

    // 2. Open the composer from the inbox.
    await page.goto('/communication/inbox');
    await page.getByRole('button', { name: /new email/i }).click();
    await expect(page.getByRole('heading', { name: /^new email$/i })).toBeVisible();

    // No known mailboxes in this fresh browser profile — the composer says so honestly.
    await expect(page.getByText(/no known mailboxes — connect one first\./i)).toBeVisible();

    // 3. Fill out the draft.
    await page.getByLabel(/^to$/i).fill('opposing.counsel@e2e.test');
    await page.getByLabel(/^subject$/i).fill(`Re: ${matterTitle}`);
    await page
      .getByLabel(/^body$/i)
      .fill('E2E journey: drafting correspondence to associate with the matter.');

    // 4. Associate the draft with the real matter via the matter autocomplete
    // (a genuine `GET /matters?q=` call, same pattern as the inbox's own filter).
    const matterField = page.getByLabel(/matter \(optional\)/i);
    await matterField.fill(matterTitle);
    await page.getByRole('option', { name: new RegExp(matterTitle) }).click();
    await expect(matterField).toHaveValue(new RegExp(matterTitle));

    // 5. Merge preview reflects exactly what would be sent (client-side, no server templating for email).
    await expect(
      page.getByText(/merge preview \(this is exactly what will be sent\)/i),
    ).toBeVisible();
    await expect(
      page.getByText(/drafting correspondence to associate with the matter/i),
    ).toBeVisible();

    // 6. Clicking Send with no mailbox selected is an honest no-op: the
    // dialog stays open (the component returns early on `mailboxId.invalid`
    // rather than submitting or faking success).
    await page.getByRole('button', { name: /^send$/i }).click();
    await expect(page.getByRole('heading', { name: /^new email$/i })).toBeVisible();

    // 7. Close the composer without ever having sent anything.
    await page.getByRole('button', { name: /^cancel$/i }).click();
    await expect(page.getByRole('heading', { name: /^new email$/i })).not.toBeVisible();

    // 8. The thread view honestly has nothing to show — no mailbox has ever
    // synced or sent anything in this environment, so no thread exists.
    await expect(page.getByText(/no threads/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/select a thread/i)).toBeVisible();
  });
});
