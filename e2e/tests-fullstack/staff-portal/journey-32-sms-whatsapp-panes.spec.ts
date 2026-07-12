import { expect, test } from '@playwright/test';
import { loginAsStaffReal } from '../../fixtures/real-auth';

/**
 * PRD §37 flagged journey #32: SMS + WhatsApp panes — send a message to a
 * client via each pane, asserting the app's own real, honest behavior.
 *
 * Neither pane has a live MSG91/Twilio SMS gateway nor a live WhatsApp
 * Business Cloud API credential configured in this environment (confirmed:
 * `SmsService.cs` and `WhatsAppService.cs` server-side), and this repo's own
 * `Scripts/08_Comm/CommTemplates` seed folder is empty — zero SMS/WhatsApp
 * templates exist in the seeded tenant. So:
 *   - SMS: the template picker can only ever be empty ("None — write
 *     freeform"), which is the pane's own real DLT warning path. A real
 *     freeform send genuinely reaches the backend and genuinely 422s —
 *     confirmed server-side (`SmsService.cs`) that the gateway-configured
 *     check runs *before* the DLT check, so the real, observed error is
 *     `SMS_NOT_CONFIGURED` ("No SMS gateway is configured and enabled for
 *     this tenant."), not `DLT_TEMPLATE_REQUIRED` — this journey asserts the
 *     error that's actually reachable, not the one the frontend's DLT
 *     warning copy might suggest.
 *   - WhatsApp: recording an opt-in is a genuine, real local DB write with
 *     zero external dependency (`WhatsAppService.OptInAsync` never calls a
 *     provider) and is asserted as a real success. Sending a message,
 *     however, needs either a template (none seeded) or an open 24h session
 *     window (which requires a real *inbound* message this suite has no way
 *     to simulate without a live WhatsApp webhook) — so the session composer
 *     is asserted as honestly disabled, not faked into "sent."
 *
 * No `test.skip()` gate is used: none of this is behind a missing env var
 * that could plausibly be set to unlock it in this environment — it's a
 * structural gap (no template seed, no inbound-webhook simulator), not a
 * credential the project could realistically provide.
 */
test.describe('Journey 32: SMS + WhatsApp panes — honest send behavior for a real client', () => {
  test('SMS freeform send genuinely 422s (no gateway); WhatsApp opt-in is a real write and session send is honestly gated', async ({
    page,
  }) => {
    await loginAsStaffReal(page);

    // ---- SMS pane ----
    await page.goto('/communication/sms');
    await expect(page.getByText(/pick a client to see sms history/i)).toBeVisible();

    await page.getByLabel(/^client$/i).fill('Portal Client');
    await page
      .getByRole('option', { name: /portal client/i })
      .first()
      .click();
    await expect(page.getByText(/no sms messages for this client yet/i)).toBeVisible({
      timeout: 15_000,
    });

    // No SMS templates are seeded — the picker only ever offers freeform,
    // which surfaces the pane's own real DLT warning.
    await expect(page.getByText(/freeform sends may be rejected/i)).toBeVisible();

    await page.getByLabel(/to number/i).fill('+919999999999');
    await page.getByLabel(/^body$/i).fill('E2E journey: SMS reminder about your upcoming hearing.');

    const smsSendResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/comm/sms/send') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /^send$/i }).click();
    const smsResponse = await smsSendResponse;
    // Real backend call, real 422 — the gateway-configured check runs before
    // the DLT check (see file header), so this is the error that's actually reachable.
    expect(smsResponse.status()).toBe(422);
    await expect(page.getByText(/no sms gateway is configured/i)).toBeVisible();

    // ---- WhatsApp pane ----
    await page.goto('/communication/whatsapp');
    await expect(page.getByText(/pick a client to see whatsapp history/i)).toBeVisible();

    await page.getByLabel(/^client$/i).fill('Portal Client');
    await page
      .getByRole('option', { name: /portal client/i })
      .first()
      .click();
    await expect(page.getByText(/no whatsapp messages for this client yet/i)).toBeVisible({
      timeout: 15_000,
    });

    // Record opt-in is a real, live DB write with zero external dependency —
    // drive the native `window.prompt()` it uses and assert the real success.
    page.once('dialog', (dialog) => dialog.accept('+919999999999'));
    await page.getByRole('button', { name: /record opt-in/i }).click();
    await expect(page.getByText(/opt-in recorded\./i)).toBeVisible({ timeout: 15_000 });

    // No WhatsApp templates are seeded either, so the composer only ever
    // shows the session-message form — and with no inbound message ever
    // received in this environment, the 24h session window can never open.
    await expect(page.getByText(/session window closed/i)).toBeVisible();
    await expect(
      page.getByText(/no open session window — freeform session messages aren't allowed/i),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /send session message/i })).toBeDisabled();
    await expect(page.getByLabel(/session message/i)).toBeDisabled();

    // Opt-out is likewise a real, live DB write — assert it too, since it's fully reachable.
    await page.getByRole('button', { name: /^opt out$/i }).click();
    await expect(page.getByText(/client opted out\./i)).toBeVisible({ timeout: 15_000 });
  });
});
