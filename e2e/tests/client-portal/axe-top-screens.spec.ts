import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { loginAsPortalClient, mockClientPortalApi } from '../../fixtures/api-mock';

/** G-AC7 axe-core pass for the client-portal screens (PRD §11 "Portal" list). */
const SCREENS: { name: string; path: string }[] = [
  { name: 'Login', path: '/login' },
  { name: 'Forgot password', path: '/forgot-password' },
  { name: 'Home', path: '/home' },
  { name: 'Matters', path: '/matters' },
  { name: 'Invoices', path: '/invoices' },
  { name: 'Documents', path: '/documents' },
  { name: 'Appointments', path: '/appointments' },
  { name: 'Messages', path: '/messages' },
  { name: 'Profile', path: '/profile' },
];

test.describe('client-portal axe-core top-screen pass', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsPortalClient(page);
  });

  for (const screen of SCREENS) {
    test(`${screen.name} has zero critical/serious a11y violations`, async ({ page }) => {
      await mockClientPortalApi(page);
      await page.goto(screen.path);
      await page.waitForLoadState('networkidle');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const blocking = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      );

      if (blocking.length > 0) {
        const summary = blocking
          .map((v) => `${v.impact}: ${v.id} — ${v.help} (${v.nodes.length} node(s))`)
          .join('\n');
        expect(blocking, `Violations on ${screen.name} (${screen.path}):\n${summary}`).toEqual([]);
      }
    });
  }
});
