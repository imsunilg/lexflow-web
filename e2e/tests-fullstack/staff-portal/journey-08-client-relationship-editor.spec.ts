import { expect, test } from '@playwright/test';
import { loginAsStaffReal } from '../../fixtures/real-auth';

/**
 * PRD §37 flagged journey #8: client 360 detail — link two clients via
 * `RelationshipGraphComponent` (`clients/detail/relationship-graph.component.ts`,
 * PRD Module 3 UI Components' "relationship graph visual"), then verify the
 * link is real by following it to the actual related client.
 *
 * Honest one-directional model, not a bug being routed around: the API's
 * `AddRelationshipAsync` (`ClientService.cs`) inserts exactly one
 * `ClientRelationship` row, scoped to the client the request was made
 * against — it does not also insert a reciprocal row on the related client.
 * So client B's own relationship graph will NOT show a link back to client A
 * after this journey; that's the shipped data model, not a stub. This
 * journey verifies the link the *right* way for that model: add it on A,
 * confirm the node renders on A's graph, then follow the node's click-through
 * to confirm it truly resolves to the real client B (its own 360 page loads
 * with B's own display name) — i.e. the relationship is reflected on A's page
 * directly, and independently verified as pointing at B's real page.
 */
test.describe('Journey 8: client relationship editor', () => {
  test('linking two clients on the relationship graph renders the link and resolves to the real related client', async ({
    page,
  }) => {
    await loginAsStaffReal(page);

    // 1. Create client A (the one we'll add the relationship on).
    const stamp = Date.now();
    const nameA = `E2E Relate A ${stamp}`;
    await page.goto('/clients/new');
    await page.getByLabel(/first name/i).fill(nameA);
    await page.getByLabel(/last name/i).fill('Journey');
    await page.getByLabel(/^email/i).fill(`relate-a-${stamp}@e2e.test`);
    await page.getByLabel(/phone/i).fill('+919812380001');
    await page.getByRole('button', { name: /^next$/i }).click();
    await page.getByRole('button', { name: /^next$/i }).click();
    await page.getByRole('button', { name: /^next$/i }).click();
    await page.getByRole('button', { name: /create client/i }).click();
    await expect(page).toHaveURL(/\/clients\/[0-9a-f-]+$/, { timeout: 15_000 });
    const clientAId = page.url().split('/clients/')[1];

    // 2. Create client B (the related client).
    const nameB = `E2E Relate B ${stamp}`;
    await page.goto('/clients/new');
    await page.getByLabel(/first name/i).fill(nameB);
    await page.getByLabel(/last name/i).fill('Journey');
    await page.getByLabel(/^email/i).fill(`relate-b-${stamp}@e2e.test`);
    await page.getByLabel(/phone/i).fill('+919812380002');
    await page.getByRole('button', { name: /^next$/i }).click();
    await page.getByRole('button', { name: /^next$/i }).click();
    await page.getByRole('button', { name: /^next$/i }).click();
    await page.getByRole('button', { name: /create client/i }).click();
    await expect(page).toHaveURL(/\/clients\/[0-9a-f-]+$/, { timeout: 15_000 });
    const clientBId = page.url().split('/clients/')[1];

    // 3. Back on A's 360 page, add a relationship linking to B.
    await page.goto(`/clients/${clientAId}`);
    await expect(page.getByText(nameA)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /add relationship/i }).click();
    await page.getByLabel(/relation type/i).click();
    await page.getByRole('option', { name: 'ParentCompany' }).click();
    await page.getByLabel(/related client id/i).fill(clientBId);
    await page.getByRole('button', { name: /^save$/i }).click();

    // 4. Verify the link is reflected on A's graph: a node labelled with B's id prefix appears.
    const nodeLabel = `Client ${clientBId.slice(0, 8)}`;
    await expect(page.getByText(nodeLabel)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('ParentCompany')).toBeVisible({ timeout: 15_000 });

    // 5. Follow the node's click-through and confirm it resolves to the real client B.
    await page.getByText(nodeLabel).click();
    await expect(page).toHaveURL(new RegExp(`/clients/${clientBId}$`), { timeout: 15_000 });
    await expect(page.getByText(nameB)).toBeVisible({ timeout: 15_000 });
  });
});
