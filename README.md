# @wireboundlabs/cli

[![npm version](https://img.shields.io/npm/v/@wireboundlabs/cli.svg)](https://www.npmjs.com/package/@wireboundlabs/cli)
[![npm downloads](https://img.shields.io/npm/dm/@wireboundlabs/cli.svg)](https://www.npmjs.com/package/@wireboundlabs/cli)
[![CI](https://github.com/wireboundlabs/wirebound-cli/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/wireboundlabs/wirebound-cli/actions/workflows/ci.yml)
[![GitHub release](https://img.shields.io/github/v/release/wireboundlabs/wirebound-cli?include_prereleases)](https://github.com/wireboundlabs/wirebound-cli/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![GitHub stars](https://img.shields.io/github/stars/wireboundlabs/wirebound-cli?style=social)](https://github.com/wireboundlabs/wirebound-cli/stargazers)

Wirebound customer operations CLI. Install once, run `wirebound setup` in each customer repo, run operational commands.

**Binary:** `wirebound`

---

## Install

```bash
npm install -g @wireboundlabs/cli
wirebound --help
```

Requires **Node.js 20+**.

---

## First-time setup (after npm install)

You need **three values** from Auth0 for any `auth0` command:

| What | Where in Auth0 |
|------|----------------|
| Tenant domain | Dashboard → **Settings** → **Domain** |
| Client ID | Applications → your M2M app → **Settings** |
| Client Secret | Same page (only shown when the app is created) |

Those map to `AUTH0_DOMAIN`, `AUTH0_MGMT_CLIENT_ID`, and `AUTH0_MGMT_CLIENT_SECRET`.

**Don't have an M2M app yet?** Follow [Set up M2M credentials in Auth0](docs/vendors/auth0.md#set-up-machine-to-machine-credentials-in-auth0) (5 minutes).

### Recommended: repo-local setup

Best for multiple customer repos and multiple Auth0 environments (dev, test, production) in one repo.

```bash
cd ~/repos/my-app
wirebound setup --profile dev --default
wirebound setup --profile test
wirebound setup --profile production
```

Interactive prompts write `.wirebound/profiles/<name>.env` (mode `600`) and add `.wirebound/` to `.gitignore` if needed.

List profiles:

```bash
wirebound setup --list
```

Verify credentials while setting up:

```bash
wirebound setup --profile production --check
```

Switch profiles per command:

```bash
wirebound auth0 delete-google-users --profile test
export WIREBOUND_PROFILE=production
wirebound auth0 delete-google-users
```

When a default is set (`.wirebound/default`), omit `--profile`:

```bash
wirebound auth0 delete-google-users
```

Switch repos and run setup again in each one:

```bash
cd ~/repos/customer-globex
wirebound setup --profile dev --default
wirebound auth0 delete-google-users
```

### Alternative: global profile file

For a shared machine profile outside any repo:

```bash
mkdir -p ~/.config/wirebound/profiles
cp docs/templates/profile.env.example ~/.config/wirebound/profiles/acme.env
$EDITOR ~/.config/wirebound/profiles/acme.env
chmod 600 ~/.config/wirebound/profiles/acme.env
export WIREBOUND_PROFILE=acme   # optional default
```

### Alternative: shell environment only

Fine for a single tenant or CI:

```bash
export AUTH0_DOMAIN=acme.us.auth0.com
export AUTH0_MGMT_CLIENT_ID=your-client-id
export AUTH0_MGMT_CLIENT_SECRET=your-client-secret
```

### Alternative: flags (avoid for secrets)

```bash
wirebound auth0 delete-google-users \
  --domain acme.us.auth0.com \
  --client-id '...' \
  --client-secret '...'
```

Secrets may be stored in shell history — use repo-local config or env vars instead.

---

## Run your first command

**Dry-run is the default.** Nothing is deleted until you pass `--confirm`.

```bash
# List google-only users that would be deleted (safe)
wirebound auth0 delete-google-users

# Same, with extra logging
wirebound auth0 delete-google-users --verbose

# JSON for scripts
wirebound auth0 delete-google-users --json

# Actually delete (only after reviewing dry-run output)
wirebound auth0 delete-google-users --confirm
```

---

## Configuration reference

| Method | When to use |
|--------|-------------|
| **`wirebound setup --profile <name>`** | **Default recommendation** — multiple Auth0 envs per repo |
| `--profile <name>` / `$WIREBOUND_PROFILE` | Switch between repo or global profiles |
| Global profile files | Shared profiles outside repo context |
| `export AUTH0_*` | Single tenant, CI/CD |
| `--domain` / `--client-id` / `--client-secret` | Debugging only |

**Precedence** (highest wins): CLI flags → environment variables → named profile (repo-local, then global) → default profile (`.wirebound/default`) → legacy `config.env` → defaults.

Full guide: **[docs/CONFIGURATION.md](docs/CONFIGURATION.md)** — precedence, CI, troubleshooting, security.

---

## Commands

| Command | Description |
|---------|-------------|
| `wirebound setup` | Interactive setup — create repo-local profiles under `.wirebound/profiles/` |
| `wirebound auth0 delete-google-users` | Delete users with exactly one `google-oauth2` identity (dry-run by default) |

Vendor docs:

- [Auth0](docs/vendors/auth0.md) — M2M setup, scopes, flags, rate limits

---

## Auth0 variables

| Variable | Description |
|----------|-------------|
| `AUTH0_DOMAIN` | Tenant domain (no `https://`) |
| `AUTH0_MGMT_CLIENT_ID` | M2M Client ID |
| `AUTH0_MGMT_CLIENT_SECRET` | M2M Client Secret |
| `WIREBOUND_PROFILE` | Default global profile name (optional) |

---

## Common flags

| Flag | Description |
|------|-------------|
| `--profile <name>` | Load `.wirebound/profiles/<name>.env` (repo) or global profile |
| `--confirm` | Perform deletes (default is dry-run) |
| `--json` | Machine-readable output |
| `--verbose` | Log pagination and rate-limit retries |
| `--limit <n>` | Max users to process |
| `--rps <n>` | API requests per second (default `2`) |

---

## Rate limiting & limits

- All Auth0 Management API traffic is throttled (default **2 req/s**). Override with `--rps`.
- On HTTP **429**, the CLI waits for `X-RateLimit-Reset` and retries.
- User **search** returns at most **1000** results per query (Auth0 platform limit).

---

## Development

```bash
git clone https://github.com/wireboundlabs/wirebound-cli.git
cd wirebound-cli
npm install
npm run build
npm test
./bin/dev.js setup --help
./bin/dev.js auth0 delete-google-users --help
```

---

## License

MIT
