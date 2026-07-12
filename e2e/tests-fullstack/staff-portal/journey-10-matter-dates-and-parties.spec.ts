import { expect, test } from '@playwright/test';
import { E2E_PORTAL_CLIENT_ID, loginAsStaffReal } from '../../fixtures/real-auth';

/**
 * PRD §37 journey: matter important dates + parties (PRD Module 4).
 * Exercises `ImportantDatesPanelComponent` (lives on the workspace's
 * Overview tab, next to the matter's Details section) and
 * `MatterPartiesTabComponent` (the workspace's own "Parties" tab). Note there
 * are two distinct "parties" tabs in this codebase — `matter-parties-tab`
 * (matter-scoped, `MATTER_PARTY_ROLES` fixed enum) on the matter workspace,
 * and `case-parties-tab` (court-case-scoped, free-text role) on the case
 * detail page. This journey is about the matter-level one per the assignment
 * ("matters/workspace/tabs/matter-parties-tab.component.ts"); journeys 11/12
 * exercise court cases directly and would hit the case-scoped one instead.
 */
test.describe('Journey 10: matter important dates + parties', () => {
  test('a key date and a party are added to a matter', async ({ page }) => {
    await loginAsStaffReal(page);

    // 1. Create a matter under the seeded client.
    const matterTitle = `E2E Dates-Parties Matter ${Date.now()}`;
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

    // 2. Add an important date from the Overview tab's empty state (Overview is
    // the workspace's default active tab, so no tab click is needed first).
    const dateTitle = `E2E Filing Deadline ${Date.now()}`;
    await page.getByRole('button', { name: /add date/i }).click();
    await page.getByLabel(/^kind$/i).click();
    await page.getByRole('option').first().click();
    await page.getByLabel(/^title$/i).fill(dateTitle);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 60); // well outside the 30-day "soon" warning window
    await page.getByLabel(/due date/i).fill(dueDate.toISOString().slice(0, 10));
    await page.getByRole('button', { name: /^save$/i }).click();

    await expect(page.getByText(dateTitle)).toBeVisible({ timeout: 15_000 });

    // 3. Switch to the Parties tab and add a party.
    await page.getByRole('tab', { name: /^parties$/i }).click();
    await page.getByRole('button', { name: /add party/i }).click();
    const partyName = `E2E Party ${Date.now()}`;
    await page.getByLabel(/^name$/i).fill(partyName);
    await page.getByLabel(/^role$/i).click();
    await page.getByRole('option').first().click();
    await page.getByLabel(/advocate name/i).fill('Adv. E2E Counsel');
    await page.getByLabel(/^contact$/i).fill('+919812345678');
    await page.getByRole('button', { name: /add party/i }).click();

    await expect(page.getByText(partyName)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Adv. E2E Counsel')).toBeVisible({ timeout: 15_000 });
  });
});
