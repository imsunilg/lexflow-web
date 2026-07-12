import { expect, test } from '@playwright/test';
import { loginAsStaffReal } from '../../fixtures/real-auth';

/**
 * PRD §37 flagged journey #7: client 360 detail — grant client portal access
 * via `PortalAccessManagerComponent` (`clients/detail/portal-access-manager.component.ts`,
 * PRD Module 3 / §17 multi-user portal model) and verify the grant is
 * reflected in the UI (sticky-header "Portal on" chip + the portal-users
 * list picking up the newly-created `ClientPortalUser` row).
 *
 * Deliberately out of scope: completing the invite-email flow. There is no
 * mailbox in this environment to receive the portal invite, and
 * `resendInvite()`/the real invite-acceptance link aren't exercised here —
 * this journey stops once the grant itself succeeds and is visible, exactly
 * per the task boundary (`SetPortalAccessAsync` on the API side creates the
 * `ClientPortalUser` row with status "Invited"; actually completing that
 * invite is a separate, unwritten journey).
 */
test.describe('Journey 7: client portal-access grant', () => {
  test('enabling portal access on a client is reflected in the header chip and portal-users list', async ({
    page,
  }) => {
    await loginAsStaffReal(page);

    // 1. Create an Individual client with an email (portal access requires one).
    const stamp = Date.now();
    const clientName = `E2E Portal Client ${stamp}`;
    const clientEmail = `portal-grant-${stamp}@e2e.test`;
    await page.goto('/clients/new');
    await page.getByLabel(/first name/i).fill(clientName);
    await page.getByLabel(/last name/i).fill('Journey');
    await page.getByLabel(/^email/i).fill(clientEmail);
    await page.getByLabel(/phone/i).fill('+919812370001');
    await page.getByRole('button', { name: /^next$/i }).click();
    // KYC step: nothing to stage.
    await page.getByRole('button', { name: /^next$/i }).click();
    // Addresses step: Individual clients don't need a staged contact to proceed.
    await page.getByRole('button', { name: /^next$/i }).click();
    // Portal step: leave "Enable client portal access" unchecked here — the
    // component under test is the detail page's manager, not this stepper checkbox.
    await page.getByRole('button', { name: /create client/i }).click();
    await expect(page).toHaveURL(/\/clients\/[0-9a-f-]+$/, { timeout: 15_000 });

    // 2. Confirm the client currently shows portal access as off.
    await expect(page.getByText(/portal off/i)).toBeVisible({ timeout: 15_000 });

    // 3. Open the Portal tab and confirm the manager reflects the disabled state.
    await page.getByRole('tab', { name: /^portal$/i }).click();
    await expect(page.getByText(/portal access is off for this client/i)).toBeVisible({
      timeout: 15_000,
    });

    // 4. Grant portal access via the slide toggle.
    await page.getByRole('switch', { name: /enable portal access/i }).click();

    // 5. Verify the grant is reflected: the sticky header chip flips to "Portal on"...
    await expect(page.getByText(/portal on/i)).toBeVisible({ timeout: 15_000 });
    // ...and the portal-users list now shows the client's own email with an "Invited" status
    // (SetPortalAccessAsync creates the ClientPortalUser row with status "Invited" on first grant).
    await expect(page.getByText(clientEmail)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/invited/i)).toBeVisible({ timeout: 15_000 });

    // Stop here — completing the invite (an email link this environment can't receive) is out of scope.
  });
});
