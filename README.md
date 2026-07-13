# lexflow-web

Angular 20 workspace for the LexFlow Enterprise Lawyer CRM staff app and client
portal. Companion to `lexflow-api` (backend) and `lexflow-database` (schema).
See `LexFlow_PRD.md` §12/§13 and `LexFlow_Build_Playbook.md` §1.3 for the spec.

```
lexflow-web/
├── projects/
│   ├── shared/           publishable Angular library: design tokens, Tailwind
│   │                     theme wiring, Material theme, interceptors, guards,
│   │                     PermissionService, reusable UI components
│   ├── staff-portal/     internal staff app — icon-rail nav + top bar shell,
│   │                     lazy-loaded feature routes per PRD §13
│   └── client-portal/    client-facing portal — top bar + bottom nav shell,
│                         separate auth audience (/api/portal/v1), PRD Module 17
├── e2e/                  Playwright, targets both apps' dev servers
├── scripts/
│   └── check-bundle-budget.mjs   PRD §31 300 KB gz initial-bundle gate
└── .github/workflows/web-ci.yml
```

## Getting started

```bash
npm install
npm run start:staff-portal    # http://localhost:4200
npm run start:client-portal   # http://localhost:4300 (both can run at once)
```

Both `start:*` scripts pass `--proxy-config proxy.conf.json`, which forwards `/api`
and `/hubs` (SignalR) to `lexflow-api` on `http://localhost:5000` — the default port
from that repo's own README. Run `dotnet run --project src/LexFlow.Api` there first
(or point `proxy.conf.json`'s `target` at wherever it's actually running) for any
screen that calls the API, which by this point (auth screens, nav permission
trimming, search overlay, timer chip, notification bell) is most of the shell.

If `lexflow-api` is running via its own `docker-compose.full.yml` instead (API on
`:8080`, alongside Postgres/DB Runner already applied), use `npm run
start:staff-portal:full` / `start:client-portal:full` instead — same ports, but proxy
via `proxy.full.conf.json` to `:8080`. See `lexflow-api/docs/local-dev.md` for the
full cross-repo bring-up (Postgres → DB Runner → API+Workers → these two dev
servers, health-check gated end to end) and each repo's `COMPATIBILITY.md` for which
versions of the three repos are meant to run together.

Most feature pages are still placeholders — real module UI lands per the Build
Playbook's Phase D prompts — but the app shell itself (auth, nav, ⌘K search,
timer, notifications) is real, not a placeholder.

## Design system

Brand tokens (`--lf-*` CSS custom properties, PRD §12: colors, 8px spacing
grid, radius, elevation, typography) live in
`projects/shared/src/styles/_tokens.scss` and are shared by both apps via
`stylePreprocessorOptions.includePaths` (see `angular.json`). Angular Material
20 is skinned to those tokens in `_material-theme.scss`. Tailwind v4 utility
classes are available with Preflight disabled (Material already supplies a
base reset) — see the comment at the top of each app's `styles.scss`.

## Quality gates

```bash
npm run lint            # ESLint (projects/)
npm run lint:styles     # Stylelint (SCSS)
npm run format:check    # Prettier
npm run test:staff-portal / test:client-portal / test:shared
npm run e2e             # Playwright, boots both dev servers automatically
```

## i18n

Source locale is `en`; `hi` translations live in
`projects/<app>/src/locale/messages.hi.xlf`. Re-extract after adding new
`i18n="@@id"` attributes:

```bash
npm run i18n:extract:staff-portal
npm run i18n:extract:client-portal
npm run build:staff-portal:i18n   # produces dist/<app>/browser/{en,hi}/
npm run build:client-portal:i18n
```

## PWA

Both apps have `@angular/pwa` wired (`ngsw-config.json`, manifest, icons).
The service worker only activates in production builds (`provideServiceWorker`
is gated on `!isDevMode()` in each app's `app.config.ts`).

## CI

`.github/workflows/web-ci.yml` runs four parallel jobs on every PR: lint
(ESLint/Stylelint/Prettier), unit tests (all three projects, headless Chrome),
build + bundle-size budget check (PRD §31, ≤300 KB gz initial bundle), and a
Playwright smoke suite against both apps.
