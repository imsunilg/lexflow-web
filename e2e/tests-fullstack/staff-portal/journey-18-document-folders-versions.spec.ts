import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect, test } from '@playwright/test';
import { loginAsStaffReal } from '../../fixtures/real-auth';

/**
 * PRD §37 flagged journey #18 (Module 7 User Flow 1 + §Versions): create a
 * folder, upload a document into it, upload a second version of that
 * document, then restore the older (first) version.
 *
 * `restoreVersion` is `POST /documents/{id}/versions/{versionNo}/restore`,
 * which (per `DocumentsService.restoreVersion`'s return type, a single new
 * `DocumentVersion`) restores-as-a-new-version rather than rewriting history —
 * so after restoring v1 this test expects a v3 to appear as the new current
 * version, not v1 becoming current again in place.
 */
test.describe('Journey 18: document folders + versions', () => {
  test('a folder is created, a document gets a second version, and an older version is restored', async ({
    page,
  }) => {
    await loginAsStaffReal(page);

    const folderName = `E2E Folder ${Date.now()}`;
    const uniqueToken = `E2E-VERSIONS-${Date.now()}`;
    const fileName = `${uniqueToken}.txt`;

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lf-e2e-docs-'));
    const v1Path = path.join(tmpDir, fileName);
    fs.writeFileSync(v1Path, `Version 1 content: ${uniqueToken}\n`);
    const v2Path = path.join(tmpDir, `v2-${fileName}`);
    fs.writeFileSync(v2Path, `Version 2 content, replaces v1: ${uniqueToken}\n`);

    // 1. Create a folder from the explorer sidebar.
    await page.goto('/documents');
    // The "New folder" trigger is an icon-only button (mat-icon defaults to
    // aria-hidden, and there's no aria-label), so it's targeted by its
    // sidebar-header position rather than an accessible name.
    await page.locator('.explorer__sidebar-header button').click();
    await page.getByLabel(/folder name/i).fill(folderName);
    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByText(folderName)).toBeVisible({ timeout: 15_000 });

    // 2. Navigate into the new folder via the folder tree, then upload the
    // first version of a document into it (folderId flows from
    // `currentFolderId()` into the upload queue automatically).
    await page.getByText(folderName).click();
    await page.getByRole('button', { name: /^upload$/i }).click();
    await page.locator('lf-document-upload-queue input[type="file"]').setInputFiles(v1Path);
    await expect(page.locator('.upload-queue__row', { hasText: fileName })).toBeVisible({
      timeout: 15_000,
    });

    // 3. Open the document's detail drawer (double-click the grid card) and
    // switch to the Versions tab.
    await page.locator('.explorer__card', { hasText: fileName }).dblclick();
    await page.getByRole('tab', { name: /^versions$/i }).click();
    await expect(page.locator('.lf-detail-drawer__version-row')).toHaveCount(1, {
      timeout: 15_000,
    });
    await expect(page.locator('.lf-detail-drawer__version-row')).toContainText('v1');

    // 4. Upload a second version via the drawer's own uploader.
    await page.locator('lf-document-detail-drawer input[type="file"]').setInputFiles(v2Path);
    await expect(page.locator('.lf-detail-drawer__version-row')).toHaveCount(2, {
      timeout: 15_000,
    });
    const currentRow = page.locator('.lf-detail-drawer__version-row', { hasText: 'Current' });
    await expect(currentRow).toContainText('v2');

    // 5. Restore the original v1 (a documented restore-as-new-version, not
    // in-place history rewrite — see file header comment).
    const v1Row = page.locator('.lf-detail-drawer__version-row', { hasText: 'v1' });
    await v1Row.getByRole('button', { name: /restore/i }).click();

    await expect(page.locator('.lf-detail-drawer__version-row')).toHaveCount(3, {
      timeout: 15_000,
    });
    const newCurrentRow = page.locator('.lf-detail-drawer__version-row', { hasText: 'Current' });
    await expect(newCurrentRow).toContainText('v3');
  });
});
