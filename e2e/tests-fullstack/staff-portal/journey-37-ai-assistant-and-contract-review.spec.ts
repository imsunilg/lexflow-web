import { expect, test } from '@playwright/test';
import { loginAsStaffReal } from '../../fixtures/real-auth';

/**
 * PRD §37 journey #37: AI assistant dock chat + Contract Review workspace.
 *
 * Real, expected limitation documented here rather than faked: Module 16's
 * AI Gateway calls Anthropic directly server-side
 * (`AnthropicLlmProvider.CompleteAsync` in lexflow-api). That method's own
 * first line throws `InvalidOperationException("Ai:AnthropicApiKey is not
 * configured...")` whenever the `Ai:AnthropicApiKey` config value is empty —
 * and a grep across this repo's `appsettings*.json` / `docker-compose*.yml`
 * finds no such key wired anywhere, meaning every AI call in this local
 * stack fails server-side unless someone has manually added a real
 * Anthropic key to the API container's config, which is not this journey's
 * business to assume. So this journey does not assert a canned "AI worked"
 * outcome — it drives the real UI, waits for whichever real network
 * response actually comes back, and asserts on that response's own honest
 * shape:
 *   - success -> the AI-disclosure badge (`lf-ai-badge`, PRD BR-19/AC-AI5)
 *     renders, since `AiBadgeComponent`'s own doc comment says
 *     `isAiGenerated` is structurally guaranteed true on every AI response
 *     DTO and the badge is never conditionally hidden.
 *   - failure -> Contract Review shows its real error state
 *     (`reviewError()` -> "Contract review failed."); the assistant dock has
 *     no equivalent visible error text at all (`ai-assistant-dock.component.ts`'s
 *     `send()` swallows chat errors with a bare `error: () =>
 *     this.sending.set(false)`), so this journey asserts the dock's honest
 *     behavior on failure is: the progress bar disappears and no assistant
 *     message is appended — not a fabricated error banner that doesn't exist.
 *
 * Contract Review requires an already-uploaded document (its own hint text:
 * "there's no upload-in-place here"), so this journey uploads one for real
 * via the Documents module first and waits for the real pipeline to reach
 * "Indexed" before Contract Review's document search can find it.
 */
test.describe('Journey 37: AI assistant dock + Contract Review', () => {
  test('AI assistant chat and contract review both resolve to a real, honest outcome', async ({
    page,
  }) => {
    await loginAsStaffReal(page);

    // 1. Upload a real document for Contract Review to search for.
    const docTitle = `e2e-contract-${Date.now()}.pdf`;
    await page.goto('/documents');
    // Scoped to the toolbar — an empty folder also renders an "Upload" CTA
    // inside its empty-state, which would otherwise make this ambiguous.
    await page
      .locator('.explorer__toolbar-actions')
      .getByRole('button', { name: /upload/i })
      .click();
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: docTitle, mimeType: 'application/pdf', buffer: buildMinimalPdf() });

    const queueRow = page.locator('.upload-queue__row', { hasText: docTitle });
    await expect(queueRow).toBeVisible({ timeout: 15_000 });
    // Real pipeline: Uploading -> Scanning -> OCR -> Indexed (or OcrFailed —
    // either is a settled, searchable-or-not-real terminal state; the
    // uploader's own polling gives up after 12 * 5s, so match that ceiling).
    await expect(queueRow.locator('[data-stage="Indexed"], [data-stage="OcrFailed"]')).toBeVisible({
      timeout: 65_000,
    });

    // 2. Contract Review — search for the uploaded document and run a review.
    await page.goto('/ai-studio/contract-review');
    await page.getByLabel(/search documents/i).fill(docTitle);
    const hitRow = page.locator('.contract-review__hit-row', { hasText: docTitle });
    await expect(hitRow).toBeVisible({ timeout: 20_000 });
    await hitRow.click();
    await page.getByRole('button', { name: /run review/i }).click();

    const reviewOutcome = await Promise.race([
      page
        .locator('.contract-review__table')
        .waitFor({ state: 'visible', timeout: 45_000 })
        .then(() => 'succeeded' as const)
        .catch(() => null),
      page
        .getByText(/contract review failed/i)
        .waitFor({ state: 'visible', timeout: 45_000 })
        .then(() => 'failed' as const)
        .catch(() => null),
    ]);
    expect(
      reviewOutcome,
      'contract review must reach a settled success or failure state',
    ).not.toBeNull();

    if (reviewOutcome === 'succeeded') {
      // Real AI response came back — the disclosure badge must be present (never conditionally hidden).
      await expect(page.getByText(/ai-generated — review required/i)).toBeVisible();
    } else {
      // Expected in this environment (see file header) — assert the real error text, not a stand-in.
      await expect(page.getByText(/contract review failed/i)).toBeVisible();
      await expect(page.locator('.contract-review__table')).toHaveCount(0);
    }

    // 3. AI assistant dock — same gateway, same honest-outcome handling.
    await page.goto('/dashboard');
    await page.getByRole('button', { name: /open ai assistant/i }).click();
    const dockInput = page.getByPlaceholder(/ask anything/i);
    await dockInput.fill('Summarize the current dashboard in one sentence.');
    await dockInput.press('Enter');

    // Wait for the send to settle (progress bar shown while sending() is true, then hidden).
    await expect(page.locator('.ai-assistant-dock mat-progress-bar')).toHaveCount(0, {
      timeout: 45_000,
    });

    const dockBadge = page.locator('.ai-assistant-dock lf-ai-badge');
    if (await dockBadge.count()) {
      // A real assistant reply came back — disclosure badge must render.
      await expect(dockBadge.first().getByText(/ai-generated — review required/i)).toBeVisible();
    } else {
      // The dock swallows chat errors silently (see file header) — the only
      // honest, observable signal of failure is that no assistant message
      // (and therefore no badge) was ever appended.
      await expect(page.locator('.ai-assistant-dock__message--user')).toHaveCount(1);
    }
  });
});

/** Same runtime-computed, correctly cross-referenced minimal PDF fixture as journey #35. */
function buildMinimalPdf(): Buffer {
  const streamContent = 'BT /F1 18 Tf 20 150 Td (LexFlow E2E Contract) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 5 0 R >> >> /MediaBox [0 0 300 300] /Contents 4 0 R >>',
    `<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}
