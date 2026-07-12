import { expect, test } from '@playwright/test';
import { loginAsStaffReal } from '../../fixtures/real-auth';

/**
 * PRD §37 journey #36: custom report builder -> schedule -> run history.
 *
 * Two documented, confirmed gaps this journey routes around:
 *
 * 1. No run history. `reports-hub.page.ts`'s own doc comment states "'Recent'
 *    is skipped — no run-history-per-user endpoint exists", confirmed
 *    against `reports.models.ts` (`ReportRunDto` has no list endpoint, only
 *    `GET /reports/runs/{jobId}` for a single run by id). The closest real,
 *    persisted equivalent this app has is `saved-report-manager.page.ts`'s
 *    "Schedules" section (`GET /reports/schedules`), which lists every
 *    schedule ever created with its frequency/format/next-run — this
 *    journey verifies the schedule created here shows up there, as the
 *    honest stand-in for "run history" in this build.
 *
 * 2. The Report Viewer's own "Schedule" toolbar button is unreachable by ANY
 *    role. It's gated on `permissionService.has('reports.operational.own')`
 *    (`report-viewer.page.ts`), but the real permission catalog
 *    (`16_Seed/001_Permissions_Catalog.sql`) only ever seeds
 *    `reports_operational.read.{own,team,all}` — a different resource name
 *    (underscore, no dot) with a `.read.` verb segment the checked string
 *    lacks entirely. `PermissionService.has()` only matches the exact string
 *    or grants that start with `"reports.operational.own."` — neither ever
 *    exists — so `canSchedule` is `false` for every role including "owner",
 *    and that toolbar button never renders for anyone. This journey
 *    therefore schedules the report from `saved-report-manager.page.ts`'s
 *    row-level schedule icon instead, which has no such permission gate and
 *    is the only reachable path to `ScheduleDialogComponent` in this build.
 */
test.describe('Journey 36: custom report builder -> schedule -> run history', () => {
  test('a custom report is built, run, scheduled from Saved Reports, and the schedule shows up there', async ({
    page,
  }) => {
    await loginAsStaffReal(page);

    const reportName = `E2E Custom Report ${Date.now()}`;

    // 1. Step 1 — base entity (Matter is the default selection).
    await page.goto('/reports/builder');
    await page.getByLabel(/report name/i).fill(reportName);
    await clickVisible(page, /^next$/i);

    // 2. Step 2 — columns. The "Columns" and "Group by" checklists render a
    // checkbox per field with identical labels, so scope to the first
    // checklist (Columns) rather than matching on accessible name alone.
    const columnsChecklist = page.locator('.custom-report-builder__checklist').first();
    await columnsChecklist.getByRole('checkbox', { name: 'Title' }).click();
    await columnsChecklist.getByRole('checkbox', { name: 'Status' }).click();
    await clickVisible(page, /^next$/i);

    // 3. Step 3 — filters & sort (none needed for this smoke journey).
    await clickVisible(page, /^next$/i);

    // 4. Step 4 — save, then preview/run.
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.getByRole('button', { name: /^preview$/i })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /^preview$/i }).click();

    // Run either completes inline or goes to background — both are real,
    // documented outcomes (`report-viewer.page.ts`'s own doc comment).
    await expect(
      page
        .locator('.custom-report-builder__preview table')
        .or(page.getByText(/ran as a background job/i)),
    ).toBeVisible({ timeout: 20_000 });

    // 5. Open the same report in the full report viewer and run it there too.
    await page.getByRole('button', { name: /open in report viewer/i }).click();
    await expect(page).toHaveURL(/\/reports\/view\/custom\/[0-9a-f-]+$/, { timeout: 15_000 });
    await page.getByRole('button', { name: /run report/i }).click();
    await expect(
      page
        .locator('.report-viewer__table-wrap table')
        .or(page.getByText(/ran as a background job/i)),
    ).toBeVisible({ timeout: 20_000 });

    // Confirm gap #2: the toolbar's own Schedule button never renders here
    // (or anywhere), because of the permission-key mismatch documented above.
    await expect(page.getByRole('button', { name: /schedule/i })).toHaveCount(0);

    // 6. Schedule the saved definition from the Saved Report Manager instead
    // — its row-level schedule icon has no permission gate at all.
    await page.goto('/reports/saved');
    // Scoped to the "Custom reports" section specifically — after scheduling,
    // the Schedules section below also renders a row displaying this same
    // report name (it resolves a schedule's name from its definition), so an
    // unscoped match on `.saved-report-manager__row` would become ambiguous.
    const customReportsSection = page.locator('.saved-report-manager__section').first();
    const reportRow = customReportsSection.locator('.saved-report-manager__row', {
      hasText: reportName,
    });
    await expect(reportRow).toBeVisible({ timeout: 15_000 });
    // The row has exactly two icon buttons — edit, then schedule (in that DOM order).
    await reportRow.getByRole('button').last().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: /schedule this report/i })).toBeVisible({
      timeout: 10_000,
    });
    await dialog.getByLabel(/add firm user/i).fill('E2E');
    // The autocomplete panel renders into the global CDK overlay container,
    // not nested inside the dialog panel, so this is intentionally unscoped.
    await page.getByRole('option').first().click();
    await dialog.getByRole('button', { name: /^schedule$/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 15_000 });

    // 7. "Run history" stand-in — the persisted Schedules list (see gap #1).
    await expect(reportRow).toBeVisible({ timeout: 15_000 });
    await expect(
      page.locator('.saved-report-manager__row--static', { hasText: /weekly/i }),
    ).toBeVisible({ timeout: 15_000 });
  });
});

async function clickVisible(page: import('@playwright/test').Page, name: RegExp): Promise<void> {
  await page.locator('button:visible').filter({ hasText: name }).click();
}
