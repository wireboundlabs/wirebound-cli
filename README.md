# wirebound — Auth0 CLI for tenant maintenance

[![npm version](https://img.shields.io/npm/v/@wireboundlabs/cli.svg)](https://www.npmjs.com/package/@wireboundlabs/cli)
[![npm downloads](https://img.shields.io/npm/dm/@wireboundlabs/cli.svg)](https://www.npmjs.com/package/@wireboundlabs/cli)
[![CI](https://github.com/wireboundlabs/wirebound-cli/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/wireboundlabs/wirebound-cli/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/wireboundlabs/wirebound-cli/graph/badge.svg)](https://codecov.io/gh/wireboundlabs/wirebound-cli)
[![GitHub release](https://img.shields.io/github/v/release/wireboundlabs/wirebound-cli?include_prereleases)](https://github.com/wireboundlabs/wirebound-cli/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D24-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![GitHub stars](https://img.shields.io/github/stars/wireboundlabs/wirebound-cli?style=social)](https://github.com/wireboundlabs/wirebound-cli/stargazers)

**`wirebound`** is a command-line tool for [Auth0](https://auth0.com/) tenant operations — search and block users, manage organizations, audit logs, and run bulk cleanup from your terminal. Built on the Auth0 Management API with **dry-run by default**, **JSON output for CI**, and **per-environment profiles**.

```bash
npm install -g @wireboundlabs/cli
wirebound setup --profile dev --default
wirebound auth0 users search --query 'email:*@yourcompany.com'
```

**Package:** [`@wireboundlabs/cli`](https://www.npmjs.com/package/@wireboundlabs/cli) · **Binary:** `wirebound` · **Node.js:** 24+

---

## What you can do

| Task | Command |
|------|---------|
| Search Auth0 users (Lucene) | `wirebound auth0 users search --query '...'` |
| Block / unblock users in bulk | `wirebound auth0 users block --query '...'` |
| Find duplicate emails across connections | `wirebound auth0 users duplicate-emails` |
| List orgs and manage members | `wirebound auth0 orgs list` · `orgs members add` |
| Search tenant logs | `wirebound auth0 logs search --query 'type:failed_login'` |
| Clean up orphan Google-only users | `wirebound auth0 delete-google-users` |
| Switch dev / staging / prod tenants | `wirebound auth0 ... --profile production` |

All destructive commands **preview changes first** — pass `--confirm` only after reviewing dry-run output.

---

## Who is this for?

- **Platform / identity engineers** managing Auth0 tenants without clicking through the dashboard
- **Support teams** looking up users, org membership, and login failures from the terminal
- **CI/CD pipelines** that need scripted user block/unblock, org changes, or tenant audits with `--json`
- **Multi-environment teams** that want repo-local Auth0 credentials per profile (dev, staging, production)

---

## Why wirebound?

- **Safe by default** — destructive commands dry-run until you pass `--confirm`
- **Repo-native config** — credentials live in `.wirebound/profiles/` (gitignored), one profile per environment
- **Automation-ready** — `--json`, rate-limit handling, and predictable exit codes for CI
- **Bulk operations** — block users by query, add/remove org members in batch, find duplicate emails
- **Multi-tenant friendly** — same CLI across projects; each repo keeps its own Auth0 credentials

> **Not a replacement for the [official Auth0 CLI](https://github.com/auth0/auth0-cli).** That tool excels at deploying Actions, apps, and Universal Login assets. **wirebound** focuses on day-to-day **tenant maintenance** — user hygiene, orgs, logs, and safe bulk mutations.

---

## Install

```bash
npm install -g @wireboundlabs/cli
wirebound --help
```

Requires **Node.js 24+**.

---

## Quick start

### 1. Connect an Auth0 tenant

You need a **Machine-to-Machine (M2M)** application authorized for the **Auth0 Management API**. [Set up M2M credentials](docs/vendors/auth0.md#set-up-machine-to-machine-credentials-in-auth0) (~5 min).

From your project root:

```bash
wirebound setup --profile dev --default
wirebound setup --profile dev --check
```

Add more environments:

```bash
wirebound setup --profile staging
wirebound setup --profile production
wirebound setup --list
```

### 2. Run a command (dry-run first)

```bash
# Preview — nothing is changed
wirebound auth0 delete-google-users

# Machine-readable output for scripts
wirebound auth0 delete-google-users --json

# Apply after reviewing dry-run output
wirebound auth0 delete-google-users --confirm
```

### 3. Switch environments

```bash
wirebound auth0 users search --query 'blocked:true' --profile staging
export WIREBOUND_PROFILE=production
wirebound auth0 orgs list
```

---

## Common recipes

### Look up a user

```bash
wirebound auth0 users get --email user@example.com
wirebound auth0 users get --id auth0|abc123 --json
```

### Block users matching a query

```bash
# Preview
wirebound auth0 users block --query 'email:*@suspicious-domain.com'

# Apply
wirebound auth0 users block --query 'email:*@suspicious-domain.com' --confirm
```

### Manage Auth0 organizations

```bash
wirebound auth0 orgs list
wirebound auth0 orgs members list --org-name acme-corp
wirebound auth0 orgs members add --org-name acme-corp --email user@example.com --confirm
```

### Investigate failed logins

```bash
wirebound auth0 logs search --query 'type:failed_login' --limit 50
wirebound auth0 logs search --from 2026-06-01 --to 2026-06-16 --query 'type:f'
```

### Find email collisions before deleting users

```bash
wirebound auth0 users duplicate-emails
wirebound auth0 delete-google-users   # dry-run first, then --confirm
```

---

## Commands

| Command | Description |
|---------|-------------|
| `wirebound setup` | Interactive Auth0 credential setup |
| `wirebound auth0 users search` | Search users with Lucene v3 query |
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

Full Auth0 guide: [docs/vendors/auth0.md](docs/vendors/auth0.md)

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

Full guide: [docs/CONFIGURATION.md](docs/CONFIGURATION.md)

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

### CI / environment variables

```bash
export AUTH0_DOMAIN=your-tenant.us.auth0.com
export AUTH0_MGMT_CLIENT_ID=your-client-id
export AUTH0_MGMT_CLIENT_SECRET=your-client-secret
wirebound auth0 users search --query 'email:*@example.com' --json
```

---

## Auth0 credentials

| Variable | Description |
|----------|-------------|
| `AUTH0_DOMAIN` | Tenant domain (no `https://`) |
| `AUTH0_MGMT_CLIENT_ID` | M2M Client ID |
| `AUTH0_MGMT_CLIENT_SECRET` | M2M Client Secret |
| `WIREBOUND_PROFILE` | Default profile name (optional) |

Required Management API scopes depend on the commands you run — see [docs/vendors/auth0.md](docs/vendors/auth0.md).

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

## FAQ

### How is this different from the Auth0 dashboard?

wirebound wraps the Management API in scriptable commands with dry-run defaults. Bulk user block, org member changes, log search, and duplicate-email audits are faster from the terminal — especially in CI.

### How is this different from `auth0` CLI?

The [official Auth0 CLI](https://github.com/auth0/auth0-cli) is built for deploying tenant configuration (Actions, applications, branding). **wirebound** is built for **operating** a live tenant — user search, block/unblock, org membership, log forensics, and safe cleanup jobs.

### Is it safe to run in production?

Yes — **dry-run is the default** for every destructive command. Review output, then add `--confirm`. Use `--profile production` explicitly so you never accidentally target the wrong tenant.

### Can I use this in GitHub Actions or CI?

Yes. Set `AUTH0_DOMAIN`, `AUTH0_MGMT_CLIENT_ID`, and `AUTH0_MGMT_CLIENT_SECRET` as secrets, add `--json`, and check exit codes. Rate limiting and 429 retries are handled automatically.

### What Auth0 permissions do I need?

At minimum: `read:users` for search/get. Block/unblock needs `update:users`. Deletes need `delete:users`. Org commands need `read:organizations` and member mutation scopes. See the [scope table](docs/vendors/auth0.md).

---

## Rate limits

Auth0 throttles Management API traffic. wirebound queues requests (default **2 req/s**, override with `--rps`) and automatically retries on **HTTP 429** using `X-RateLimit-Reset`.

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
./bin/dev.js auth0 users search --help
```

---

## License

MIT · [Wirebound Labs](https://github.com/wireboundlabs)
