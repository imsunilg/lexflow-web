import { expect, test } from '@playwright/test';
import { loginAsStaffReal } from '../../fixtures/real-auth';

/**
 * PRD §37 flagged journey #4: leads CSV import wizard (AC-L5) —
 * `LeadsImportWizardPage` at `/leads/import`, not the (differently named)
 * lead-conversion wizard.
 *
 * The backend's `LeadImportParser` auto-detects columns by exact header name
 * (`FirstName`, `LastName`, `Company`, `Email`, `Phone`, `IssueSummary`,
 * case-insensitive) and has no separate column-mapping payload — so this
 * spec's CSV is written with those exact header names already, meaning the
 * wizard's mapping step auto-maps every column with no manual selection
 * needed (per the component's own `parseCsvPreview()` auto-map logic). The
 * file is attached directly as an in-memory buffer via `setInputFiles` on the
 * uploader's hidden `<input type="file">` — no file needs to exist on disk.
 */
test.describe('Journey 4: leads CSV import wizard', () => {
  test('a CSV of leads is uploaded through the import wizard and the rows appear in the leads list', async ({
    page,
  }) => {
    await loginAsStaffReal(page);

    const stamp = Date.now();
    const firstA = `E2EImportA${stamp}`;
    const firstB = `E2EImportB${stamp}`;
    const csv = [
      'FirstName,LastName,Company,Email,Phone,IssueSummary',
      `${firstA},Journey,Acme Corp,${firstA.toLowerCase()}@e2e.test,+919812340001,First imported lead`,
      `${firstB},Journey,Acme Corp,${firstB.toLowerCase()}@e2e.test,+919812340002,Second imported lead`,
    ].join('\n');

    await page.goto('/leads/import');

    await page.locator('input[type="file"]').setInputFiles({
      name: 'e2e-leads-import.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    });

    // Mapping step: headers already match the parser's expected names, so every
    // field should already be auto-mapped. Just confirm the preview rendered.
    await expect(page.getByText(firstA)).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /^upload$/i }).click();

    // Progress -> done. The backend batch-processes asynchronously; the page polls every 2s.
    await expect(page.getByText(/imported \d+ of \d+ rows/i)).toBeVisible({ timeout: 30_000 });

    // Verify the imported leads are now visible in the leads list.
    await page.goto('/leads/list');
    await page.getByLabel(/^search$/i).fill(firstA);
    await expect(page.getByText(firstA)).toBeVisible({ timeout: 15_000 });

    await page.getByLabel(/^search$/i).fill(firstB);
    await expect(page.getByText(firstB)).toBeVisible({ timeout: 15_000 });
  });
});
