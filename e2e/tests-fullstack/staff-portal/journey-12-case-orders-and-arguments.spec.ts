import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { E2E_PORTAL_CLIENT_ID, loginAsStaffReal } from '../../fixtures/real-auth';

/**
 * PRD §37 journey: court case orders + arguments (PRD Module 5). Creates a
 * matter + court case (same "Add court case" dialog pattern as journey 1),
 * then exercises `CaseOrdersTabComponent` (upload a court order, a real
 * multipart upload against the backend) and `CaseArgumentsTabComponent` (log
 * an argument note).
 *
 * `CaseArgumentsTabComponent`'s own header comment documents that citation
 * linking to Knowledge Base judgments has no picker UI — `citationJudgmentIds`
 * is always omitted on create — so this journey only exercises the plain
 * stage/body note, not citations.
 */
test.describe('Journey 12: court case orders + arguments', () => {
  test('a court order is uploaded and an argument note is logged', async ({ page }) => {
    await loginAsStaffReal(page);

    // A minimal but structurally valid PDF, built at runtime rather than
    // committed as a binary fixture, for the real multipart upload below.
    const uploadDir = join(tmpdir(), 'lexflow-e2e-fullstack');
    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true });
    }
    const orderFilePath = join(uploadDir, `e2e-order-${Date.now()}.pdf`);
    writeFileSync(
      orderFilePath,
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
        '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
        '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n' +
        'trailer<</Root 1 0 R>>\n%%EOF',
    );

    // 1. Create a matter under the seeded client.
    const matterTitle = `E2E Orders Matter ${Date.now()}`;
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

    // 2. Add a court case under the matter.
    await page.getByRole('tab', { name: /court cases/i }).click();
    await page.getByRole('button', { name: /add court case/i }).click();
    await page.getByLabel(/^court$/i).fill('Delhi High Court');
    await page.getByLabel(/case type/i).fill('Civil Suit');
    await page.getByLabel(/case number/i).fill(`E2E-${Date.now()}`);
    await page.getByLabel(/^year/i).fill(String(new Date().getFullYear()));
    await page.getByRole('button', { name: /add court case/i }).click();
    await expect(page).toHaveURL(/\/matters\/[0-9a-f-]+\/cases\/[0-9a-f-]+$/, { timeout: 15_000 });

    // 3. Upload a court order on the Orders tab.
    await page.getByRole('tab', { name: /^orders$/i }).click();
    const orderDate = new Date();
    orderDate.setDate(orderDate.getDate() - 1); // orderDate rejects future dates
    await page.getByLabel(/order date/i).fill(orderDate.toISOString().slice(0, 10));
    const orderGist = `E2E journey: interim order ${Date.now()}`;
    await page.getByLabel(/^gist$/i).fill(orderGist);
    await page.locator('input[type="file"]').setInputFiles(orderFilePath);
    await expect(page.getByText(/selected:/i)).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: /^upload$/i }).click();

    await expect(page.getByText(orderGist)).toBeVisible({ timeout: 15_000 });

    // 4. Log an argument note on the Arguments tab.
    await page.getByRole('tab', { name: /^arguments$/i }).click();
    await page.getByLabel(/stage/i).fill('Final arguments');
    const argumentBody = `E2E journey: counsel argued limitation does not apply ${Date.now()}.`;
    await page.getByLabel(/^note$/i).fill(argumentBody);
    await page.getByRole('button', { name: /add note/i }).click();

    await expect(page.getByText(argumentBody)).toBeVisible({ timeout: 15_000 });
  });
});
