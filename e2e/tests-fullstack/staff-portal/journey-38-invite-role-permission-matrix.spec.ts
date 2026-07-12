import { expect, test } from '@playwright/test';
import { loginAsStaffReal } from '../../fixtures/real-auth';

/**
 * PRD §37 journey #38: Admin -> invite user, assign role, verify permission matrix.
 *
 * `POST /users/invite` issues a real 72h activation token but there is no real
 * mailbox in this environment to receive/click it (see
 * `invite-user-dialog.component.ts`'s own doc comment) — so the invited user
 * necessarily lands in a pending/not-yet-activated status rather than
 * "Active". This journey asserts on that honest status instead of pretending
 * the user is immediately usable.
 *
 * Role assignment happens AT invite time (the invite dialog's own "Role"
 * select) — there is no separate "assign role to an existing user" control
 * anywhere in the admin UI (`user-detail.page.ts` has no role field at all).
 * So this journey creates a fresh custom role with one deliberately
 * identifiable permission via the real role builder, invites a user against
 * that role, then opens the permission-matrix viewer and checks the new
 * role's column shows exactly that permission checked and nothing else in
 * that row set incorrectly.
 */
test.describe('Journey 38: Admin invite user, assign role, verify permission matrix', () => {
  test('a new custom role, an invited user on it, and the permission matrix agree', async ({
    page,
  }) => {
    await loginAsStaffReal(page);

    // 1. Create a fresh custom role with exactly one permission checked, so the
    // matrix assertion later has an unambiguous, unique signal to look for.
    const roleKey = `e2e-role-${Date.now()}`;
    const roleName = `E2E Role ${Date.now()}`;
    await page.goto('/admin/roles');
    await page.getByRole('button', { name: /new custom role/i }).click();
    await page.getByLabel(/^key$/i).fill(roleKey);
    await page.getByLabel(/^name$/i).fill(roleName);
    // Pick the first permission checkbox offered by the catalog — its exact
    // key varies by seed data, so this doesn't assume a specific one exists.
    await page.getByRole('checkbox').first().click();
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByText(roleName)).toBeVisible({ timeout: 15_000 });

    // 2. Invite a new user assigned to that role.
    const inviteEmail = `e2e-invite-${Date.now()}@e2e.test`;
    await page.goto('/admin/users');
    await page.getByRole('button', { name: /invite user/i }).click();
    await page.getByLabel(/^name$/i).fill('E2E Invited User');
    await page.getByLabel(/^email$/i).fill(inviteEmail);
    await page.getByLabel(/^role$/i).click();
    await page.getByRole('option', { name: roleName }).click();
    await page.getByRole('button', { name: /send invitation/i }).click();
    await expect(page.getByText(new RegExp(`invitation sent to ${inviteEmail}`, 'i'))).toBeVisible({
      timeout: 15_000,
    });

    // 3. Open the newly invited user and confirm they landed in the real
    // "Invited" status (`USER_STATUSES` in `user-management.models.ts`) —
    // never "Active", since there's no real mailbox to complete activation.
    await page.getByText(inviteEmail).first().click();
    await expect(page).toHaveURL(/\/admin\/users\/[0-9a-f-]+$/);
    await expect(page.getByText(inviteEmail)).toBeVisible();
    await expect(page.getByText(/invited/i)).toBeVisible({ timeout: 15_000 });

    // 4. Open the permission matrix and verify the new role's column shows
    // exactly the one permission granted at role-creation time.
    await page.goto('/admin/roles/matrix');
    await expect(page.getByRole('columnheader', { name: roleName })).toBeVisible({
      timeout: 15_000,
    });
    // The role's column should contain exactly one checked cell (the
    // permission picked in step 1) among the matrix's rows.
    const roleColumnIndex = await page
      .locator('.permission-matrix__table thead th')
      .allTextContents()
      .then((headers) => headers.findIndex((h) => h.trim() === roleName));
    expect(roleColumnIndex).toBeGreaterThan(0);
    const checkedCellsForRole = page
      .locator('.permission-matrix__table tbody tr')
      .locator(`td:nth-child(${roleColumnIndex + 1}) mat-icon.permission-matrix__yes`);
    await expect(checkedCellsForRole).toHaveCount(1, { timeout: 15_000 });
  });
});
