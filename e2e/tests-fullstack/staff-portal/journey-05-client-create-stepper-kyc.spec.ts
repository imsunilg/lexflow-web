import { expect, test } from '@playwright/test';
import { loginAsStaffReal } from '../../fixtures/real-auth';

/**
 * PRD §37 flagged journey #5: client create stepper (Basic -> KYC ->
 * Addresses -> Portal) end-to-end, then a real KYC document upload.
 *
 * Documented, pre-existing gap (per `ClientCreateStepperPage`'s own header
 * comment): the stepper's KYC step only stages planned *document metadata*
 * (kind/number/expiry) client-side — there's no "create client with
 * documents" endpoint, and the identity-document *file* upload endpoint needs
 * a real `clientId` that doesn't exist yet mid-wizard. The stepper's own KYC
 * step copy says as much ("You'll upload the actual identity document files
 * after the client is created..."). So this journey stages a planned document
 * in the wizard (exercising that real staging UI), then performs the actual
 * file upload afterwards on the client detail page's KYC section
 * (`KycDocumentManagerComponent`), which is where file upload really is
 * wired up end-to-end.
 */
test.describe('Journey 5: client create stepper end-to-end with KYC document upload', () => {
  test('a new client is created via the stepper and a real KYC document is uploaded on its detail page', async ({
    page,
  }) => {
    await loginAsStaffReal(page);

    const clientName = `E2E Client ${Date.now()}`;
    const email = `${clientName.replace(/\s+/g, '-').toLowerCase()}@e2e.test`;

    // 1. Basic step.
    await page.goto('/clients/new');
    await page.getByLabel(/first name/i).fill(clientName);
    await page.getByLabel(/last name/i).fill('Journey');
    await page.getByLabel(/^email/i).fill(email);
    await page.getByLabel(/phone/i).fill('+919812350001');
    await page.getByRole('button', { name: /^next$/i }).click();

    // 2. KYC step: stage a planned identity document (metadata only — see file header comment).
    await page.getByLabel(/document number/i).fill(`PAN-${Date.now()}`);
    await page.getByRole('button', { name: /add document/i }).click();
    await expect(page.getByText(/PAN —/i)).toBeVisible();
    await page.getByRole('button', { name: /^next$/i }).click();

    // 3. Addresses step: add one address.
    await page.getByLabel(/^line 1$/i).fill('221B Baker Street');
    await page.getByLabel(/^city$/i).fill('Mumbai');
    await page.getByRole('button', { name: /add address/i }).click();
    await expect(page.getByText(/Registered — 221B Baker Street/i)).toBeVisible();
    await page.getByRole('button', { name: /^next$/i }).click();

    // 4. Portal step: enable portal access (email is present, so the checkbox is enabled).
    await page.getByLabel(/enable client portal access/i).check();
    await page.getByRole('button', { name: /create client/i }).click();

    await expect(page).toHaveURL(/\/clients\/[0-9a-f-]+$/, { timeout: 15_000 });

    // 5. On the detail page's Overview tab, perform the real KYC document file upload.
    const kycSection = page.locator('.kyc-manager');
    await kycSection.getByLabel(/document number/i).fill(`PAN-${Date.now()}`);
    await kycSection.locator('input[type="file"]').setInputFiles({
      name: 'e2e-kyc-doc.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 E2E journey test identity document.'),
    });
    await expect(kycSection.getByText(/selected: e2e-kyc-doc\.pdf/i)).toBeVisible();
    await kycSection.getByRole('button', { name: /^upload$/i }).click();
    // Scope to the uploaded document card specifically — "PAN" also appears as
    // the (unrelated) selected value in the doc-kind dropdown trigger.
    await expect(kycSection.locator('.kyc-manager__doc-kind', { hasText: 'PAN' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(kycSection.locator('.kyc-manager__last4')).toBeVisible({ timeout: 15_000 });

    // 6. The new client shows up in the clients list.
    await page.goto('/clients/list');
    await page.getByLabel(/^search$/i).fill(clientName);
    await expect(page.getByText(clientName)).toBeVisible({ timeout: 15_000 });
  });
});
