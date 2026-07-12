import { defineConfig, devices } from '@playwright/test';

const STAFF_PORTAL_PORT = 4210;
const CLIENT_PORTAL_PORT = 4310;

/**
 * PRD §37: "E2E (Playwright: 40 critical journeys ...)". Deliberately a
 * SEPARATE config from `playwright.config.ts` (the fast, mocked-API
 * axe/shell-nav suite) rather than a mode switch on it: this one requires a
 * real backend to be reachable (docker-compose'd lexflow-api — see that
 * repo's `docker-compose.yml` — plus a one-time run of its
 * `tools/E2eSeed` console app to provision a login-capable user) and takes
 * much longer, so it must never accidentally run as part of the fast suite's
 * `npm run e2e`.
 *
 * `webServer` boots each Angular app with `--proxy-config
 * e2e/proxy.fullstack.conf.json`, which points `/api` and `/hubs` at
 * `localhost:8080` — the port docker-compose.yml exposes the API on. Set
 * PW_SKIP_WEBSERVER=1 to attach to dev servers you're already running
 * (e.g. `ng serve staff-portal --proxy-config e2e/proxy.fullstack.conf.json`)
 * instead.
 */
export default defineConfig({
  testDir: './tests-fullstack',
  fullyParallel: false, // journeys share one seeded tenant's data (leads/matters/invoices) — parallel runs would race on shared numbering/state.
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  timeout: 60_000,
  reporter: process.env['CI'] ? [['html', { open: 'never' }], ['github']] : 'list',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'staff-portal-fullstack',
      testDir: './tests-fullstack/staff-portal',
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${STAFF_PORTAL_PORT}` },
    },
    {
      name: 'client-portal-fullstack',
      testDir: './tests-fullstack/client-portal',
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${CLIENT_PORTAL_PORT}` },
    },
  ],
  webServer: process.env['PW_SKIP_WEBSERVER']
    ? undefined
    : [
        {
          command: `npx ng serve staff-portal --port ${STAFF_PORTAL_PORT} --proxy-config e2e/proxy.fullstack.conf.json`,
          url: `http://localhost:${STAFF_PORTAL_PORT}`,
          reuseExistingServer: !process.env['CI'],
          cwd: '..',
          timeout: 180_000,
        },
        {
          command: `npx ng serve client-portal --port ${CLIENT_PORTAL_PORT} --proxy-config e2e/proxy.fullstack.conf.json`,
          url: `http://localhost:${CLIENT_PORTAL_PORT}`,
          reuseExistingServer: !process.env['CI'],
          cwd: '..',
          timeout: 180_000,
        },
      ],
});
