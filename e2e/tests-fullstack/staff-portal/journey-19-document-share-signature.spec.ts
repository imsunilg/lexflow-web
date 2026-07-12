import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect, test } from '@playwright/test';
import { loginAsStaffReal } from '../../fixtures/real-auth';

/**
 * PRD §37 flagged journey #19 (Module 7 §7 Share, §8 Sign): create an
 * external share link for a document, then send that same document for
 * signature via the real signature wizard.
 *
 * The upload queue hardcodes `confidentiality: 'Normal'`
 * (`document-upload-queue.component.ts`'s `upload()`), so a freshly uploaded
 * document is never `'Privileged'` and can always reach the External Link
 * tab — no need to route around the "privileged documents can't share"
 * banner here. The Team Access and Client Portal tabs are a confirmed
 * backend gap (no internal-permissions/publish-toggle endpoints exist) and
 * are intentionally not exercised — only the working External Link flow is.
 *
 * The signature half hits a real external-provider boundary, same shape as
 * journey 2's Razorpay dependency: `DocuSignSignatureProvider`/
 * `AdobeSignSignatureProvider` (`lexflow-api`'s
 * `src/LexFlow.Infrastructure/Dms/*SignatureProvider.cs`) make live HTTP
 * calls to DocuSign's/Adobe Sign's real REST APIs and `EnsureSuccessStatusCode()`
 * the response — there is no local stub/fake provider, and `docker-compose.yml`
 * / `appsettings*.json` wire zero `ESignature:*` credentials by default, so an
 * unconfigured environment gets a real 401 that surfaces as a 500 here. This
 * test drives the wizard for real through Provider -> Signers -> Review, and
 * only calls the terminal "Send" action (the one that reaches DocuSign/Adobe
 * Sign) when `ESIGNATURE_DOCUSIGN_ACCESS_TOKEN` is set — otherwise it stops at
 * the real, working boundary and records why, rather than fabricating a
 * signed-envelope outcome.
 */
const DOCUSIGN_ACCESS_TOKEN = process.env['ESIGNATURE_DOCUSIGN_ACCESS_TOKEN'];

test.describe('Journey 19: document share link + signature wizard', () => {
  test('a document gets an external share link, is revoked, and is then sent for signature', async ({
    page,
  }) => {
    await loginAsStaffReal(page);

    const uniqueToken = `E2E-SHARE-SIGN-${Date.now()}`;
    const fileName = `${uniqueToken}.txt`;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lf-e2e-docs-'));
    const filePath = path.join(tmpDir, fileName);
    fs.writeFileSync(filePath, `Journey 19 content: ${uniqueToken}\n`);

    // 1. Upload a document (Normal confidentiality by default — see header comment).
    await page.goto('/documents');
    await page.getByRole('button', { name: /^upload$/i }).click();
    await page.locator('lf-document-upload-queue input[type="file"]').setInputFiles(filePath);
    const card = page.locator('.explorer__card', { hasText: fileName });
    await expect(card).toBeVisible({ timeout: 15_000 });

    // 2. Open its row menu and start the share flow. The "more" trigger is an
    // icon-only button (mat-icon defaults to aria-hidden, no aria-label) — it's
    // the only button in the card, so it's targeted without a name filter.
    await card.getByRole('button').click();
    await page.getByRole('menuitem', { name: /^share$/i }).click();

    await expect(page.getByRole('heading', { name: /^share/i })).toBeVisible();
    // No "privileged" banner should appear for a Normal-confidentiality upload.
    await expect(page.getByText(/cannot get external share links/i)).toHaveCount(0);

    // Native-date-adapter default locale is en-US -> MM/DD/YYYY.
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);
    const expiryText = `${String(expiry.getMonth() + 1).padStart(2, '0')}/${String(
      expiry.getDate(),
    ).padStart(2, '0')}/${expiry.getFullYear()}`;
    await page.getByLabel(/^expires$/i).fill(expiryText);
    await page.getByRole('button', { name: /create link/i }).click();

    const shareLinkInput = page.getByLabel(/share link/i);
    await expect(shareLinkInput).toBeVisible({ timeout: 15_000 });
    await expect(shareLinkInput).toHaveValue(/\/shared\//);

    // 3. Revoke the link (real DELETE call) and confirm the dialog returns to the create form.
    await page.getByRole('button', { name: /revoke link/i }).click();
    await expect(page.getByRole('button', { name: /create link/i })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('button', { name: /^close$/i }).click();

    // 4. Send the same document for signature via the real wizard.
    await card.getByRole('button').click();
    await page.getByRole('menuitem', { name: /send for signature/i }).click();

    await expect(page.getByRole('heading', { name: /send ".*" for signature/i })).toBeVisible();
    // Step 1: provider (radio group, pick the first real provider).
    await page.getByRole('radio').first().click();
    await page
      .getByRole('button', { name: /^next$/i })
      .first()
      .click();

    // Step 2: signers (one row exists by default).
    await page.getByLabel(/^name$/i).fill('E2E Signer');
    await page.getByLabel(/^email$/i).fill(`${uniqueToken.toLowerCase()}@e2e.test`);
    await page
      .getByRole('button', { name: /^next$/i })
      .last()
      .click();

    // Step 3: review & send — real boundary. See file header comment: sending
    // actually calls the live DocuSign/Adobe Sign API, so only attempt it when
    // real credentials are configured for this environment.
    await expect(page.getByRole('button', { name: /^send$/i })).toBeVisible();
    test.skip(
      !DOCUSIGN_ACCESS_TOKEN,
      'ESIGNATURE_DOCUSIGN_ACCESS_TOKEN not set — sending would call the real DocuSign API and fail (see file header comment).',
    );

    await page.getByRole('button', { name: /^send$/i }).click();
    await expect(page.getByText(/envelope status:/i)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /^close$/i }).click();
  });
});
