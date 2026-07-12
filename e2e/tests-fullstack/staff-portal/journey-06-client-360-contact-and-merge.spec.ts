import { expect, test } from '@playwright/test';
import { loginAsStaffReal } from '../../fixtures/real-auth';

/**
 * PRD §37 flagged journey #6: client 360 detail — add a contact person via
 * `ContactSubGridComponent`, then merge a second (duplicate) client into the
 * first via `MergeClientsDialogComponent` (AC-C3).
 *
 * The Contact-persons section only renders for Corporate clients
 * (`ClientDetailPage`'s Overview tab gates it on `client.type === 'Corporate'`),
 * and the create stepper itself requires at least one contact before a
 * Corporate client can be created at all (`canProceedFromAddressesStep()`) —
 * so the survivor client here is created Corporate with one contact staged in
 * the wizard, then a second contact is added for real afterwards via the
 * detail page's contact sub-grid (the component under test).
 */
test.describe('Journey 6: client 360 detail — add contact and merge duplicates', () => {
  test('a contact person is added on the client 360 page, then a duplicate client is merged in', async ({
    page,
  }) => {
    await loginAsStaffReal(page);

    // 1. Create the survivor client: Corporate, with one contact staged in the wizard.
    const stamp = Date.now();
    const survivorName = `E2E Survivor Corp ${stamp}`;
    await page.goto('/clients/new');
    await page.getByRole('button', { name: /corporate/i }).click();
    await page.getByLabel(/legal name/i).fill(survivorName);
    await page.getByLabel(/^email/i).fill(`survivor-${stamp}@e2e.test`);
    await page.getByLabel(/phone/i).fill('+919812360001');
    await page.getByRole('button', { name: /^next$/i }).click();

    // KYC step: nothing to stage, move on.
    await page.getByRole('button', { name: /^next$/i }).click();

    // Addresses step: Corporate clients require >=1 staged contact to proceed.
    await page.getByLabel(/^name$/i).fill('Priya Sharma');
    await page.getByLabel(/designation/i).fill('General Counsel');
    await page.getByRole('button', { name: /add contact/i }).click();
    await expect(page.getByText('Priya Sharma')).toBeVisible();
    await page.getByRole('button', { name: /^next$/i }).click();

    // Portal step: skip.
    await page.getByRole('button', { name: /create client/i }).click();
    await expect(page).toHaveURL(/\/clients\/[0-9a-f-]+$/, { timeout: 15_000 });
    const survivorId = page.url().split('/clients/')[1];

    // 2. Add a second contact for real via the contact sub-grid on the detail page.
    await expect(page.getByText('Priya Sharma')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /add contact/i }).click();
    await page
      .getByLabel(/^name$/i)
      .last()
      .fill('Raj Mehta');
    await page
      .getByLabel(/designation/i)
      .last()
      .fill('CFO');
    await page.getByRole('button', { name: /add contact/i }).click();
    await expect(page.getByText('Raj Mehta')).toBeVisible({ timeout: 15_000 });

    // 3. Create a second (duplicate) client to merge in.
    const duplicateName = `E2E Duplicate Corp ${stamp}`;
    await page.goto('/clients/new');
    await page.getByRole('button', { name: /corporate/i }).click();
    await page.getByLabel(/legal name/i).fill(duplicateName);
    await page.getByLabel(/^email/i).fill(`duplicate-${stamp}@e2e.test`);
    await page.getByLabel(/phone/i).fill('+919812360002');
    await page.getByRole('button', { name: /^next$/i }).click();
    await page.getByRole('button', { name: /^next$/i }).click();
    await page.getByLabel(/^name$/i).fill('Anjali Rao');
    await page.getByRole('button', { name: /add contact/i }).click();
    await page.getByRole('button', { name: /^next$/i }).click();
    await page.getByRole('button', { name: /create client/i }).click();
    await expect(page).toHaveURL(/\/clients\/[0-9a-f-]+$/, { timeout: 15_000 });
    const duplicateId = page.url().split('/clients/')[1];

    // 4. Go back to the survivor and merge the duplicate into it.
    await page.goto(`/clients/${survivorId}`);
    await page.getByRole('button', { name: /merge duplicate/i }).click();

    const dialog = page.locator('mat-dialog-container');
    await dialog.getByLabel(/search clients/i).fill(duplicateName);
    await expect(dialog.getByRole('button', { name: new RegExp(duplicateName) })).toBeVisible({
      timeout: 15_000,
    });
    await dialog.getByRole('button', { name: new RegExp(duplicateName) }).click();

    // Survivor step: the current client (data.client) is preselected as survivor by default — keep it.
    await dialog.getByRole('button', { name: /^next$/i }).click();

    // Fields step: whatever the differing-fields defaults are, just confirm the merge.
    await dialog.getByRole('button', { name: /^merge$/i }).click();
    await expect(dialog.getByText(/merge complete/i)).toBeVisible({ timeout: 15_000 });
    await dialog.getByRole('button', { name: /^done$/i }).click();

    // 5. Verify the merge is reflected: visiting the duplicate's old id redirects to the survivor
    // (AC-C3 — the API returns the tombstoned record with mergedIntoClientId set).
    await page.goto(`/clients/${duplicateId}`);
    await expect(page).toHaveURL(new RegExp(`/clients/${survivorId}$`), { timeout: 15_000 });
    await expect(page.getByText(survivorName)).toBeVisible({ timeout: 15_000 });
  });
});
