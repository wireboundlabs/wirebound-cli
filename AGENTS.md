# Agent guide — wirebound-cli

Instructions for AI agents working in this repository.

## Project

TypeScript CLI (`@wireboundlabs/cli`, binary `wirebound`) for Auth0 tenant maintenance. Stack: oclif, Mocha + c8, GitHub Actions, Codecov.

## Before changing code

1. Run `npx fallow` from the repo root and address issues related to your change.
2. Match existing patterns: `@/` imports, dry-run defaults, `WireboundCommand` / `Auth0Command` base classes, nock for HTTP in tests.

## Test coverage — non‑negotiable

We do **not** tune thresholds to whatever the suite currently passes. Coverage is a quality bar, not a checkbox.

| Metric | Target | Minimum (CI gate) |
|--------|--------|-------------------|
| Lines | **95%** | **90%** |
| Statements | **95%** | **90%** |
| Functions | **95%** | **90%** |
| Branches | **90%** | **85%** |

- **Target (95%)**: what new code and meaningful changes should achieve. If you add a module, test it properly — don’t leave large untested surfaces.
- **Minimum (90% / 85%)**: enforced by `npm run test:coverage` via `.c8rc.json`. CI fails below these floors.
- **Codecov**: line coverage on `main` should stay **≥ 90%**; aim for **95%** on PRs that touch `src/`.

### Exclusions (only these)

- `src/lib/setup/prompt-auth0-credentials.ts` — interactive prompts; covered via command integration, not unit-tested in isolation.
- `src/lib/auth0/types.ts` — type-only definitions.

Do **not** add exclusions to avoid writing tests. Refactor untestable code (pure helpers, injectable deps) instead.

### How to test

- **Commands**: `@oclif/test` `runCommand` + nock for Auth0 API.
- **Libraries**: unit tests under `test/` mirroring `src/`.
- **HTTP**: nock; never hit real Auth0 in tests.
- **Progress / terminal UI**: extract pure logic into testable helpers; keep TTY rendering thin.

Run before opening a PR:

```bash
npm run lint
npm run test:coverage
```

## Commits & PRs

- Do not commit unless asked.
- Keep diffs focused; no drive-by refactors.
- PRs should note test plan and coverage impact when touching `src/`.
