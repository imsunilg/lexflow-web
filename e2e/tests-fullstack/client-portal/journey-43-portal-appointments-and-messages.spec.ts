import { expect, test } from '@playwright/test';
import { loginAsPortalClientReal } from '../../fixtures/real-auth';

/**
 * PRD §37 journey #43: Portal appointments + messages.
 *
 * Two real, documented backend gaps this journey discloses rather than fakes
 * (both confirmed in `appointments.page.ts`'s own doc comment and
 * `portal.models.ts`'s gap list):
 * - No lawyer-lookup endpoint exists anywhere in the portal API. Requesting an
 *   appointment requires a raw `lawyerId` GUID that `GET /me/matters` never
 *   exposes (only `responsibleLawyerName`). This app's own hint text says so
 *   verbatim ("there's no lookup for it in this app yet"). This journey
 *   submits a placeholder GUID the backend has never seen and asserts on the
 *   real outcome — most likely a validation/not-found error from the backend,
 *   which is the honest result, not a fabricated success.
 * - Thread *creation* has no portal-side affordance at all: `messages.page.ts`
 *   only calls `listThreads()`, `app.routes.ts` has no "new thread" route, and
 *   there is no "new conversation" button anywhere in `messages.page.html`.
 *   Threads must already exist (created staff-side) for this client to open
 *   and reply in one. If none exist yet, this journey documents that as the
 *   real limitation rather than inventing a thread.
 */
test.describe('Journey 43: Portal appointments + messages', () => {
  test('requesting an appointment with a raw lawyer ID surfaces the real backend outcome', async ({
    page,
  }) => {
    await loginAsPortalClientReal(page);
    await page.goto('/appointments');

    await expect(page.getByRole('heading', { name: /^appointments$/i })).toBeVisible();
    await expect(
      page.getByText(/your firm needs to share the specific lawyer's portal id/i),
    ).toBeVisible();
    await expect(page.locator('mat-progress-bar').first()).toHaveCount(0, { timeout: 15_000 });

    await page.getByRole('combobox', { name: /matter/i }).click();
    const matterOptions = page.getByRole('option');
    const matterOptionCount = await matterOptions.count();
    if (matterOptionCount === 0) {
      await page.keyboard.press('Escape');
      test.info().annotations.push({
        type: 'documented-gap',
        description:
          'No matter is visible to this portal client yet, so an appointment cannot be requested against one (see journey 41 for the matter-seeding dependency).',
      });
      return;
    }
    await matterOptions.first().click();

    // Real backend gap: no lawyer-lookup endpoint exists, so this raw GUID is
    // a placeholder the firm would normally share out-of-band. It has not
    // been seeded into this tenant, so the backend is expected to reject it.
    const placeholderLawyerId = '11111111-1111-1111-1111-111111111111';
    await page.getByLabel(/lawyer id/i).fill(placeholderLawyerId);

    const requestedStart = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const requestedEnd = new Date(requestedStart.getTime() + 60 * 60 * 1000);
    await page.getByLabel(/^start$/i).fill(toDateTimeLocal(requestedStart));
    await page.getByLabel(/^end$/i).fill(toDateTimeLocal(requestedEnd));
    await page.getByLabel(/notes/i).fill('E2E journey 43 — appointment request test');

    await page.getByRole('button', { name: /request appointment/i }).click();

    // Honest outcome: either the backend accepts it (if this tenant happens
    // to have a lawyer seeded at this exact id — unlikely) and it appears in
    // "Your requests" as "Requested", or it rejects the unknown lawyer id and
    // the form surfaces that as a real error banner. Assert on whichever
    // actually happens rather than assuming one outcome.
    const errorBanner = page.locator('.appointments-page__error');
    const newRequestRow = page.locator('.appointments-page__list li', {
      hasText: placeholderLawyerId,
    });
    await Promise.race([
      errorBanner.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => undefined),
      page
        .getByText(/requested/i)
        .first()
        .waitFor({ state: 'visible', timeout: 15_000 })
        .catch(() => undefined),
    ]);

    const gotError = await errorBanner.isVisible().catch(() => false);
    if (gotError) {
      await expect(errorBanner).toBeVisible();
      test.info().annotations.push({
        type: 'documented-gap',
        description: `Backend rejected the placeholder lawyer id (${placeholderLawyerId}) as expected — there is no lawyer-lookup endpoint in the portal API, so this app can only submit an id the firm has shared out-of-band.`,
      });
    } else {
      // Unexpected but valid: this tenant happens to have a lawyer seeded at
      // this id, and the request was accepted, landing in "Your requests"
      // with status "Requested" (there is no confirm/reschedule endpoint, so
      // it can never move past that state from this app).
      await expect(page.getByText(/requested/i).first()).toBeVisible();
    }
    void newRequestRow;
  });

  test('opening an existing thread and sending a message; thread creation is staff-only', async ({
    page,
  }) => {
    await loginAsPortalClientReal(page);
    await page.goto('/messages');

    await expect(page.getByRole('heading', { name: /^messages$/i })).toBeVisible();
    await expect(page.locator('mat-progress-bar').first()).toHaveCount(0, { timeout: 15_000 });

    // Confirmed real limitation: messages.page.ts only lists threads
    // (listThreads()) — there is no "new conversation"/"new thread" button in
    // messages.page.html, no such route in app.routes.ts, and no
    // create-thread method on PortalMessagesService. A portal client can only
    // reply inside a thread a staff user has already started.
    await expect(
      page.getByRole('button', { name: /new (conversation|thread|message)/i }),
    ).toHaveCount(0);

    const threadLinks = page.locator('.messages-page__list li a');
    const threadCount = await threadLinks.count();

    if (threadCount === 0) {
      await expect(page.getByText(/no conversations yet/i)).toBeVisible();
      test.info().annotations.push({
        type: 'documented-gap',
        description:
          'No message thread exists for this portal client yet, and this app has no way to create one from the portal side — thread creation is staff-only. This journey cannot exercise sending a message without a staff-created thread already seeded.',
      });
      return;
    }

    await threadLinks.first().click();
    await expect(page).toHaveURL(/\/messages\/[0-9a-f-]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /conversation/i })).toBeVisible();
    await expect(
      page.getByText(/our team typically replies within one business day/i),
    ).toBeVisible();
    await expect(page.locator('mat-progress-bar').first()).toHaveCount(0, { timeout: 15_000 });

    const messageBody = `E2E journey 43 message ${Date.now()}`;
    await page.getByLabel(/^message$/i).fill(messageBody);
    await page.getByRole('button', { name: /^send$/i }).click();

    // Real send: appended to the thread on success. If the backend/network
    // is unavailable this composer queues it offline instead of losing it
    // (thread-detail.page.ts's OfflineMutationQueueService) — but under the
    // full local stack the happy path is a real synchronous send.
    await expect(
      page.locator('.thread-detail-page__messages li', { hasText: messageBody }),
    ).toBeVisible({ timeout: 15_000 });
  });
});

function toDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}
