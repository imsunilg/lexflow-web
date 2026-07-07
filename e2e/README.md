# e2e

Playwright config targeting both app dev servers (`staff-portal` on :4200,
`client-portal` on :4300). `webServer` boots `ng serve` for each app
automatically.

```bash
npm run e2e                       # boots both dev servers, runs all specs
PW_SKIP_WEBSERVER=1 npm run e2e   # attach to servers you're already running
```

Current specs are smoke-level only (redirect-to-login, placeholder pages) —
real user-journey specs (lead→convert→matter, WIP→invoice→pay, etc., PRD §37)
land as each module is built out in Phase D.
