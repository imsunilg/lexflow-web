import { expect, test } from '@playwright/test';
import { E2E_PORTAL_CLIENT_ID, loginAsStaffReal } from '../../fixtures/real-auth';

/**
 * PRD §37 journey: cause list day view (PRD Module 5 UI Components, AC-CC2):
 * "all firm hearings for a date, grouped by court, printable." Schedules a
 * hearing for today (so it shows up on `CauseListPage`'s default date without
 * navigating the date picker), then verifies it renders in the correct group
 * and that the printable trigger works.
 *
 * Documented gap this journey works around, per `CauseListPage`'s own header
 * comment: `HearingDto` carries no court reference (no join to
 * `court_cases`/`courts` is exposed), so the page groups by `courtroom`
 * (free text on the hearing itself) instead of by court — this journey
 * asserts on that real `courtroom` grouping, not a "court" grouping that
 * doesn't exist in the API.
 */
test.describe('Journey 13: cause list day view', () => {
  test('a hearing scheduled for today appears on the cause list, grouped by courtroom, and the printable view is reachable', async ({
    page,
  }) => {
    await loginAsStaffReal(page);

    // 1. Create a matter + court case under the seeded client.
    const matterTitle = `E2E Cause List Matter ${Date.now()}`;
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

    await page.getByRole('tab', { name: /court cases/i }).click();
    await page.getByRole('button', { name: /add court case/i }).click();
    await page.getByLabel(/^court$/i).fill('Delhi High Court');
    await page.getByLabel(/case type/i).fill('Civil Suit');
    await page.getByLabel(/case number/i).fill(`E2E-${Date.now()}`);
    await page.getByLabel(/^year/i).fill(String(new Date().getFullYear()));
    await page.getByRole('button', { name: /add court case/i }).click();
    await expect(page).toHaveURL(/\/matters\/[0-9a-f-]+\/cases\/[0-9a-f-]+$/, { timeout: 15_000 });

    // 2. Schedule a hearing for TODAY, with a distinct courtroom to assert on.
    const courtroom = `E2E Courtroom ${Date.now()}`;
    const todayIso = new Date().toISOString().slice(0, 10);
    await page.getByRole('tab', { name: /hearings/i }).click();
    await page.getByLabel(/^date$/i).fill(todayIso);
    await page.getByLabel(/^time$/i).fill('11:00');
    await page.getByLabel(/purpose/i).fill('Cause list E2E check');
    await page.getByLabel(/courtroom/i).fill(courtroom);
    await page.getByRole('button', { name: /schedule hearing/i }).click();
    await expect(page.getByText(todayIso)).toBeVisible({ timeout: 15_000 });

    // 3. Open the firm-wide cause list for today (its own default date) and
    // confirm the hearing shows up under its courtroom group.
    await page.goto('/matters/cause-list');
    await expect(page.getByRole('heading', { name: courtroom })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Cause list E2E check')).toBeVisible({ timeout: 15_000 });

    // 4. Confirm the printable trigger is present and clickable (this app calls
    // `window.print()` directly — no in-app print-preview dialog to assert on
    // — so this only verifies the trigger works without erroring).
    await page.getByRole('button', { name: /print/i }).click();
  });
});
