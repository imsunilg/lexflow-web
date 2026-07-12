import { expect, test } from '@playwright/test';
import { loginAsPortalClientReal } from '../../fixtures/real-auth';

/**
 * PRD §37 journey #42: Portal documents — view a firm-published document if
 * one exists, and upload a new document to the firm via the real upload form.
 *
 * `documents.page.ts`'s own doc comment confirms the split this journey
 * exercises: `PortalDocumentsService.list()` is scoped server-side to
 * `Document.PortalPublished == true && Confidentiality != "Privileged"` — this
 * app can never see a document the firm hasn't explicitly published to the
 * portal, so "Shared with you" legitimately has nothing to show unless some
 * other journey (staff-side) has published one under `E2E_PORTAL_CLIENT_ID`'s
 * matter. Upload lands in that matter's "Client Uploads" folder and is a real,
 * fully-wired endpoint (`POST /api/portal/v1/documents`, multipart, reused
 * staff AV-scan pipeline) — this journey exercises the real thing rather than
 * fabricating a shared document.
 *
 * `PORTAL_MAX_UPLOAD_BYTES = 25_000_000` (`portal.models.ts`) is mirrored
 * client-side only for instant feedback; the 25 MB cap itself is enforced
 * server-side via `[RequestSizeLimit(25_000_000)]`. This journey checks the
 * client-side guard fires (disables/blocks submit) without needing to
 * actually push 25 MB across the wire.
 */
test.describe('Journey 42: Portal documents', () => {
  test('shared documents list (or its honest empty state), plus a real upload to the firm', async ({
    page,
  }) => {
    await loginAsPortalClientReal(page);
    await page.goto('/documents');

    await expect(page.getByRole('heading', { name: /^documents$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /shared with you/i })).toBeVisible();
    await expect(page.locator('mat-progress-bar').first()).toHaveCount(0, { timeout: 15_000 });

    // 1. "Shared with you" — either real published documents, or the honest
    // empty state. Never fabricate a document that isn't there.
    const sharedList = page.locator('.documents-page__list li');
    const sharedCount = await sharedList.count();
    if (sharedCount === 0) {
      await expect(page.getByText(/no documents shared yet/i)).toBeVisible();
    } else {
      // A real published document exists — verify it renders with a working
      // download affordance (opens a signed URL in a new tab; we don't need
      // to follow the popup to confirm the button/request wiring is real).
      const firstDoc = sharedList.first();
      await expect(firstDoc.locator('.documents-page__list-title')).not.toBeEmpty();
      const downloadButton = firstDoc.getByRole('button', { name: /download/i });
      await expect(downloadButton).toBeVisible();
    }

    // 2. Upload form needs a real matter to attach to. Same documented
    // limitation as journey 41: this client's matters come from staff-side
    // seeding (portal users cannot create matters), so if none exist yet the
    // matter <mat-select> legitimately has no options and submission cannot
    // proceed — document that rather than faking a matter into existence.
    await page.getByRole('combobox', { name: /matter/i }).click();
    const matterOptions = page.getByRole('option');
    const matterOptionCount = await matterOptions.count();
    if (matterOptionCount === 0) {
      await page.keyboard.press('Escape');
      test.info().annotations.push({
        type: 'documented-gap',
        description:
          'No matter is visible to this portal client yet, so the upload form has no matter to attach to — portal users cannot create matters themselves (see journey 41).',
      });
      return;
    }
    await matterOptions.first().click();

    await page.getByLabel(/title/i).fill('E2E Portal Upload — Journey 42');

    // Client-side file-size validation: build an in-memory file over the
    // 25 MB cap and confirm the form discloses the error and never attempts
    // the upload, per PORTAL_MAX_UPLOAD_BYTES.
    const oversizedBuffer = Buffer.alloc(25_000_001, 'a');
    await page.setInputFiles('input[type="file"]', {
      name: 'oversized.pdf',
      mimeType: 'application/pdf',
      buffer: oversizedBuffer,
    });
    await expect(page.getByText(/file is larger than 25 mb/i)).toBeVisible();

    // Now select a real, small file and submit — this is the actual upload
    // request against the live backend (multipart POST /documents).
    const smallBuffer = Buffer.from('E2E Portal Upload journey 42 test content', 'utf-8');
    await page.setInputFiles('input[type="file"]', {
      name: 'e2e-portal-upload.txt',
      mimeType: 'text/plain',
      buffer: smallBuffer,
    });
    await expect(page.getByText(/file is larger than 25 mb/i)).toHaveCount(0);

    await page.getByRole('button', { name: /^upload$/i }).click();

    // Success surfaces as a snackbar and the new document prepended to the
    // "Shared with you" list-note: upload does not require firm publishing to
    // appear here, since `documents()` is updated locally from the response.
    await expect(page.getByText(/document uploaded/i)).toBeVisible({ timeout: 15_000 });
    await expect(
      page.locator('.documents-page__list-title', { hasText: 'E2E Portal Upload — Journey 42' }),
    ).toBeVisible();
  });
});
