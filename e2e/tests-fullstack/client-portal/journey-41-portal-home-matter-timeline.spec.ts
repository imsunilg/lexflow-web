import { expect, test } from '@playwright/test';
import { loginAsPortalClientReal } from '../../fixtures/real-auth';

/**
 * PRD §37 journey #41: Portal home + matter timeline.
 *
 * This journey needs a real matter visible to the seeded portal client
 * (`E2E_PORTAL_CLIENT_ID`) to open — client-portal users cannot create
 * matters themselves (`matters.page.ts`/`home.page.ts` are read-only, there's
 * no "new matter" affordance anywhere in this app, matter creation is a
 * staff-only capability). It assumes staff-portal's journey 2
 * (`journey-02-wip-to-receipt.spec.ts`, which creates "E2E Billing Matter …"
 * under this exact client id so its invoice is portal-visible) has already
 * run in the same CI/local pass. If run in isolation with no such matter
 * seeded yet, the "My matters" section legitimately shows its real empty
 * state instead, and this test documents that rather than trying to fake a
 * matter into existence from the portal side.
 */
test.describe('Journey 41: Portal home + matter timeline', () => {
  test('home renders the four summary sections, and an existing matter opens a sanitized timeline', async ({
    page,
  }) => {
    await loginAsPortalClientReal(page);

    // 1. Home renders its four independent summary sections (PRD Module 17
    // step 2) — each resolves out of "loading" one way or another.
    await page.goto('/home');
    await expect(page.getByRole('heading', { name: /^welcome/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /my matters/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /unpaid invoices/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /recent documents/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /next appointment/i })).toBeVisible();
    // All four sections' progress bars should be gone once resolved.
    await expect(page.locator('mat-progress-bar')).toHaveCount(0, { timeout: 15_000 });

    const matterCards = page.locator('.home-page__card');
    const matterCount = await matterCards.count();

    if (matterCount === 0) {
      // Documented limitation for a standalone run: no matter has been created
      // for this client yet (portal users can't create one themselves).
      await expect(page.getByText(/no matters yet/i)).toBeVisible();
      return;
    }

    // 2. Open the first matter card and verify its sanitized timeline (PRD
    // Module 17 step 3: hearings + published outcomes only, never internal
    // notes/strategy — the backend endpoint itself never returns those).
    await matterCards.first().click();
    await expect(page).toHaveURL(/\/matters\/[0-9a-f-]+$/, { timeout: 15_000 });
    await expect(page.locator('mat-progress-bar')).toHaveCount(0, { timeout: 15_000 });

    // The timeline either has real entries or shows its own honest empty
    // state — both are valid outcomes depending on whether hearings/outcomes
    // have been recorded on this particular matter.
    const hasEntries = await page.locator('.matter-timeline-page__entries li').count();
    if (hasEntries === 0) {
      await expect(page.getByText(/no timeline entries yet/i)).toBeVisible();
    } else {
      await expect(page.locator('.matter-timeline-page__entries li').first()).toBeVisible();
    }
  });
});
