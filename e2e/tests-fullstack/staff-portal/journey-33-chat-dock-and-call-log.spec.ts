import { expect, test } from '@playwright/test';
import { E2E_PORTAL_CLIENT_ID, loginAsStaffReal } from '../../fixtures/real-auth';

/**
 * PRD §37 flagged journey #33: chat dock + call log — send a matter-scoped
 * chat message via the chat dock, log a call via the real call-log dialog.
 *
 * Documented gap: `ChatService.createChannel()` (a real, working
 * `POST /chat/channels` endpoint) is never called from any component in this
 * app — there is no "new channel" UI anywhere in the Communication module;
 * `ChatDockComponent` only ever *lists* channels that already exist
 * (confirmed: only `chat-dock.component.ts` references `ChatService`, and it
 * never calls `createChannel`). So a matter-scoped chat channel has to exist
 * before the dock can show it. Exactly like journey-02's WIP time-entry-id
 * gap, this journey fills that one missing step with a direct, real,
 * authenticated call to the same real endpoint the app itself would use if
 * it had the UI for it — reusing the real bearer token and user id the app's
 * own requests carry, not a fabricated one. Every step after that (opening
 * the dock, picking the channel, sending, seeing it appear) drives the real UI.
 *
 * Click-to-call is a real Twilio Voice REST integration with no Twilio
 * account configured in this environment — the manual log path is exercised
 * as a full real success, and click-to-call is exercised only up to its
 * real, honest rejection (`VOICE_NOT_CONFIGURED`), per this file's
 * no-live-external-call rule.
 */
test.describe('Journey 33: chat dock (matter-scoped message) + call log (manual + honest click-to-call boundary)', () => {
  test('a matter-scoped chat message is sent and shown via the real chat dock; a call is logged, and click-to-call fails honestly', async ({
    page,
  }) => {
    await loginAsStaffReal(page);

    // 1. Create a real matter to scope the chat channel to.
    const matterTitle = `E2E Chat Matter ${Date.now()}`;
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
    await expect(page).toHaveURL(/\/matters\/([0-9a-f-]+)$/, { timeout: 15_000 });
    const matterId = page.url().match(/\/matters\/([0-9a-f-]+)$/)![1];

    // 2. Capture the real bearer token + current user id from the app's own
    // requests (the chat dock lists channels, and the shell loads the
    // session, on every full navigation) — there is no other way to reach
    // `POST /chat/channels` without a UI for it (see file header comment).
    const meResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/auth/me') && response.request().method() === 'GET',
    );
    const channelsRequestPromise = page.waitForRequest(
      (request) =>
        request.url().includes('/api/v1/chat/channels') &&
        !request.url().includes('/messages') &&
        request.method() === 'GET',
    );
    await Promise.all([
      meResponsePromise,
      channelsRequestPromise,
      page.goto('/communication/calls'),
    ]);
    const meResponse = await meResponsePromise;
    const channelsRequest = await channelsRequestPromise;
    const currentUserId: string = (await meResponse.json()).data.id;
    const bearerToken = channelsRequest.headers()['authorization'];
    expect(bearerToken).toBeTruthy();

    // 3. Create the matter-scoped channel via a real, authenticated call to
    // the real endpoint (the same one `ChatService.createChannel()` would hit).
    const channelName = `E2E Chat ${matterId.slice(0, 8)}`;
    const createChannelResponse = await page.request.post('/api/v1/chat/channels', {
      headers: { Authorization: bearerToken },
      data: { kind: 'Matter', name: channelName, matterId, memberUserIds: [currentUserId] },
    });
    expect(createChannelResponse.ok()).toBeTruthy();

    // 4. Reload so the real chat dock (mounted in the shell) lists the new channel for real.
    await page.reload();
    await page.locator('.chat-dock__toggle').click();
    await page.getByRole('button', { name: channelName }).click();
    await expect(page.getByText(/pick a channel to start chatting/i)).not.toBeVisible();

    const chatMessageText = `E2E journey: chat message scoped to ${matterTitle}.`;
    await page.getByPlaceholder(/message…/i).fill(chatMessageText);
    await page.getByPlaceholder(/message…/i).press('Enter');
    await expect(page.locator('.chat-dock__message', { hasText: chatMessageText })).toBeVisible({
      timeout: 15_000,
    });

    // 5. Log a call for the seeded portal client via the real Manual log tab.
    await page.getByLabel(/^client$/i).fill('Portal Client');
    await page
      .getByRole('option', { name: /portal client/i })
      .first()
      .click();
    await expect(page.getByText(/no calls logged for this client yet/i)).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole('button', { name: /log \/ click-to-call/i }).click();
    await expect(page.getByRole('heading', { name: /log a call/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /manual log/i })).toBeVisible();

    await page.getByLabel(/duration \(seconds\)/i).fill('180');
    await page
      .getByLabel(/^summary$/i)
      .fill('E2E journey: discussed case status and next steps with the client.');
    await page.getByRole('button', { name: /save log/i }).click();
    await expect(page.getByRole('heading', { name: /log a call/i })).not.toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/discussed case status and next steps/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/outbound · 180s/i)).toBeVisible();

    // 6. Click-to-call: a real Twilio Voice REST call attempt, honestly
    // rejected because no Twilio Voice gateway is configured in this
    // environment (confirmed server-side: `CallService.cs`'s
    // `VOICE_NOT_CONFIGURED` check runs before any Twilio API call is made).
    await page.getByRole('button', { name: /log \/ click-to-call/i }).click();
    await page.getByRole('tab', { name: /click to call/i }).click();
    await page.getByLabel(/number to call/i).fill('+919999999999');

    const clickToCallResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/comm/calls/click-to-call') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /call now/i }).click();
    const clickToCallApiResponse = await clickToCallResponse;
    expect(clickToCallApiResponse.status()).toBe(422);
    await expect(
      page.getByText(/call failed — check the twilio voice gateway is configured/i),
    ).toBeVisible();

    await page.getByRole('button', { name: /^close$/i }).click();
  });
});
