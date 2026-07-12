# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: staff-portal\axe-top-screens.spec.ts >> staff-portal axe-core top-screen pass >> Login has zero critical/serious a11y violations
- Location: e2e\tests\staff-portal\axe-top-screens.spec.ts:47:9

# Error details

```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /sign in/i })
    - locator resolved to <button type="submit" color="primary" disabled="true" mat-flat-button="" _ngcontent-ng-c2843051650="" mat-ripple-loader-disabled="" mat-ripple-loader-uninitialized="" mat-ripple-loader-class-name="mat-mdc-button-ripple" class="mdc-button mat-mdc-button-base auth-submit mdc-button--unelevated mat-mdc-unelevated-button mat-primary mat-mdc-button-disabled">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not enabled
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not enabled
    - retrying click action
      - waiting 100ms
    51 × waiting for element to be visible, enabled and stable
       - element is not enabled
     - retrying click action
       - waiting 500ms

```

# Page snapshot

```yaml
- generic "Sign in" [ref=e4]:
  - generic [ref=e6]:
    - heading "Sign in" [level=1] [ref=e7]
    - paragraph [ref=e8]: Sign in to your LexFlow workspace
    - generic [ref=e9]:
      - generic [ref=e12]:
        - generic [ref=e13]:
          - text: Firm workspace
          - generic [ref=e14]: "*"
        - textbox "Firm workspace" [ref=e16]
      - generic [ref=e20]:
        - generic [ref=e21]:
          - text: Email
          - generic [ref=e22]: "*"
        - textbox "Email" [ref=e24]: e2e@example.com
      - generic [ref=e28]:
        - generic [ref=e29]:
          - text: Password
          - generic [ref=e30]: "*"
        - textbox "Password" [active] [ref=e32]: Password123!
      - button "Sign in" [disabled]:
        - generic: Sign in
      - link "Forgot password?" [ref=e34] [cursor=pointer]:
        - /url: /forgot-password
```

# Test source

```ts
  1   | import { Page } from '@playwright/test';
  2   | 
  3   | /**
  4   |  * G-AC7 axe-core pass needs authenticated, rendered screens, but this
  5   |  * environment has no running .NET backend / seeded tenant to log into for
  6   |  * real. Rather than skip authenticated screens entirely, every `/api/*`
  7   |  * call is intercepted: auth endpoints return a fake-but-shaped successful
  8   |  * session (broad permission grant so nav/route guards never block), and
  9   |  * every other GET falls back to an empty-but-valid envelope. This renders
  10  |  * each screen's real DOM/ARIA structure — shell, nav, headings, forms,
  11  |  * empty states — which is exactly what axe-core inspects; it does not
  12  |  * exercise data-table-with-rows markup, which would need real fixture rows
  13  |  * to render (a follow-up beyond this pass, noted in the final report).
  14  |  */
  15  | 
  16  | const STAFF_PERMISSIONS = [
  17  |   'leads.read.all',
  18  |   'clients.read.all',
  19  |   'matters.read.all',
  20  |   'documents.read.all',
  21  |   'billing.read.all',
  22  |   'reports.read.all',
  23  |   'admin.read.all',
  24  |   'reports.operational.own',
  25  |   'ai.use.own',
  26  |   'users.read.all',
  27  | ];
  28  | 
  29  | export async function mockStaffPortalApi(page: Page): Promise<void> {
  30  |   // Catch-all registered first — Playwright tries routes most-recently-added
  31  |   // first, so the specific routes registered after this one take priority.
  32  |   await page.route('**/api/v1/**', (route) => {
  33  |     const isGet = route.request().method() === 'GET';
  34  |     return route.fulfill({
  35  |       contentType: 'application/json',
  36  |       body: JSON.stringify({ success: true, data: isGet ? [] : {} }),
  37  |     });
  38  |   });
  39  | 
  40  |   await page.route('**/api/v1/auth/login', (route) =>
  41  |     route.fulfill({
  42  |       contentType: 'application/json',
  43  |       body: JSON.stringify({
  44  |         success: true,
  45  |         data: {
  46  |           accessToken: 'e2e-fake-token',
  47  |           expiresIn: 3600,
  48  |           requires2fa: false,
  49  |           user: {
  50  |             id: 'e2e-user',
  51  |             name: 'E2E Tester',
  52  |             role: 'Partner',
  53  |             permissions: STAFF_PERMISSIONS,
  54  |             branchId: null,
  55  |           },
  56  |         },
  57  |       }),
  58  |     }),
  59  |   );
  60  | 
  61  |   await page.route('**/api/v1/auth/me', (route) =>
  62  |     route.fulfill({
  63  |       contentType: 'application/json',
  64  |       body: JSON.stringify({
  65  |         success: true,
  66  |         data: {
  67  |           id: 'e2e-user',
  68  |           name: 'E2E Tester',
  69  |           email: 'e2e@example.com',
  70  |           role: 'Partner',
  71  |           permissions: STAFF_PERMISSIONS,
  72  |           branchId: null,
  73  |           twoFaEnabled: false,
  74  |         },
  75  |       }),
  76  |     }),
  77  |   );
  78  | 
  79  |   await page.route('**/api/v1/permissions/catalog', (route) =>
  80  |     route.fulfill({
  81  |       contentType: 'application/json',
  82  |       body: JSON.stringify({ success: true, data: [] }),
  83  |     }),
  84  |   );
  85  | }
  86  | 
  87  | export async function loginAsStaff(page: Page): Promise<void> {
  88  |   await mockStaffPortalApi(page);
  89  |   await page.goto('/login');
  90  |   await page.getByLabel(/email/i).fill('e2e@example.com');
  91  |   await page.getByLabel(/password/i).fill('Password123!');
> 92  |   await page.getByRole('button', { name: /sign in/i }).click();
      |                                                        ^ Error: locator.click: Test timeout of 30000ms exceeded.
  93  |   await page.waitForURL(/\/dashboard/);
  94  | }
  95  | 
  96  | export async function mockClientPortalApi(page: Page): Promise<void> {
  97  |   await page.route('**/api/portal/v1/**', (route) => {
  98  |     const isGet = route.request().method() === 'GET';
  99  |     return route.fulfill({
  100 |       contentType: 'application/json',
  101 |       body: JSON.stringify({ success: true, data: isGet ? [] : {} }),
  102 |     });
  103 |   });
  104 | 
  105 |   await page.route('**/api/portal/v1/auth/login', (route) =>
  106 |     route.fulfill({
  107 |       contentType: 'application/json',
  108 |       body: JSON.stringify({
  109 |         success: true,
  110 |         data: {
  111 |           accessToken: 'e2e-fake-token',
  112 |           expiresIn: 3600,
  113 |           user: {
  114 |             id: 'e2e-portal-user',
  115 |             clientId: 'e2e-client',
  116 |             name: 'E2E Client',
  117 |             email: 'client@example.com',
  118 |           },
  119 |         },
  120 |       }),
  121 |     }),
  122 |   );
  123 | }
  124 | 
  125 | export async function loginAsPortalClient(page: Page): Promise<void> {
  126 |   await mockClientPortalApi(page);
  127 |   await page.goto('/login');
  128 |   await page.getByLabel(/firm code/i).fill('e2e-tenant');
  129 |   await page.getByLabel(/email/i).fill('client@example.com');
  130 |   await page.getByLabel(/password/i).fill('Password123!');
  131 |   await page.getByRole('button', { name: /sign in/i }).click();
  132 |   await page.waitForURL(/\/home/);
  133 | }
  134 | 
```