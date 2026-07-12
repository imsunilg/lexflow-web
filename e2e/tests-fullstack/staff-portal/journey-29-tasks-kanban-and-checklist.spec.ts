import { expect, test } from '@playwright/test';
import { loginAsStaffReal } from '../../fixtures/real-auth';

/**
 * PRD §37 flagged journey #29: tasks Kanban board + checklist -> create a
 * task, drag it across status columns, then complete a checklist item from
 * its detail drawer (`tasks/board/kanban-board.page.ts`,
 * `tasks/detail/task-detail-drawer.component.ts`).
 *
 * Uses the same raw pointer-event drag sequence as Journey 3's lead Kanban
 * board — Angular CDK drag-drop listens on pointer events, not the native
 * HTML5 drag-and-drop protocol, so Playwright's `dragTo()` helper doesn't
 * reliably trigger it.
 */
test.describe('Journey 29: tasks Kanban board and checklist', () => {
  test('a task is created, dragged across Kanban columns, and a checklist item is completed', async ({
    page,
  }) => {
    await loginAsStaffReal(page);

    // 1. Create a task via the composer dialog. No matter/owner needed — both are optional.
    const taskTitle = `E2E Kanban Task ${Date.now()}`;
    await page.goto('/tasks/board');
    await page.getByRole('button', { name: /new task/i }).click();
    const composer = page.locator('mat-dialog-container');
    await composer.getByLabel(/^title/i).fill(taskTitle);
    await composer.getByRole('button', { name: /create task/i }).click();
    await expect(composer).toBeHidden({ timeout: 15_000 });

    const newColumn = page.locator('[id="kanban-New"]');
    await expect(newColumn.getByText(taskTitle)).toBeVisible({ timeout: 15_000 });

    // 2. Drag the card across two status columns.
    await dragCardToColumn(page, taskTitle, 'InProgress');
    const inProgressColumn = page.locator('[id="kanban-InProgress"]');
    await expect(inProgressColumn.getByText(taskTitle)).toBeVisible({ timeout: 15_000 });

    await dragCardToColumn(page, taskTitle, 'InReview');
    const inReviewColumn = page.locator('[id="kanban-InReview"]');
    await expect(inReviewColumn.getByText(taskTitle)).toBeVisible({ timeout: 15_000 });

    // 3. Open the task's detail drawer and complete a checklist item.
    await inReviewColumn.getByText(taskTitle).click();
    const drawer = page.locator('mat-dialog-container', { hasText: taskTitle });
    await expect(drawer).toBeVisible({ timeout: 15_000 });

    // Scoped to the Checklist section specifically — the drawer has three sections
    // (Assignees, Checklist, Dependencies) that each render a plain "Add" button.
    const checklistSection = drawer.locator('.detail__section', { hasText: /checklist/i });
    const checklistLabel = `E2E checklist item ${Date.now()}`;
    await checklistSection.getByLabel(/new checklist item/i).fill(checklistLabel);
    await checklistSection.getByRole('button', { name: /^add$/i }).click();

    const checklistItem = drawer.locator('.detail__checklist-item', { hasText: checklistLabel });
    await expect(checklistItem).toBeVisible({ timeout: 15_000 });
    await checklistItem.getByRole('checkbox').check();
    await expect(checklistItem.getByRole('checkbox')).toBeChecked();

    // Scoped to the dialog's own action bar — chip-remove buttons elsewhere in the drawer are
    // icon-only `mat-icon-button`s whose Material-icon ligature text also reads "close".
    await drawer
      .locator('mat-dialog-actions')
      .getByRole('button', { name: /^close$/i })
      .click();
  });
});

/** Drags a Kanban task card (matched by its visible title text) into a target status column, via raw pointer events. */
async function dragCardToColumn(
  page: import('@playwright/test').Page,
  cardText: string,
  targetStatus: string,
): Promise<void> {
  const card = page.locator('.board__card', { hasText: cardText });
  const targetColumn = page.locator(`[id="kanban-${targetStatus}"]`);

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
