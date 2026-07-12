import { expect, test } from '@playwright/test';
import { loginAsStaffReal } from '../../fixtures/real-auth';

/**
 * PRD §37 flagged journey #16: calendar sync settings (`calendar/settings`,
 * `CALENDAR_ROUTES` in `calendar.routes.ts`) — the Sync tab
 * (`calendar/settings/sync-settings-tab.component.ts`, PRD Module 6 UI
 * Components' "sync-settings page (account connect, direction, privacy
 * level)").
 *
 * Deliberately out of scope: completing a real Google/Microsoft OAuth
 * handshake. There's no real test Google/Microsoft account wired up in this
 * environment, and `connect()` opens the provider's real authorize URL via
 * `window.open` — this journey only confirms that click actually fires (a
 * popup opens against the real backend's `POST
 * /calendar/sync/{provider}/connect`) without following the redirect or
 * completing sign-in. It also confirms the tab's own documented gap: per the
 * component's doc comment, there's no accounts-listing endpoint yet, so
 * "Disconnect" is permanently disabled here (no `accountId` to call with) —
 * this journey asserts that disabled state rather than working around it.
 */
test.describe('Journey 16: calendar sync settings', () => {
  test('the sync-settings tab renders Google/Microsoft connect controls and starting a connection opens a real popup', async ({
    page,
  }) => {
    await loginAsStaffReal(page);

    await page.goto('/calendar/settings');
    await expect(page.getByRole('heading', { name: /calendar settings/i })).toBeVisible({
      timeout: 15_000,
    });

    // The Sync tab is the first tab and active by default.
    await expect(page.getByRole('tab', { name: /^sync$/i })).toBeVisible();

    // Both provider cards render.
    await expect(page.getByText('Google Calendar')).toBeVisible();
    await expect(page.getByText('Microsoft 365')).toBeVisible();

    // Disconnect is honestly disabled for both providers (no accounts-listing endpoint exists
    // yet to resolve an accountId to disconnect — see the component's own doc comment).
    const disconnectButtons = page.getByRole('button', { name: /disconnect/i });
    await expect(disconnectButtons).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      await expect(disconnectButtons.nth(i)).toBeDisabled();
    }

    // The privacy-level radio group (client-side-only preference) renders and is clickable.
    await page.getByRole('radio', { name: /full detail/i }).click();
    await page.getByRole('radio', { name: /free\/busy only/i }).click();

    // Starting a connection against the real backend opens a real popup (the actual OAuth
    // redirect) — verify the click is wired up and a popup opens, then close it without
    // following the redirect or completing sign-in (out of scope, no test IdP account here).
    const connectButtons = page.getByRole('button', { name: /^connect$/i });
    await expect(connectButtons).toHaveCount(2);

    const [popup] = await Promise.all([page.waitForEvent('popup'), connectButtons.first().click()]);
    expect(popup).toBeTruthy();
    await popup.close();

    // No client-side error banner should have appeared — the connect call itself succeeded.
    await expect(page.getByText(/couldn't start the/i)).not.toBeVisible();
  });
});
