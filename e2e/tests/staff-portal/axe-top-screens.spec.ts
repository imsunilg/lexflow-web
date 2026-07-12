import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { loginAsStaff, mockStaffPortalApi } from '../../fixtures/api-mock';

/**
 * G-AC7: "Axe-core CI on top 30 screens: zero critical violations." Screens
 * are reached via mocked auth + an empty-envelope API fallback (see
 * `fixtures/api-mock.ts`) since no live backend/seeded tenant exists in this
 * environment — this exercises each screen's real shell/nav/heading/form/
 * empty-state DOM, not populated-table markup.
 */
const SCREENS: { name: string; path: string }[] = [
  { name: 'Login', path: '/login' },
  { name: '2FA challenge', path: '/2fa' },
  { name: 'Forgot password', path: '/forgot-password' },
  { name: 'Accept invitation', path: '/accept-invitation' },
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Leads Kanban', path: '/leads/kanban' },
  { name: 'Leads List', path: '/leads/list' },
  { name: 'Clients List', path: '/clients/list' },
  { name: 'Matters List', path: '/matters/list' },
  { name: 'Calendar', path: '/calendar/view' },
  { name: 'Documents Explorer', path: '/documents' },
  { name: 'Billing Hub', path: '/billing' },
  { name: 'Billing Aging Report', path: '/billing/aging' },
  { name: 'Time Timesheet', path: '/time/timesheet' },
  { name: 'Time Entries', path: '/time/entries' },
  { name: 'Tasks My List', path: '/tasks' },
  { name: 'Tasks Board', path: '/tasks/board' },
  { name: 'Communication Inbox', path: '/communication/inbox' },
  { name: 'Communication SMS', path: '/communication/sms' },
  { name: 'Knowledge Base Home', path: '/knowledge-base/home' },
  { name: 'KB Articles', path: '/knowledge-base/articles' },
  { name: 'Reports Hub', path: '/reports/hub' },
  { name: 'AI Studio Hub', path: '/ai-studio' },
  { name: 'AI Research', path: '/ai-studio/research' },
  { name: 'Admin Users', path: '/admin/users' },
  { name: 'Admin Roles', path: '/admin/roles' },
];

test.describe('staff-portal axe-core top-screen pass', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStaff(page);
  });

  for (const screen of SCREENS) {
    test(`${screen.name} has zero critical/serious a11y violations`, async ({ page }) => {
      await mockStaffPortalApi(page);
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
