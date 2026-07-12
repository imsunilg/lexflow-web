import { expect, test } from '@playwright/test';
import { loginAsStaffReal } from '../../fixtures/real-auth';

/**
 * PRD §37 flagged journey #3: lead Kanban board -> drag through pipeline
 * stages -> mark lost via the lost-reason dialog.
 *
 * Stage changes have two real, working entry points in this app:
 * `LeadsKanbanPage.onDrop()` (CDK drag-drop between columns, optimistic with
 * rollback) and `LeadDetailPage.changeStage()` (a plain `mat-select` on the
 * detail page's "next action" panel) — both call the same
 * `POST /leads/{id}/stage`. This journey exercises the Kanban drag-drop path
 * specifically since that's the flagged UI surface, using raw
 * mouse.down/move/up sequences (Angular CDK drag-drop listens on pointer
 * events, not the native HTML5 drag-and-drop protocol, so Playwright's
 * `dragTo()` helper doesn't reliably trigger it).
 */
test.describe('Journey 3: lead Kanban stage changes and mark-lost', () => {
  test('a lead is dragged across pipeline stages on the Kanban board, then marked lost', async ({
    page,
  }) => {
    await loginAsStaffReal(page);

    // 1. Create the lead directly from the Kanban board.
    const leadName = `E2E Kanban ${Date.now()}`;
    await page.goto('/leads/kanban');
    await page.getByRole('button', { name: /new lead/i }).click();
    await page.getByLabel(/first name/i).fill(leadName);
    await page.getByLabel(/last name/i).fill('Journey');
    await page
      .getByLabel(/^email/i)
      .fill(`${leadName.replace(/\s+/g, '-').toLowerCase()}@e2e.test`);
    await page.getByLabel(/phone/i).fill('+919812345679');
    await page.getByLabel(/issue summary/i).fill('E2E journey: Kanban drag-drop and mark lost.');
    await page.getByRole('button', { name: /^save$/i }).click();

    // The new lead lands in the "New" column.
    const newColumn = page.locator('[id="kanban-New"]');
    await expect(newColumn.getByText(leadName)).toBeVisible({ timeout: 15_000 });

    // 2. Drag the card from "New" to "Contacted" via a raw pointer sequence.
    await dragCardToColumn(page, leadName, 'Contacted');
    const contactedColumn = page.locator('[id="kanban-Contacted"]');
    await expect(contactedColumn.getByText(leadName)).toBeVisible({ timeout: 15_000 });

    // 3. Drag again from "Contacted" to "Consultation Scheduled".
    await dragCardToColumn(page, leadName, 'Consultation Scheduled');
    const consultColumn = page.locator('[id="kanban-Consultation Scheduled"]');
    await expect(consultColumn.getByText(leadName)).toBeVisible({ timeout: 15_000 });

    // 4. Open the lead detail page and mark it lost via the lost-reason dialog.
    await consultColumn.getByText(leadName).click();
    await expect(page).toHaveURL(/\/leads\/[0-9a-f-]+$/);
    await page.getByRole('button', { name: /mark lost/i }).click();

    const dialog = page.locator('mat-dialog-container');
    await dialog.getByLabel(/^reason$/i).click();
    await page.getByRole('option').first().click();
    await dialog.getByLabel(/notes/i).fill('E2E journey: client went with another firm.');
    await dialog.getByRole('button', { name: /mark lost/i }).click();

    // 5. The lead's status flips to Lost and the Convert/Mark lost actions disappear.
    await expect(page.getByRole('button', { name: /mark lost/i })).toBeHidden({ timeout: 15_000 });
    const statusField = page.locator('.profile-field', { hasText: 'Status' });
    await expect(statusField.getByText('Lost')).toBeVisible({ timeout: 15_000 });
  });
});

/** Drags a Kanban card (matched by its visible name text) into a target column's drop list, via raw pointer events. */
async function dragCardToColumn(
  page: import('@playwright/test').Page,
  cardText: string,
  targetStage: string,
): Promise<void> {
  const card = page.locator('.kanban-card', { hasText: cardText });
  const targetColumn = page.locator(`[id="kanban-${targetStage}"]`);

  const cardBox = await card.boundingBox();
  const targetBox = await targetColumn.boundingBox();
  if (!cardBox || !targetBox) {
    throw new Error('Could not resolve bounding boxes for drag-drop.');
  }

  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await page.mouse.down();
  // A few small intermediate moves so CDK's drag threshold registers the gesture as a drag, not a click.
  await page.mouse.move(cardBox.x + cardBox.width / 2 + 10, cardBox.y + cardBox.height / 2 + 10, {
    steps: 5,
  });
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 40, { steps: 15 });
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 60, { steps: 5 });
  await page.mouse.up();
}
