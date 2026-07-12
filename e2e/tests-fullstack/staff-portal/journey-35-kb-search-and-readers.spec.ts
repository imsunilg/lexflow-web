import { expect, test } from '@playwright/test';
import { E2E_EMAIL, E2E_PASSWORD, E2E_TENANT_SLUG } from '../../fixtures/real-auth';

/**
 * PRD §37 journey #35: KB home search, then an Act section reader and a
 * Judgment reader, verifying real (not placeholder) content renders.
 *
 * Documented gap this journey routes around: neither `KbActsController`'s
 * create-act/create-section endpoints nor anything in `knowledge-base.routes.ts`
 * has a staff-portal UI to author an Act/section — the readers
 * (`act-reader.page.ts`, `judgment-reader.page.ts`) are read-only, and no
 * `16_Seed` script in `lexflow-database` populates `kb.kb_acts`/
 * `kb_act_sections` either (confirmed by grep — only Courts/Practice
 * Areas/Tax/Lost-Reasons get 16_Seed rows). So this journey seeds one Act +
 * section and uploads one Judgment PDF directly against the real backend
 * (`POST /kb/acts`, `/kb/acts/{id}/sections`, `/kb/judgments`) using the
 * actual bearer token from `/auth/login` — the same technique journey #15
 * uses for the free-busy endpoint — then drives the real reader UI against
 * that real, persisted data.
 *
 * A second, more surprising gap this journey demonstrates concretely: Acts
 * and their sections are never pushed to the search indexer at all — a grep
 * across `LexFlow.Infrastructure/Kb` shows only `KbArticleService` and
 * `KbJudgmentService` call `searchIndexer.IndexAsync`; there is no equivalent
 * call anywhere for Acts/Sections. So a freshly created Act section can never
 * be found via KB home's free-text search — only direct navigation (e.g. from
 * a collection/bookmark, or knowing its id) reaches it. The assertion below
 * (searching for a random marker string embedded in the section body and
 * expecting zero hits) makes that gap an explicit, checked behavior rather
 * than a silent assumption.
 */
test.describe('Journey 35: KB search + Act/Judgment readers', () => {
  test('KB home search finds a judgment; Act section and judgment readers render real content', async ({
    page,
  }) => {
    const loginResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/auth/login') && response.request().method() === 'POST',
    );
    await page.goto('/login');
    await page.getByLabel(/firm workspace/i).fill(E2E_TENANT_SLUG);
    await page.getByLabel(/email/i).fill(E2E_EMAIL);
    await page.getByLabel(/password/i).fill(E2E_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
    const loginBody = await (await loginResponsePromise).json();
    const accessToken: string = loginBody.data.accessToken;
    expect(accessToken).toBeTruthy();
    const authHeaders = { Authorization: `Bearer ${accessToken}` };

    // 1. Seed an Act + section directly against the real backend (no UI exists — see file header).
    const actName = `E2E Act ${Date.now()}`;
    const uniqueMarker = `e2emarker${Date.now()}`;
    const actResponse = await page.request.post('/api/v1/kb/acts', {
      headers: authHeaders,
      data: { name: actName, shortCode: `E2E${Date.now()}`, jurisdiction: 'IN-DL', year: 2024 },
    });
    expect(actResponse.ok()).toBe(true);
    const actId: string = (await actResponse.json()).data.id;

    const sectionTitle = 'E2E Journey Section';
    const sectionResponse = await page.request.post(`/api/v1/kb/acts/${actId}/sections`, {
      headers: authHeaders,
      data: {
        parentId: null,
        number: '1',
        title: sectionTitle,
        body: `This is real, rendered section text for journey 35 (marker: ${uniqueMarker}).`,
        effectiveFrom: '2020-01-01',
      },
    });
    expect(sectionResponse.ok()).toBe(true);
    const sectionId: string = (await sectionResponse.json()).data.id;

    // 2. Seed a Judgment (a real, correctly cross-referenced single-page PDF —
    // pdf.js genuinely parses this, it's just a hand-built fixture rather
    // than a scanned court judgment).
    const courtsResponse = await page.request.get('/api/v1/legal-lookups/courts', {
      headers: authHeaders,
    });
    expect(courtsResponse.ok()).toBe(true);
    const courts: Array<{ id: string; name: string }> = (await courtsResponse.json()).data;
    expect(courts.length).toBeGreaterThan(0);
    const court = courts[0];

    const citation = `E2E Journey Citation ${Date.now()}`;
    const pdfBuffer = buildMinimalPdf();
    const judgmentResponse = await page.request.post('/api/v1/kb/judgments', {
      headers: authHeaders,
      multipart: {
        Citation: citation,
        NeutralCitation: '',
        CourtId: court.id,
        DecisionDate: '2024-01-15',
        Parties: 'E2E Petitioner v. E2E Respondent',
        Headnote: 'E2E journey headnote text — real content rendered by the judgment reader.',
        file: {
          name: 'e2e-judgment.pdf',
          mimeType: 'application/pdf',
          buffer: pdfBuffer,
        },
      },
    });
    expect(judgmentResponse.ok()).toBe(true);
    const judgmentId: string = (await judgmentResponse.json()).data.id;

    // 3. KB home search finds the judgment (it IS indexed on upload).
    await page.goto('/knowledge-base/home');
    await page.getByLabel(/search acts, judgments, articles/i).fill(citation);
    const judgmentHit = page.locator('.kb-home__hit-row', { hasText: citation });
    await expect(judgmentHit).toBeVisible({ timeout: 20_000 });
    await judgmentHit.click();

    // 4. Judgment reader shows real metadata + headnote + a rendered PDF page.
    await expect(page).toHaveURL(new RegExp(`/knowledge-base/judgments/${judgmentId}$`));
    await expect(page.getByRole('heading', { name: citation })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(court.name)).toBeVisible();
    await expect(page.getByText('E2E Petitioner v. E2E Respondent')).toBeVisible();
    await expect(page.getByText(/real content rendered by the judgment reader/i)).toBeVisible();
    // The PDF actually parsed and rendered (not the "could not load" empty state).
    await expect(page.getByText(/page 1 \/ 1/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/could not load the pdf/i)).not.toBeVisible();

    // 5. Act section reader — reached by direct navigation (constructed the
    // same way `collection-boards.page.ts`/`kb-home.page.ts` themselves
    // navigate to a section: actId in the path, sectionId as a query param),
    // since there is no search path to it (see file header).
    await page.goto(`/knowledge-base/acts/${actId}?sectionId=${sectionId}`);
    await expect(page.getByRole('heading', { name: actName })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(`1. ${sectionTitle}`)).toBeVisible();
    await expect(page.getByText(uniqueMarker)).toBeVisible();

    // 6. Confirm the documented gap: this section is genuinely unsearchable.
    await page.goto('/knowledge-base/home');
    await page.getByLabel(/search acts, judgments, articles/i).fill(uniqueMarker);
    await page.waitForTimeout(1000); // let the debounced search round-trip settle
    await expect(page.getByText(/no results/i)).toBeVisible({ timeout: 15_000 });
  });
});

/** Builds a small, correctly cross-referenced single-page PDF at runtime (offsets computed from real string lengths, not hand-counted) — a genuine fixture pdf.js parses for real, not a mock. */
function buildMinimalPdf(): Buffer {
  const streamContent = 'BT /F1 18 Tf 20 150 Td (LexFlow E2E Judgment) Tj ET';
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
