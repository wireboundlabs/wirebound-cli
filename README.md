# @wireboundlabs/cli

[![npm version](https://img.shields.io/npm/v/@wireboundlabs/cli.svg)](https://www.npmjs.com/package/@wireboundlabs/cli)
[![npm downloads](https://img.shields.io/npm/dm/@wireboundlabs/cli.svg)](https://www.npmjs.com/package/@wireboundlabs/cli)
[![CI](https://github.com/wireboundlabs/wirebound-cli/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/wireboundlabs/wirebound-cli/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/wireboundlabs/wirebound-cli/graph/badge.svg)](https://codecov.io/gh/wireboundlabs/wirebound-cli)
[![GitHub release](https://img.shields.io/github/v/release/wireboundlabs/wirebound-cli?include_prereleases)](https://github.com/wireboundlabs/wirebound-cli/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D24-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![GitHub stars](https://img.shields.io/github/stars/wireboundlabs/wirebound-cli?style=social)](https://github.com/wireboundlabs/wirebound-cli/stargazers)

**Identity provider operations from your terminal.** Point `wirebound` at a tenant, run maintenance tasks with dry-run defaults, and ship scripts with JSON output — no dashboard clicking required.

Install once globally. Configure per repo with `wirebound setup`. Switch between dev, staging, and production with `--profile`.

**Binary:** `wirebound`

---

## Why wirebound?

- **Safe by default** — destructive commands dry-run until you pass `--confirm`
- **Repo-native config** — credentials live in `.wirebound/profiles/` (gitignored), one profile per environment
- **Automation-ready** — `--json`, rate-limit handling, and predictable exit codes for CI
- **Multi-tenant friendly** — run the same commands across projects; each repo keeps its own tenant credentials

---

## Install

```bash
npm install -g @wireboundlabs/cli
wirebound --help
```

Requires **Node.js 24+** (current LTS).

---

## Quick start

### 1. Connect a tenant

You need a **Machine-to-Machine** app with Management API access. [Set up M2M credentials in Auth0](docs/vendors/auth0.md#set-up-machine-to-machine-credentials-in-auth0) if you don't have one yet (~5 min).

From your project root:

```bash
wirebound setup --profile dev --default
```

Interactive prompts collect your tenant domain, client ID, and client secret. Verify them in one shot:

```bash
wirebound setup --profile dev --check
```

Add more environments anytime:

```bash
wirebound setup --profile staging
wirebound setup --profile production
wirebound setup --list
```

### 2. Run a command

**Dry-run is the default.** Nothing changes until you opt in with `--confirm`.

```bash
# Preview what would happen (safe)
wirebound auth0 delete-google-users

# Same, with pagination and rate-limit logs
wirebound auth0 delete-google-users --verbose

# Pipe into your own tooling
wirebound auth0 delete-google-users --json

# Execute after reviewing the dry-run output
wirebound auth0 delete-google-users --confirm
```

### 3. Switch environments

```bash
wirebound auth0 delete-google-users --profile staging
export WIREBOUND_PROFILE=production
wirebound auth0 delete-google-users
```

When a default profile is set (`.wirebound/default`), omit `--profile`:

```bash
wirebound auth0 delete-google-users
```

---

## Configuration

| Method | When to use |
|--------|-------------|
| **`wirebound setup --profile <name>`** | **Recommended** — per-repo, per-environment config |
| `--profile` / `$WIREBOUND_PROFILE` | Switch tenants or environments on the fly |
| Global profile files (`~/.config/wirebound/profiles/`) | Shared credentials outside a repo |
| `export AUTH0_*` | CI/CD and one-off scripts |
| CLI flags (`--domain`, `--client-id`, …) | Debugging only — avoid for secrets |

**Precedence** (highest wins): CLI flags → environment variables → named profile (repo-local, then global) → default profile (`.wirebound/default`) → legacy `config.env`.

Full guide: **[docs/CONFIGURATION.md](docs/CONFIGURATION.md)**

### Repo layout

```
my-app/
└── .wirebound/
    ├── default              # e.g. "dev"
    └── profiles/
        ├── dev.env
        ├── staging.env
        └── production.env
```

### Other setup options

**Global profile** (any machine, no repo context):

```bash
mkdir -p ~/.config/wirebound/profiles
cp docs/templates/profile.env.example ~/.config/wirebound/profiles/my-tenant.env
chmod 600 ~/.config/wirebound/profiles/my-tenant.env
export WIREBOUND_PROFILE=my-tenant
```

**Environment variables** (CI):

```bash
export AUTH0_DOMAIN=your-tenant.us.auth0.com
export AUTH0_MGMT_CLIENT_ID=your-client-id
export AUTH0_MGMT_CLIENT_SECRET=your-client-secret
```

---

## Commands

| Command | Description |
|---------|-------------|
| `wirebound setup` | Connect a tenant — interactive credential setup (Auth0) |
| `wirebound auth0 users search` | Search users with a Lucene v3 query |
| `wirebound auth0 users get` | Get a user by email or user ID |
| `wirebound auth0 users duplicate-emails` | Find users sharing the same email across records |
| `wirebound auth0 users block` | Block users by email, ID, or query (dry-run by default) |
| `wirebound auth0 users unblock` | Unblock users by email, ID, or query (dry-run by default) |
| `wirebound auth0 orgs list` | List Auth0 organizations |
| `wirebound auth0 orgs members list` | List members of an organization |
| `wirebound auth0 orgs members add` | Add users to an organization (dry-run by default) |
| `wirebound auth0 orgs members remove` | Remove users from an organization (dry-run by default) |
| `wirebound auth0 logs search` | Search tenant logs with Lucene query syntax |
| `wirebound auth0 delete-google-users` | Remove users with exactly one Google identity (dry-run by default) |

More detail: [Auth0 vendor guide](docs/vendors/auth0.md)

---

## Credentials (Auth0)

| Variable | Description |
|----------|-------------|
| `AUTH0_DOMAIN` | Tenant domain (no `https://`) |
| `AUTH0_MGMT_CLIENT_ID` | M2M Client ID |
| `AUTH0_MGMT_CLIENT_SECRET` | M2M Client Secret |
| `WIREBOUND_PROFILE` | Default profile name (optional) |

| Auth0 dashboard | Maps to |
|-----------------|---------|
| Settings → Domain | `AUTH0_DOMAIN` |
| Applications → M2M app → Client ID | `AUTH0_MGMT_CLIENT_ID` |
| Applications → M2M app → Client Secret | `AUTH0_MGMT_CLIENT_SECRET` |

---

## Flags

| Flag | Description |
|------|-------------|
| `--profile <name>` | Load `.wirebound/profiles/<name>.env` or a global profile |
| `--confirm` | Perform destructive actions (default is dry-run) |
| `--json` | Machine-readable output |
| `--verbose` | Log pagination and rate-limit retries |
| `--limit <n>` | Cap how many records to process |
| `--rps <n>` | Management API requests per second (default `2`) |

---

## Rate limits

Auth0 throttles Management API traffic. `wirebound` queues requests (default **2 req/s**, override with `--rps`) and automatically retries on **HTTP 429** using `X-RateLimit-Reset`.

User search is capped at **1000 results per query** (Auth0 platform limit).

---

## Development

```bash
git clone https://github.com/wireboundlabs/wirebound-cli.git
cd wirebound-cli
npm install
npm run build
npm test
npm run test:coverage
./bin/dev.js setup --help
./bin/dev.js auth0 delete-google-users --help
```

---

## License

MIT
