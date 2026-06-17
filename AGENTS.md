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

## Releases & changelog

GitHub release bodies come from **`CHANGELOG.md`**, not GitHub’s auto-generated PR summary. The release workflow (`.github/workflows/release.yml`) extracts the section for the tagged version and publishes it. If that section is missing, the release job fails.

### Keep release notes current

**Every user-facing change** (features, fixes, deprecations, CLI flag changes, docs that affect operators) must get a bullet under the appropriate heading in `CHANGELOG.md` in the **same PR** as the change — do not defer changelog updates to release time.

Use [Keep a Changelog](https://keepachangelog.com/) headings:

- `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`, `Documentation`

### Cut a release

1. Ensure `CHANGELOG.md` has a section for the new version:

   ```markdown
   ## [0.4.4] - 2026-06-17

   ### Added
   - ...
   ```

2. Set `package.json` `"version"` to the same semver (no `v` prefix).
3. Commit on `main`, then tag and push:

   ```bash
   git tag v0.4.4
   git push origin v0.4.4
   ```

4. The **Release** workflow runs on `v*` tags: lint, test, build, `npm publish`, then creates/updates the GitHub release with the matching `CHANGELOG.md` section plus a compare link to the previous tag.

**Checks:** tag must match `package.json`; `CHANGELOG.md` must contain `## [X.Y.Z] - …` for that version.

### Fix a release that already shipped with empty notes

Edit the release on GitHub (**Releases → select version → Edit**) and paste the section from `CHANGELOG.md`, or delete the release/tag and re-push the tag after `CHANGELOG.md` is correct (only if npm republish policy allows — prefer manual edit for published versions).
