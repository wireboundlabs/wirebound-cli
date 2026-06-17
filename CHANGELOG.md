# Changelog

## [0.4.3] - 2026-06-17

### Documentation

- README: rename CI checklist to **CI best practices** and use plain bullets instead of GitHub task-list checkboxes
- README, CONFIGURATION, and Auth0 vendor guide: clarify that `AUTH0_PLAN` on paid tenants unlocks your subscription's higher rate limits (CLI defaults to free-tier 2 req/s), rather than primarily avoiding HTTP 429s
- CONFIGURATION and Auth0 vendor guide: HTTP 429 troubleshooting now focuses on reducing `--rps` and automatic retries

## [0.4.2] - 2026-06-17

### Added

- `wirebound auth0 users cleanup-google-orphans` — clearer name for removing Auth0 users with exactly one Google identity (dry-run by default)

### Changed

- `wirebound auth0 delete-google-users` is now an alias for `auth0 users cleanup-google-orphans` (behavior unchanged; `--confirm` still required to delete)
- Invoking `auth0 delete-google-users` prints a deprecation warning pointing to `auth0 users cleanup-google-orphans`
- README: star-the-repo call-to-action for discoverability

### Documentation

- Updated command examples across README, CONFIGURATION, and Auth0 vendor docs to use the new primary path

## [0.4.0] - 2026-06-16

### Added

- Auth0 plan-aware rate limiting: `--auth0-plan` / `AUTH0_PLAN` (`free`, `essentials-professional`, `enterprise`)
- Tenant environment option for Enterprise limits: `--auth0-tenant-env` / `AUTH0_TENANT_ENV` (`production`, `non-production`)
- Per-endpoint Management API throttling on paid plans, aligned with [Auth0 rate limit docs](https://auth0.com/docs/troubleshoot/customer-support/operational-policies/rate-limit-policy)
- Optional global override via `--rps` / `AUTH0_RPS` (endpoint limits still apply)

### Changed

- Default rate limits derive from plan when `--rps` is not set (Free tenants remain at 2 req/s)

## [0.1.1] - 2026-06-12

### Added

- `wirebound setup` — interactive Auth0 credential setup for repo-local config
  - Writes profiles to `.wirebound/profiles/<name>.env` (mode `600`)
  - `--profile`, `--default`, `--list`, `--check`, `--force`, and `--dir` flags
  - Prompts to set a repo default profile (`.wirebound/default`)
  - Appends `.wirebound/` to `.gitignore` when possible
- Multi-profile support per repo (e.g. `dev`, `test`, `production`)
- Auto-discovery of repo-local config when running commands from any subdirectory
- `--profile` resolves repo-local profiles first, then global profiles
- `@inquirer/prompts` for masked secret input during setup

### Changed

- Documentation updated for repo-local, multi-profile workflow
- `--profile` flag description reflects repo-local and global profile resolution

### Deprecated

- Single-file `.wirebound/config.env` remains supported as a fallback when no named profile or default is set

## [0.1.0] - 2026-06-11

### Added

- Initial release of `@wireboundlabs/cli` with binary `wirebound`
- `wirebound auth0 delete-google-users` command
  - Dry-run by default; `--confirm` required to delete
  - Bottleneck rate limiting on all Auth0 Management API calls
  - Profile support via `~/.config/wirebound/profiles/<name>.env`
  - `--json`, `--verbose`, `--limit`, `--rps` flags
