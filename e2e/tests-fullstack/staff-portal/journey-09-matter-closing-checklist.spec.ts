import { expect, test } from '@playwright/test';
import { E2E_PORTAL_CLIENT_ID, loginAsStaffReal } from '../../fixtures/real-auth';

/**
 * PRD §37 journey: matter closing checklist (PRD Module 4 User Flow step 5,
 * AC-M3). Exercises `ClosingChecklistDialogComponent` end to end against the
 * real backend's `changeStatus` endpoint.
 *
 * Documented gap this journey works around, per the dialog's own header
 * comment: only 2 of the checklist's 4 items are actually server-enforced
 * today (the closure note and running-timers via 409 `TIMERS_RUNNING`) — the
 * unbilled-time (WIP) and trust-balance items have no backend gate at all, so
 * they only render as extra checklist rows when `financial-summary` reports a
 * nonzero `wip`/`trustBalance`. A brand-new matter with no time/trust activity
 * has both at zero, so those rows never render and this journey doesn't
 * exercise them — it sticks to the two items that are real: "no running
 * timers" and the required closure note, then verifies the real status
 * transition to Closed.
 */
test.describe('Journey 9: matter closing checklist', () => {
  test('a matter is closed via the checklist dialog and its status reflects Closed', async ({
    page,
  }) => {
    await loginAsStaffReal(page);

    // 1. Create a matter under the seeded client.
    const matterTitle = `E2E Closing Matter ${Date.now()}`;
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

    // Matter starts life as 'Open' (confirmed via the workspace header status chip).
    await expect(page.getByText('Open', { exact: true })).toBeVisible({ timeout: 15_000 });

    // 2. Open the closing checklist from the workspace header.
    await page.getByRole('button', { name: /close matter/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // 3. Complete the two real checklist items: no running timers + closure note.
    await dialog.getByRole('checkbox', { name: /no running timers/i }).check();

    await dialog.getByLabel(/^outcome$/i).click();
    await page.getByRole('option', { name: /^won$/i }).click();

    await dialog
      .getByLabel(/closure summary note/i)
      .fill('E2E journey: matter concluded successfully, all deliverables complete.');

    // 4. Close the matter — real round-trip through MattersService.changeStatus.
    await dialog.getByRole('button', { name: /close matter/i }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });

    // 5. Verify the workspace now reflects the Closed status (and offers Reopen,
    // confirming the server-side status actually changed, not just optimistic UI).
    await expect(page.getByText('Closed', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /reopen/i })).toBeVisible({ timeout: 15_000 });
  });
});
