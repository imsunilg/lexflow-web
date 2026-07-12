import { expect, test } from '@playwright/test';
import { E2E_PORTAL_CLIENT_ID, loginAsStaffReal } from '../../fixtures/real-auth';

/**
 * PRD §37 flagged journey #22 (Module 9 User Flow 5): the time-approval
 * queue — approve/reject submitted entries (with comment), bulk-select.
 *
 * Deliberate deviation from a literal "submit as user A, approve as user B"
 * flow: `tools/E2eSeed` provisions exactly one login-capable staff user (the
 * "owner" role — see `real-auth.ts`'s own doc comment), so there is no
 * second staff identity available in this environment to submit as one user
 * and approve as another. `TimeEntriesService.approve()`'s own doc comment
 * states the real, server-enforced rule this collides with: "`time.approve`
 * cannot approve own entries (server-enforced segregation, PRD Security
 * Rules)". Rather than fabricate a second identity or skip this journey
 * outright, this test drives the real approval-queue UI (bulk-select,
 * approve, reject-with-comment) against entries this same user submitted,
 * and asserts the real segregation-of-duty error the backend actually
 * returns — which is itself a genuine, working part of Module 9's security
 * model, not a workaround.
 */
test.describe('Journey 22: time approval queue', () => {
  test('the approval queue lists submitted entries and enforces same-user approve/reject segregation', async ({
    page,
  }) => {
    await loginAsStaffReal(page);

    async function createSubmittedEntry(label: string): Promise<string> {
      const matterTitle = `E2E Approval ${label} ${Date.now()}`;
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

      await page.goto('/time/timesheet');
      await page.getByLabel(/add matter/i).fill(matterTitle);
      await page.getByText(matterTitle).first().click();
      // Scope to this matter's own grid row by its label text rather than a
      // numeric row/col index — other journeys' matters may already have
      // entries logged this week in this same seeded tenant, so the row
      // order isn't predictable. Any day column works; the entry date isn't
      // asserted on.
      const timesheetRow = page.locator('.timesheet__row', { hasText: matterTitle });
      await timesheetRow.locator('.timesheet__cell').first().dblclick();
      await page.locator('.timesheet__cell-input').fill('1');
      await page.keyboard.press('Enter');

      await page.goto('/time/entries');
      const row = page.locator('tr', { hasText: matterTitle });
      await expect(row).toBeVisible({ timeout: 15_000 });
      await row.getByRole('button', { name: /^submit$/i }).click();
      await expect(row).toContainText(/submitted/i, { timeout: 15_000 });
      return matterTitle;
    }

    const matterA = await createSubmittedEntry('A');
    const matterB = await createSubmittedEntry('B');

    // 1. Both submitted entries show up in the approval queue.
    await page.goto('/time/approvals');
    const rowA = page.locator('tr', { hasText: matterA });
    const rowB = page.locator('tr', { hasText: matterB });
    await expect(rowA).toBeVisible({ timeout: 15_000 });
    await expect(rowB).toBeVisible({ timeout: 15_000 });

    // 2. Select entry A only and attempt to approve it — the real backend
    // rejects this (403: same-user segregation), and the page surfaces its
    // own documented error copy for exactly that case.
    await rowA.getByRole('checkbox').check();
    await page.getByRole('button', { name: /approve selected/i }).click();
    await expect(page.getByText(/you may not approve your own submitted time/i)).toBeVisible({
      timeout: 15_000,
    });
    // The entry must still be sitting in the queue, unapproved.
    await expect(rowA).toBeVisible();

    // 3. Select entry B and attempt to reject it with a comment. Whether the
    // backend applies the same same-user restriction to rejection isn't
    // documented anywhere in this codebase (only `approve()` carries that
    // comment) — so this observes and reports the real outcome rather than
    // assuming one.
    await rowA.getByRole('checkbox').uncheck();
    await rowB.getByRole('checkbox').check();
    page.once('dialog', (dialog) => dialog.accept('E2E journey 22: rejecting for test coverage.'));
    await page.getByRole('button', { name: /reject selected/i }).click();

    const rejectionError = page.getByText(/could not reject the selected entries/i);
    // Either the error banner appears (blocked, same as approve) or the row
    // simply leaves the queue (rejection succeeded, and `load()` refreshes the
    // list) — poll for whichever real outcome actually happens rather than
    // assuming one.
    let blocked = false;
    await expect
      .poll(
        async () => {
          if (await rejectionError.isVisible()) {
            blocked = true;
            return 'settled';
          }
          if (!(await rowB.isVisible())) {
            blocked = false;
            return 'settled';
          }
          return 'pending';
        },
        { timeout: 15_000, intervals: [500] },
      )
      .toBe('settled');

    if (blocked) {
      test.info().annotations.push({
        type: 'observed-behavior',
        description:
          'Rejecting a self-submitted entry was blocked by the same segregation-of-duty rule as approve().',
      });
      await expect(rowB).toBeVisible();
    } else {
      test.info().annotations.push({
        type: 'observed-behavior',
        description:
          'Rejecting a self-submitted entry succeeded — reject() is not subject to the same same-user restriction as approve().',
      });
      await expect(rowB).not.toBeVisible({ timeout: 15_000 });
    }
  });
});
