import { expect, test } from '@playwright/test';
import { loginAsStaffReal } from '../../fixtures/real-auth';

/**
 * PRD §37 flagged journey #1: lead -> convert -> matter -> hearing -> outcome.
 * Runs against the real docker-compose'd backend (see e2e/playwright.fullstack.config.ts)
 * and the seeded "owner"-role user from lexflow-api's `tools/E2eSeed`.
 *
 * One deliberate deviation from a literal single-wizard conversion: the
 * Convert-lead wizard's own "Create a matter" step is a documented,
 * pre-existing gap — its own UI copy states matter creation isn't wired up
 * there yet ("the Legal module hasn't shipped") and enabling it surfaces an
 * error. Rather than exercise a path guaranteed to fail, this journey
 * converts the lead to a client only, then creates the matter via the real,
 * working Create Matter dialog against that new client — reaching the same
 * business outcome (lead -> client -> matter) through the paths that
 * actually work, exactly like the rest of this app's honest-degradation
 * pattern.
 */
test.describe('Journey 1: lead -> convert -> matter -> hearing -> outcome', () => {
  test('a lead becomes a client, a matter, a scheduled hearing, and a recorded outcome', async ({
    page,
  }) => {
    await loginAsStaffReal(page);

    // 1. Create the lead from the Kanban board.
    const leadName = `E2E Lead ${Date.now()}`;
    await page.goto('/leads/kanban');
    await page.getByRole('button', { name: /new lead/i }).click();
    await page.getByLabel(/first name/i).fill(leadName);
    await page.getByLabel(/last name/i).fill('Journey');
    await page
      .getByLabel(/^email/i)
      .fill(`${leadName.replace(/\s+/g, '-').toLowerCase()}@e2e.test`);
    await page.getByLabel(/phone/i).fill('+919812345678');
    await page.getByLabel(/issue summary/i).fill('E2E journey: contract dispute intake.');
    await page.getByRole('button', { name: /save/i }).click();

    // 2. Open the newly created lead card and convert it to a client.
    await page.getByText(leadName).first().click();
    await expect(page).toHaveURL(/\/leads\/[0-9a-f-]+$/);
    await page.getByRole('button', { name: /convert/i }).click();

    const clientEmail = `${leadName.replace(/\s+/g, '-').toLowerCase()}-client@e2e.test`;
    await page.getByLabel(/first name/i).fill(leadName);
    await page.getByLabel(/last name/i).fill('Journey');
    await page.getByLabel(/^email/i).fill(clientEmail);
    await page.getByLabel(/phone/i).fill('+919812345678');
    await page.getByRole('button', { name: /^next$/i }).click();
    // Matter step: leave "Create a matter" unchecked (documented gap above) and continue.
    await page.getByRole('button', { name: /^next$/i }).click();
    // Fees step: leave "Create a consultation invoice" unchecked.
    await page.getByRole('button', { name: /^convert$/i }).click();
    await expect(page.getByText(/converted\. client created/i)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /done/i }).click();

    // 3. Create a matter for the new client via the real Create Matter dialog.
    await page.goto('/clients/list');
    await page.getByLabel(/^search/i).fill(leadName);
    await page.getByText(leadName).first().click();
    await expect(page).toHaveURL(/\/clients\/[0-9a-f-]+$/);
    const clientId = page.url().split('/clients/')[1];

    const matterTitle = `E2E Matter ${Date.now()}`;
    await page.goto('/matters/list');
    await page.getByRole('button', { name: /new matter/i }).click();
    await page.getByLabel(/client id/i).fill(clientId);
    await page.getByLabel(/^title/i).fill(matterTitle);
    await page.getByLabel(/matter type/i).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: /run conflict check/i }).click();
    await expect(page.getByRole('button', { name: /create matter/i })).toBeEnabled({
      timeout: 15_000,
    });
    await page.getByRole('button', { name: /create matter/i }).click();
    await expect(page).toHaveURL(/\/matters\/[0-9a-f-]+$/, { timeout: 15_000 });

    // 4. Add a court case under the matter (hearings belong to a court case, not the matter directly).
    await page.getByRole('tab', { name: /court cases/i }).click();
    await page.getByRole('button', { name: /add court case/i }).click();
    await page.getByLabel(/^court$/i).fill('Delhi High Court');
    await page.getByLabel(/case type/i).fill('Civil Suit');
    await page.getByLabel(/case number/i).fill(`E2E-${Date.now()}`);
    await page.getByLabel(/^year/i).fill(String(new Date().getFullYear()));
    await page.getByRole('button', { name: /add court case/i }).click();
    await expect(page).toHaveURL(/\/matters\/[0-9a-f-]+\/cases\/[0-9a-f-]+$/, { timeout: 15_000 });

    // 5. Schedule a hearing on that case.
    await page.getByRole('tab', { name: /hearings/i }).click();
    const hearingDate = new Date();
    hearingDate.setDate(hearingDate.getDate() + 14);
    const isoDate = hearingDate.toISOString().slice(0, 10);
    await page.getByLabel(/^date$/i).fill(isoDate);
    await page.getByLabel(/^time$/i).fill('10:30');
    await page.getByLabel(/purpose/i).fill('First hearing');
    await page.getByRole('button', { name: /schedule hearing/i }).click();
    await expect(page.getByText(isoDate)).toBeVisible({ timeout: 15_000 });

    // 6. Record the hearing's outcome.
    await page.getByRole('button', { name: /record outcome/i }).click();
    await page
      .getByLabel(/what transpired/i)
      .fill('Arguments heard; matter adjourned for further hearing.');
    await page
      .getByLabel(/next hearing date/i)
      .first()
      .click(); // selects the "Next hearing date" radio option
    const nextDate = new Date(hearingDate);
    nextDate.setDate(nextDate.getDate() + 21);
    await page
      .getByLabel(/^next hearing date$/i)
      .last()
      .fill(nextDate.toISOString().slice(0, 10));
    await page
      .getByRole('button', { name: /save|record/i })
      .last()
      .click();

    // The hearing list should now show the recorded outcome's summary text.
    await expect(page.getByText(/arguments heard/i)).toBeVisible({ timeout: 15_000 });
  });
});
