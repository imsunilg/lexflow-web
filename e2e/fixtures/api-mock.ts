import { Page } from '@playwright/test';

/**
 * G-AC7 axe-core pass needs authenticated, rendered screens, but this
 * environment has no running .NET backend / seeded tenant to log into for
 * real. Rather than skip authenticated screens entirely, every `/api/*`
 * call is intercepted: auth endpoints return a fake-but-shaped successful
 * session (broad permission grant so nav/route guards never block), and
 * every other GET falls back to an empty-but-valid envelope. This renders
 * each screen's real DOM/ARIA structure — shell, nav, headings, forms,
 * empty states — which is exactly what axe-core inspects; it does not
 * exercise data-table-with-rows markup, which would need real fixture rows
 * to render (a follow-up beyond this pass, noted in the final report).
 */

const STAFF_PERMISSIONS = [
  'leads.read.all',
  'clients.read.all',
  'matters.read.all',
  'documents.read.all',
  'billing.read.all',
  'reports.read.all',
  'admin.read.all',
  'reports.operational.own',
  'ai.use.own',
  'users.read.all',
];

export async function mockStaffPortalApi(page: Page): Promise<void> {
  // Catch-all registered first — Playwright tries routes most-recently-added
  // first, so the specific routes registered after this one take priority.
  await page.route('**/api/v1/**', (route) => {
    const isGet = route.request().method() === 'GET';
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: isGet ? [] : {} }),
    });
  });

  await page.route('**/api/v1/auth/login', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          accessToken: 'e2e-fake-token',
          expiresIn: 3600,
          requires2fa: false,
          user: {
            id: 'e2e-user',
            name: 'E2E Tester',
            role: 'Partner',
            permissions: STAFF_PERMISSIONS,
            branchId: null,
          },
        },
      }),
    }),
  );

  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          id: 'e2e-user',
          name: 'E2E Tester',
          email: 'e2e@example.com',
          role: 'Partner',
          permissions: STAFF_PERMISSIONS,
          branchId: null,
          twoFaEnabled: false,
        },
      }),
    }),
  );

  await page.route('**/api/v1/permissions/catalog', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    }),
  );
}

export async function loginAsStaff(page: Page): Promise<void> {
  await mockStaffPortalApi(page);
  await page.goto('/login');
  await page.getByLabel(/firm workspace/i).fill('e2e-tenant');
  await page.getByLabel(/email/i).fill('e2e@example.com');
  await page.getByLabel(/password/i).fill('Password123!');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard/);
}

export async function mockClientPortalApi(page: Page): Promise<void> {
  await page.route('**/api/portal/v1/**', (route) => {
    const isGet = route.request().method() === 'GET';
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: isGet ? [] : {} }),
    });
  });

  await page.route('**/api/portal/v1/auth/login', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          accessToken: 'e2e-fake-token',
          expiresIn: 3600,
          user: {
            id: 'e2e-portal-user',
            clientId: 'e2e-client',
            name: 'E2E Client',
            email: 'client@example.com',
          },
        },
      }),
    }),
  );
}

export async function loginAsPortalClient(page: Page): Promise<void> {
  await mockClientPortalApi(page);
  await page.goto('/login');
  await page.getByLabel(/firm code/i).fill('e2e-tenant');
  await page.getByLabel(/email/i).fill('client@example.com');
  await page.getByLabel(/password/i).fill('Password123!');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/home/);
}
