# Changelog

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
