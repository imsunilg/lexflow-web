import { expect, test } from '@playwright/test';
import { loginAsStaffReal } from '../../fixtures/real-auth';

/**
 * PRD §37 journey #34: KB article lifecycle — draft -> submit for review ->
 * approve & publish -> add to a collection.
 *
 * `article-editor.page.ts`'s own doc comment states the peer-review rule
 * (Draft -> InReview -> Published) requires a reviewer who isn't the
 * article's author, backstopped by a DB trigger. This environment's
 * `tools/E2eSeed` provisions exactly one login-capable user (the "owner"
 * role), so there is no second identity to log in as and act as reviewer.
 * Rather than skip the approval step, this journey uses the real, working
 * `/admin/users` "Invite user" flow (same one journey #38 exercises) to
 * create a second, distinct `core.users` row — the invited user never
 * activates (no mailbox to complete the invite in this environment, exactly
 * like journey #38 documents), but `approve()` only compares reviewer id !=
 * author id; an Invited-but-not-yet-Active user is a perfectly valid reviewer
 * for that check, so this is a real second identity, not a faked one.
 *
 * There is no "review queue" page separate from the article list/editor —
 * `knowledge-base.routes.ts` has no such route. The article list's own
 * `<lf-status-chip>` on each row (Draft/InReview/Published) *is* the review
 * queue: submitting for review changes the row's status chip, and a
 * reviewer opens the same editor page to approve. This journey drives that
 * real flow rather than inventing a queue UI that doesn't exist.
 */
test.describe('Journey 34: KB article lifecycle', () => {
  test('a draft article is submitted, approved & published, then added to a collection', async ({
    page,
  }) => {
    await loginAsStaffReal(page);

    // 0. Invite a second user to act as reviewer (see file header comment).
    const reviewerName = `E2E KB Reviewer ${Date.now()}`;
    const reviewerEmail = `e2e-kb-reviewer-${Date.now()}@e2e.test`;
    await page.goto('/admin/users');
    await page.getByRole('button', { name: /invite user/i }).click();
    await page.getByLabel(/^name$/i).fill(reviewerName);
    await page.getByLabel(/^email$/i).fill(reviewerEmail);
    await page.getByLabel(/^role$/i).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: /send invitation/i }).click();
    await expect(
      page.getByText(new RegExp(`invitation sent to ${reviewerEmail}`, 'i')),
    ).toBeVisible({ timeout: 15_000 });

    // 1. Create a draft article.
    const articleTitle = `E2E KB Article ${Date.now()}`;
    await page.goto('/knowledge-base/articles');
    await page.getByRole('button', { name: /new article/i }).click();
    await expect(page).toHaveURL(/\/knowledge-base\/articles\/new$/);
    await page.getByLabel(/^title$/i).fill(articleTitle);
    await page.getByLabel(/^body$/i).fill('E2E journey content: contribution editor smoke test.');
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page).toHaveURL(/\/knowledge-base\/articles\/[0-9a-f-]+$/, { timeout: 15_000 });

    // 2. Attach a tag — publishing requires >= 1 tag (server-enforced).
    await page.getByLabel(/add tag/i).fill('e2e-journey');
    await page.getByRole('button', { name: /^add$/i }).click();
    await expect(page.getByText('e2e-journey')).toBeVisible({ timeout: 10_000 });

    // 3. Submit for review — the article's own status chip becomes the "review queue" signal.
    await page.getByRole('button', { name: /submit for review/i }).click();
    await expect(page.getByText('InReview')).toBeVisible({ timeout: 15_000 });

    // 4. Assign the invited user as reviewer and approve & publish.
    await page.getByLabel(/^reviewer$/i).fill('KB Reviewer');
    await page.getByRole('option', { name: reviewerName }).click();
    await page.getByRole('button', { name: /approve & publish/i }).click();
    await expect(page.getByText(/published/i).first()).toBeVisible({ timeout: 15_000 });

    // 5. Add the newly published article to a new collection (search only
    // finds Published content — Draft/InReview articles never reach the
    // index, per `KbArticleService.PublishAsync`'s own comment: "only
    // Publish indexes an article").
    const collectionName = `E2E Collection ${Date.now()}`;
    await page.goto('/knowledge-base/collections');
    await page.getByRole('button', { name: /new collection/i }).click();
    await page.getByLabel(/^name$/i).fill(collectionName);
    await page.getByRole('button', { name: /^create$/i }).click();
    await expect(page.getByText(collectionName)).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /add item/i }).click();
    await page.getByLabel(/search acts, judgments, articles/i).fill(articleTitle);
    // Publish -> index is synchronous server-side, but ES's own refresh
    // interval still needs a moment — poll rather than a fixed wait.
    const hitRow = page.locator('.collections__hit-row', { hasText: articleTitle });
    await expect(hitRow).toBeVisible({ timeout: 20_000 });
    await hitRow.click();

    // The article now appears as a card in the collection's Items grid.
    await expect(page.locator('.collections__card', { hasText: articleTitle })).toBeVisible({
      timeout: 15_000,
    });
  });
});
