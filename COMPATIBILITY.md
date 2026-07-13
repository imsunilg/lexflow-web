# Compatibility

This repo's version lives in `VERSION` at the repo root. None of the three
repos (`lexflow-database`, `lexflow-api`, `lexflow-web`) has ever been
tagged or released — the matrix below starts from a declared baseline
(`0.1.0` in all three), not a retroactive reconstruction of prior history.

## What "web version" means here

Semver in `VERSION`, bumped by whoever changes this repo, using this rule:

- **MAJOR** — this build now requires a specific `lexflow-api` MAJOR
  version (its generated TS client was regenerated against a breaking API
  change), or a change here breaks something a consumer of this app
  (a bookmarked URL shape, an embedded iframe contract, etc.) depends on.
- **MINOR** — new features, additive use of new (optional) API
  fields/endpoints.
- **PATCH** — UI/UX fixes with no contract change either direction.

This repo has no schema and no server contract of its own to version
against downstream consumers — it's purely a consumer of `lexflow-api`.
See that repo's `COMPATIBILITY.md` for the full pairing rule (short
version: this app's TS client is generated from a specific point-in-time
snapshot of `lexflow-api`'s OpenAPI document, not kept live-in-sync
automatically — see `lexflow-api/client/README.md` for the regeneration
workflow).

## Current baseline

| lexflow-database | lexflow-api | lexflow-web | Notes |
|---|---|---|---|
| 0.1.0 | 0.1.0 | 0.1.0 | Declared baseline — see note above; not a tagged release. |

Append a row here whenever any repo's MAJOR or MINOR version changes in a
way that affects what the other two repos require.

## Local full-stack bring-up

See `lexflow-api/docs/local-dev.md` for booting all three repos together
(Postgres → DB Runner → API+Workers → this repo's two dev servers).
