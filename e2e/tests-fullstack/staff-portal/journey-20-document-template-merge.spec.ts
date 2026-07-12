import { expect, test } from '@playwright/test';
import { E2E_PORTAL_CLIENT_ID, loginAsStaffReal } from '../../fixtures/real-auth';

/**
 * PRD §37 flagged journey #20 (Module 7 User Flow 5): browse the firm
 * template gallery, pick a template, and generate a document from it against
 * a real matter via the merge wizard.
 *
 * The template gallery's contents depend entirely on what `tools/E2eSeed` (or
 * whatever else has run against this tenant) has put in the firm's template
 * library — there is no template-creation UI reachable from this journey's
 * scope, and fabricating one here would test made-up data, not the real
 * merge pipeline. If the gallery is empty, this test skips with a clear
 * reason instead of asserting against a template that doesn't exist in this
 * environment.
 */
test.describe('Journey 20: document template gallery + merge wizard', () => {
  test('a document is generated from the firm template gallery into a real matter', async ({
    page,
  }) => {
    await loginAsStaffReal(page);

    // 1. Create a matter to generate the document into.
    const matterTitle = `E2E Template Matter ${Date.now()}`;
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

    // 2. Open the template gallery from the Documents Explorer.
    await page.goto('/documents');
    await page.getByRole('button', { name: /from template/i }).click();
    await expect(page.getByRole('heading', { name: /template gallery/i })).toBeVisible();

    const emptyState = page.getByText(/no templates yet/i);
    const galleryCards = page.locator('.lf-gallery-card');

    // Wait for either the empty state or at least one card to resolve (the
    // dialog starts in a loading spinner state).
    await expect(emptyState.or(galleryCards.first())).toBeVisible({ timeout: 15_000 });

    if (await emptyState.isVisible()) {
      test.skip(
        true,
        'Firm template library is empty in this environment — no seeded merge template exists to generate from (see file header comment).',
      );
      return;
    }

    // 3. Pick the first template and fill in the merge wizard's dynamic fields.
    await galleryCards.first().click();
    await expect(page.getByRole('heading', { name: /^generate/i })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByPlaceholder(/search matters by number or title/i).fill(matterTitle);
    await page.getByText(matterTitle).first().click();

    // Every template field after the matter autocomplete is a plain text
    // input inside its own mat-form-field, whatever the template's real
    // (dynamic, per-firm) field set happens to be — filled generically
    // rather than guessing specific field names/labels that this journey
    // has no way to know ahead of time.
    const fieldInputs = page.locator('.lf-merge-step mat-form-field input');
    const fieldCount = await fieldInputs.count();
    for (let i = 1; i < fieldCount; i++) {
      await fieldInputs.nth(i).fill('E2E merge value');
    }

    await page.getByRole('button', { name: /^next$/i }).click();
    await page.getByRole('button', { name: /^generate$/i }).click();

    // 4. A successful merge closes the dialog and refreshes the explorer's
    // document list with the newly generated draft document.
    await expect(page.getByRole('heading', { name: /^generate/i })).not.toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('.lf-merge-error')).toHaveCount(0);
  });
});
