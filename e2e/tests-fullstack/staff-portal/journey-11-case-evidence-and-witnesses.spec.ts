import { expect, test } from '@playwright/test';
import { E2E_PORTAL_CLIENT_ID, loginAsStaffReal } from '../../fixtures/real-auth';

/**
 * PRD §37 journey: court case evidence register + witness list (PRD Module
 * 5, AC-CC5). Creates a matter + court case (same "Add court case" dialog
 * pattern as journey 1), then exercises `CaseEvidenceTabComponent` (add an
 * evidence item) and `CaseWitnessesTabComponent` (add a witness) on the case
 * detail page.
 */
test.describe('Journey 11: court case evidence register + witness list', () => {
  test('an evidence item and a witness are added to a court case', async ({ page }) => {
    await loginAsStaffReal(page);

    // 1. Create a matter under the seeded client.
    const matterTitle = `E2E Evidence Matter ${Date.now()}`;
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

    // 3. Add an evidence item on the Evidence tab.
    await page.getByRole('tab', { name: /^evidence$/i }).click();
    const exhibitNo = `EX-${Date.now()}`;
    await page.getByLabel(/exhibit no/i).fill(exhibitNo);
    await page.getByLabel(/^kind$/i).click();
    await page.getByRole('option').first().click();
    await page
      .getByLabel(/description/i)
      .fill('E2E journey: signed contract copy submitted as exhibit.');
    await page.getByRole('button', { name: /add evidence/i }).click();

    await expect(page.getByText(exhibitNo)).toBeVisible({ timeout: 15_000 });

    // 4. Add a witness on the Witnesses tab.
    await page.getByRole('tab', { name: /^witnesses$/i }).click();
    const witnessName = `E2E Witness ${Date.now()}`;
    await page.getByLabel(/^name$/i).fill(witnessName);
    await page.getByLabel(/^side$/i).fill('Petitioner');
    await page.getByRole('button', { name: /add witness/i }).click();

    await expect(page.getByText(witnessName)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Petitioner')).toBeVisible({ timeout: 15_000 });
  });
});
