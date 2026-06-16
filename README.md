# wirebound — Auth0 Management API CLI for Users, Orgs, Logs & Tenant Maintenance

[![npm version](https://img.shields.io/npm/v/@wireboundlabs/cli.svg)](https://www.npmjs.com/package/@wireboundlabs/cli)
[![npm downloads](https://img.shields.io/npm/dm/@wireboundlabs/cli.svg)](https://www.npmjs.com/package/@wireboundlabs/cli)
[![CI](https://github.com/wireboundlabs/wirebound-cli/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/wireboundlabs/wirebound-cli/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/wireboundlabs/wirebound-cli/graph/badge.svg)](https://codecov.io/gh/wireboundlabs/wirebound-cli)
[![GitHub release](https://img.shields.io/github/v/release/wireboundlabs/wirebound-cli?include_prereleases)](https://github.com/wireboundlabs/wirebound-cli/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D24-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![GitHub stars](https://img.shields.io/github/stars/wireboundlabs/wirebound-cli?style=social)](https://github.com/wireboundlabs/wirebound-cli/stargazers)

**wirebound** is the **Auth0 CLI** for operating live tenants — **bulk user search & block**, **Auth0 Organizations** management, **tenant log** forensics, and safe cleanup from your terminal. Built on the **Auth0 Management API** with **dry-run by default**, live progress, **JSON for CI**, and **multi-environment profiles** (dev, staging, production).

Install **`@wireboundlabs/cli`** · run **`wirebound`**

```bash
npm install -g @wireboundlabs/cli
wirebound setup --profile dev --default
wirebound auth0 users search --query 'email:*@yourcompany.com'
```

**Auth0 CLI for:** user management · bulk block/unblock · organization members · tenant log search · duplicate-email audits · safe automation · dev/staging/prod profiles

---

## Why teams choose wirebound

| | |
|---|---|
| **Safe by default** | Every destructive command **dry-runs first**. Review the output, then pass `--confirm`. No surprises in production. |
| **Built for bulk work** | Block hundreds of users with a Lucene query. Add or remove org members in batch. Find duplicate emails before cleanup. |
| **CI-ready** | `--json` output, predictable exit codes, automatic **429 retry**, and configurable rate limits (`--rps`). Drop it into GitHub Actions today. |
| **Multi-environment profiles** | Store credentials in `.wirebound/profiles/` per repo — switch tenants with `--profile staging` or `$WIREBOUND_PROFILE`. |
| **Clear feedback** | Live **progress bars** on long searches and bulk mutations so you always know work is happening. |
| **Repo-native setup** | `wirebound setup` writes gitignored config, validates credentials with `--check`, and sets a default profile in one flow. |

> **Not a replacement for the [official Auth0 CLI](https://github.com/auth0/auth0-cli).** That tool excels at deploying Actions, applications, and Universal Login assets. **wirebound** is the **Auth0 Management API CLI** for **operating a live tenant** — user hygiene, B2B orgs, log forensics, and safe bulk mutations.

---

## Install

```bash
npm install -g @wireboundlabs/cli
wirebound --help
```

Requires **Node.js 24+**.

---

## Quick start (3 steps)

### 1. Connect your Auth0 tenant

Create a **Machine-to-Machine (M2M)** app authorized for the **Auth0 Management API**. [Step-by-step setup (~5 min)](docs/vendors/auth0.md#set-up-machine-to-machine-credentials-in-auth0).

```bash
wirebound setup --profile dev --default
wirebound setup --profile dev --check    # verify credentials
```

Add staging and production the same way:

```bash
wirebound setup --profile staging
wirebound setup --profile production
wirebound setup --list
```

### 2. Preview any change (dry-run is the default)

```bash
wirebound auth0 delete-google-users          # shows candidates — deletes nothing
wirebound auth0 users block --query 'blocked:true'
wirebound auth0 orgs members add --org-name acme --email user@example.com
```

### 3. Apply when you're ready

```bash
wirebound auth0 delete-google-users --confirm
wirebound auth0 users block --query 'email:*@bad-domain.com' --confirm
```

Switch tenants anytime:

```bash
wirebound auth0 users search --query 'email:*@acme.com' --profile staging
export WIREBOUND_PROFILE=production
wirebound auth0 orgs list
```

---

## What you can do

| Task | Command |
|------|---------|
| **Search Auth0 users** (Lucene v3) | `wirebound auth0 users search --query '...'` |
| **Get a user** by email or ID | `wirebound auth0 users get --email user@example.com` |
| **Block / unblock users** in bulk | `wirebound auth0 users block --query '...'` |
| **Find duplicate emails** across connections | `wirebound auth0 users duplicate-emails` |
| **List Auth0 Organizations** | `wirebound auth0 orgs list` |
| **Manage org members** (add / remove / list) | `wirebound auth0 orgs members ...` |
| **Search Auth0 tenant logs** | `wirebound auth0 logs search --query 'type:failed_login'` |
| **Clean up Google-only orphan users** | `wirebound auth0 delete-google-users` |
| **Switch dev / staging / prod** | `wirebound auth0 ... --profile production` |

---

## Common recipes

### Look up a user instantly

```bash
wirebound auth0 users get --email user@example.com
wirebound auth0 users get --id auth0|abc123 --json
```

### Block suspicious accounts in bulk

```bash
# Preview who would be blocked
wirebound auth0 users block --query 'email:*@suspicious-domain.com'

# Apply after review
wirebound auth0 users block --query 'email:*@suspicious-domain.com' --confirm
```

### Manage Auth0 Organizations (B2B)

```bash
wirebound auth0 orgs list
wirebound auth0 orgs members list --org-name acme-corp
wirebound auth0 orgs members add --org-name acme-corp --email user@example.com        # dry-run
wirebound auth0 orgs members add --org-name acme-corp --email user@example.com --confirm
wirebound auth0 orgs members remove --org-name acme-corp --query 'email:*@acme.com' --confirm
```

### Investigate failed logins and auth events

```bash
wirebound auth0 logs search --query 'type:failed_login' --limit 50
wirebound auth0 logs search --from 2026-06-01 --to 2026-06-16 --query 'type:f'
```

### Audit email collisions before deleting users

Duplicate emails often mean linked accounts or migration leftovers — find them **before** running cleanup:

```bash
wirebound auth0 users duplicate-emails
wirebound auth0 users duplicate-emails --json

# Then preview Google-only orphans (dry-run by default)
wirebound auth0 delete-google-users

# Apply only after reviewing both reports
wirebound auth0 delete-google-users --confirm
```

---

## Commands

| Command | Description |
|---------|-------------|
| `wirebound setup` | Interactive Auth0 credential setup with optional `--check` |
| `wirebound auth0 users search` | Search users with Lucene v3 query |
| `wirebound auth0 users get` | Get a user by email or user ID |
| `wirebound auth0 users duplicate-emails` | Find users sharing the same email across records |
| `wirebound auth0 users block` | Block users by email, ID, or query (dry-run by default) |
| `wirebound auth0 users unblock` | Unblock users by email, ID, or query (dry-run by default) |
| `wirebound auth0 orgs list` | List Auth0 organizations in the tenant |
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
| Global profiles (`~/.config/wirebound/profiles/`) | Shared credentials outside a repo |
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

### CI / GitHub Actions

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
| `--json` | Machine-readable JSON output for scripts and CI |
| `--verbose` | Log pagination details and rate-limit retries (replaces progress bars) |
| `--limit <n>` | Cap how many records to fetch or process |
| `--rps <n>` | Management API requests per second (default `2`) |

---

## FAQ

### How is wirebound different from the Auth0 dashboard?

The dashboard is great for one-off edits. **wirebound** wraps the **Auth0 Management API** in scriptable commands with **dry-run defaults** — bulk user block, org membership changes, log search, and duplicate-email audits are faster from the terminal, especially in CI.

### How is wirebound different from the official `auth0` CLI?

The [official Auth0 CLI](https://github.com/auth0/auth0-cli) deploys tenant configuration (Actions, applications, branding). **wirebound** **operates** a live tenant — user search, block/unblock, Auth0 Organizations, log forensics, and safe cleanup jobs.

### Is it safe to run against production?

Yes. **Dry-run is the default** for every destructive command. Review output, then add `--confirm`. Use `--profile production` explicitly so you never accidentally target the wrong tenant.

### Can I use this in GitHub Actions or CI pipelines?

Yes. Set `AUTH0_DOMAIN`, `AUTH0_MGMT_CLIENT_ID`, and `AUTH0_MGMT_CLIENT_SECRET` as secrets, add `--json`, and check exit codes. Rate limiting and HTTP 429 retries are handled automatically.

### What Auth0 Management API scopes do I need?

At minimum: `read:users` for search/get. Block/unblock needs `update:users`. Deletes need `delete:users`. Org commands need `read:organizations` and member mutation scopes. See the [scope table](docs/vendors/auth0.md).

### Who is wirebound for?

- **Platform / identity engineers** managing Auth0 tenants without clicking through the dashboard
- **Support teams** looking up users, org membership, and login failures from the terminal
- **CI/CD pipelines** that need scripted user block/unblock, org changes, or tenant audits
- **Multi-environment teams** with repo-local Auth0 credentials per profile

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
