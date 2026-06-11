# Changelog

## [0.1.0] - 2026-06-11

### Added

- Initial release of `@wireboundlabs/cli` with binary `wirebound`
- `wirebound auth0 delete-google-users` command
  - Dry-run by default; `--confirm` required to delete
  - Bottleneck rate limiting on all Auth0 Management API calls
  - Profile support via `~/.config/wirebound/profiles/<name>.env`
  - `--json`, `--verbose`, `--limit`, `--rps` flags
