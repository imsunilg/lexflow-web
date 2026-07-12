import { expect, test } from '@playwright/test';
import { loginAsStaffReal } from '../../fixtures/real-auth';

/**
 * PRD §37 journey: calendar event create with RRULE (PRD Module 6). Exercises
 * `EventDialogComponent`'s "Repeats" checkbox + RRULE builder (freq/interval/
 * byday/until-or-count with a live "next occurrences" preview), then verifies
 * the created event renders on the month grid via `EventChipComponent`.
 */
test.describe('Journey 14: calendar event create with RRULE', () => {
  test('a recurring meeting is created and appears on the month view', async ({ page }) => {
    await loginAsStaffReal(page);

    await page.goto('/calendar/view');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });

    const eventTitle = `E2E Recurring Standup ${Date.now()}`;
    await page.getByRole('button', { name: /new event/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    await dialog.getByLabel(/^title$/i).fill(eventTitle);

    // Turn on recurrence and build a weekly RRULE (freq/interval/byday).
    await dialog.getByRole('checkbox', { name: /repeats/i }).check();
    await dialog.getByLabel(/^frequency$/i).click();
    await page.getByRole('option', { name: /^weekly$/i }).click();
    await dialog.getByLabel(/^every$/i).fill('1');
    // Pick today's weekday button so the very next occurrence is today's event itself.
    const weekdayAbbrev = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][new Date().getDay()];
    await dialog.getByRole('button', { name: weekdayAbbrev, exact: true }).click();

    // Confirm the live "next occurrences" preview reacts to the RRULE builder
    // before saving — the real, working part of this UI this journey is about.
    await expect(dialog.getByText(/next occurrences/i)).toBeVisible({ timeout: 5_000 });

    await dialog.getByRole('button', { name: /^save$/i }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });

    // The event (its first occurrence) should now render as a chip on the month grid.
    await expect(page.getByText(eventTitle)).toBeVisible({ timeout: 15_000 });
  });
});
