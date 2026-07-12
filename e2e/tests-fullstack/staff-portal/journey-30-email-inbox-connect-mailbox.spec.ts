import { expect, test } from '@playwright/test';
import { loginAsStaffReal } from '../../fixtures/real-auth';

/**
 * PRD §37 flagged journey #30: email inbox — connect a mailbox, then check
 * the inbox/thread view renders.
 *
 * Documented, unavoidable OAuth boundary (see this repo's
 * `connect-mailbox-dialog.component.ts` doc comment and the backend's
 * `EmailCommands.cs`/`GmailSyncService.cs`): step 1 ("Get authorization
 * link") is a genuine, real call to `POST /comm/email/accounts/connect` and
 * really does build+return a real `accounts.google.com` authorize URL — the
 * server builds it unconditionally, even with an empty `client_id` when no
 * Gmail/Microsoft OAuth client is configured for the tenant (which is this
 * environment's default/seeded state). Step 2, however, needs a real `code`
 * query-param value that only a real Google/Microsoft consent screen can
 * mint, which this suite cannot drive without live provider credentials —
 * so this journey verifies step 1 for real, then verifies that step 2 with a
 * necessarily-fake code fails through the app's own real, honest error path
 * (a real token-exchange call that really gets rejected), rather than
 * pretending a mailbox got connected. No `test.skip()`/env-var gate is used
 * here because there is no seeded/creatable credential that would ever let
 * this pass — unlike journey-02's Razorpay gate, this isn't a "set an env var
 * and it works" boundary.
 */
test.describe('Journey 30: email inbox — connect a mailbox (real UI, no live OAuth) + inbox renders', () => {
  test('the connect-mailbox dialog builds a real authorize link and the inbox renders honestly with zero mailboxes', async ({
    page,
  }) => {
    await loginAsStaffReal(page);
    await page.goto('/communication/inbox');

    // 1. The three-pane inbox itself renders, with zero known mailboxes (a
    // fresh browser profile — `MailboxRegistryService` is per-browser
    // localStorage, not server state).
    await expect(page.getByRole('button', { name: /new email/i })).toBeVisible();
    await expect(page.getByText(/known mailboxes/i)).toBeVisible();
    await expect(page.getByText(/none yet\./i)).toBeVisible();
    await expect(page.getByRole('button', { name: /connect mailbox/i })).toBeVisible();

    // 2. Open the connect-mailbox dialog and drive step 1 for real.
    await page.getByRole('button', { name: /connect mailbox/i }).click();
    await expect(page.getByRole('heading', { name: /connect a mailbox/i })).toBeVisible();
    await expect(page.getByText(/step 1: choose a provider/i)).toBeVisible();

    // Redirect URI is prefilled from the real page origin.
    const redirectUriField = page.getByLabel(/redirect uri/i);
    await expect(redirectUriField).toHaveValue(/\/communication\/inbox$/);

    // Provider select defaults to Gmail; leave it there.
    await expect(page.getByLabel(/^provider$/i)).toBeVisible();

    const connectResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/comm/email/accounts/connect') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /get authorization link/i }).click();
    const connectApiResponse = await connectResponse;
    // Real call, real 200 — the server builds an authorize URL unconditionally
    // (see file header comment), it just carries an empty client_id here.
    expect(connectApiResponse.ok()).toBeTruthy();

    // 3. Step 2 renders with the real authorize link and asks for the code.
    await expect(page.getByText(/step 2: open the link below/i)).toBeVisible();
    const authLink = page.locator('.connect-mailbox__link');
    await expect(authLink).toBeVisible();
    await expect(authLink).toHaveAttribute('href', /accounts\.google\.com/);

    // 4. Complete connection with a necessarily-fake code — a real call to
    // the callback endpoint, which really attempts (and fails) a live token
    // exchange. Assert the app's own real, honest rejection path.
    await page.getByLabel(/authorization code/i).fill('e2e-fake-code-cannot-be-real');
    await page.getByLabel(/label for this mailbox/i).fill('E2E Test Mailbox');
    await page.getByRole('button', { name: /complete connection/i }).click();
    await expect(page.getByText(/that code was rejected/i)).toBeVisible({ timeout: 30_000 });

    // 5. Close the dialog without a mailbox ever having been connected.
    await page.getByRole('button', { name: /^cancel$/i }).click();
    await expect(page.getByRole('heading', { name: /connect a mailbox/i })).not.toBeVisible();

    // 6. The inbox still honestly shows zero mailboxes and zero threads —
    // nothing in this environment can ever produce a thread without a real,
    // successfully connected mailbox.
    await expect(page.getByText(/none yet\./i)).toBeVisible();
    await expect(page.getByText(/no threads/i)).toBeVisible({ timeout: 15_000 });
  });
});
