import { defineConfig, devices } from '@playwright/test';

const STAFF_PORTAL_PORT = 4200;
const CLIENT_PORTAL_PORT = 4300;

/**
 * Playwright config pointed at both app dev servers (PRD Build Playbook §1.3).
 * `webServer` boots each app's `ng serve` automatically for local runs and CI;
 * set PW_SKIP_WEBSERVER=1 to attach to servers you're already running instead.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: process.env['CI'] ? [['html', { open: 'never' }], ['github']] : 'list',
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'staff-portal',
      testDir: './tests/staff-portal',
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${STAFF_PORTAL_PORT}` },
    },
    {
      name: 'client-portal',
      testDir: './tests/client-portal',
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${CLIENT_PORTAL_PORT}` },
    },
  ],
  webServer: process.env['PW_SKIP_WEBSERVER']
    ? undefined
    : [
        {
          command: `npx ng serve staff-portal --port ${STAFF_PORTAL_PORT}`,
          url: `http://localhost:${STAFF_PORTAL_PORT}`,
          reuseExistingServer: !process.env['CI'],
          cwd: '..',
          timeout: 120_000,
        },
        {
          command: `npx ng serve client-portal --port ${CLIENT_PORTAL_PORT}`,
          url: `http://localhost:${CLIENT_PORTAL_PORT}`,
          reuseExistingServer: !process.env['CI'],
          cwd: '..',
          timeout: 120_000,
        },
      ],
});
