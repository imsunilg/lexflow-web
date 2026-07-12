import { Page } from '@playwright/test';

/**
 * Real-backend login (PRD §37: 40 critical journeys run against the full
 * local stack — docker-compose'd lexflow-api + these apps' own dev servers —
 * not the mocked-API fixture used by `fixtures/api-mock.ts`'s fast axe/shell
 * suite). Credentials must match `tools/E2eSeed` in the sibling `lexflow-api`
 * checkout, which seeds exactly one login-capable user (the "owner" role,
 * full permission reach) into the `lexflow-demo` tenant that
 * `16_Seed/008_Demo_Tenant.sql` already creates. Overridable via env vars so
 * CI/local runs can point at a differently-seeded tenant without editing code.
 */
export const E2E_TENANT_SLUG = process.env['E2E_TENANT_SLUG'] ?? 'lexflow-demo';
export const E2E_EMAIL = process.env['E2E_EMAIL'] ?? 'e2e.lawyer@lexflow-demo.test';
export const E2E_PASSWORD = process.env['E2E_PASSWORD'] ?? 'E2eTest!2025';

export const E2E_PORTAL_EMAIL = process.env['E2E_PORTAL_EMAIL'] ?? 'e2e.client@lexflow-demo.test';
export const E2E_PORTAL_PASSWORD = process.env['E2E_PORTAL_PASSWORD'] ?? 'E2ePortal!2025';
/** `crm.clients.id` for the one client `tools/E2eSeed` provisions with `portal_enabled = true` — create matters/invoices under this client id for journeys that need portal visibility. */
export const E2E_PORTAL_CLIENT_ID = '00000000-0000-0000-0000-e2e000000003';

export async function loginAsStaffReal(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/firm workspace/i).fill(E2E_TENANT_SLUG);
  await page.getByLabel(/email/i).fill(E2E_EMAIL);
  await page.getByLabel(/password/i).fill(E2E_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

/**
 * Logs in as the one portal user `tools/E2eSeed` provisions directly (bypasses
 * the real invite-email flow, which this environment can't complete without a
 * mailbox — see the seed tool's own comment). That seeded portal user is
 * scoped to one seeded client (`crm.clients` id
 * `00000000-0000-0000-0000-e2e000000003`) with `visible_matter_ids` NULL (all
 * of that client's matters visible) — journeys needing a portal-visible
 * matter/invoice must create it under that client, not an arbitrary one.
 */
export async function loginAsPortalClientReal(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/firm code/i).fill(E2E_TENANT_SLUG);
  await page.getByLabel(/email/i).fill(E2E_PORTAL_EMAIL);
  await page.getByLabel(/password/i).fill(E2E_PORTAL_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/home/, { timeout: 30_000 });
}
