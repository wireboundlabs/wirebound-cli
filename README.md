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
| **CI-ready** | `--json` output, predictable exit codes, automatic **429 retry**, and plan-aware rate limits. Drop it into GitHub Actions today. |
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
wirebound auth0 users cleanup-google-orphans          # shows candidates — deletes nothing
wirebound auth0 users block --query 'blocked:true'
wirebound auth0 orgs members add --org-name acme --email user@example.com
```

### 3. Apply when you're ready

```bash
wirebound auth0 users cleanup-google-orphans --confirm
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
| **Clean up Google-only orphan users** | `wirebound auth0 users cleanup-google-orphans` |
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
wirebound auth0 users cleanup-google-orphans

# Apply only after reviewing both reports
wirebound auth0 users cleanup-google-orphans --confirm
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
| `wirebound auth0 users cleanup-google-orphans` | Remove users with exactly one Google identity (dry-run by default) |

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

For pipelines, prefer **environment variables or GitHub secrets** over repo-local profiles — see [CI / automation](#ci--automation).

---

## Auth0 credentials

| Variable | Description |
|----------|-------------|
| `AUTH0_DOMAIN` | Tenant domain (no `https://`) |
| `AUTH0_MGMT_CLIENT_ID` | M2M Client ID |
| `AUTH0_MGMT_CLIENT_SECRET` | M2M Client Secret |
| `AUTH0_PLAN` | Optional. `free` (default), `essentials-professional`, or `enterprise` |
| `AUTH0_TENANT_ENV` | Optional. `production` (default) or `non-production` — Enterprise only |
| `AUTH0_RPS` | Optional global rate override (req/s) |
| `WIREBOUND_PROFILE` | Default profile name (optional) |

Required Management API scopes depend on the commands you run — see [docs/vendors/auth0.md](docs/vendors/auth0.md).

---

## CI / automation

wirebound is built for scripted tenant operations: **`--json`** for machine-readable output, **non-zero exit codes** on failure, automatic **HTTP 429** retries, and **dry-run by default** on destructive commands.

### 1. Store Auth0 credentials as secrets

In GitHub Actions (or your CI provider), add repository or environment secrets:

| Secret | Value |
|--------|--------|
| `AUTH0_DOMAIN` | Tenant domain, e.g. `acme.us.auth0.com` (no `https://`) |
| `AUTH0_MGMT_CLIENT_ID` | M2M app Client ID |
| `AUTH0_MGMT_CLIENT_SECRET` | M2M app Client Secret |

Optional for correct rate limits on paid tenants:

| Secret / env | When |
|--------------|------|
| `AUTH0_PLAN` | `essentials-professional` or `enterprise` |
| `AUTH0_TENANT_ENV` | `non-production` for Enterprise dev/staging tenants |

Create a dedicated **Machine-to-Machine** app with only the [scopes you need](docs/vendors/auth0.md#what-you-need). Do not commit credentials or `.wirebound/` profile files to git.

### 2. Install wirebound in the job

Requires **Node.js 24+**.

```yaml
- uses: actions/setup-node@v6
  with:
    node-version: 24

# Pin a version (recommended in CI)
- run: npm install -g @wireboundlabs/cli@0.4.2

# Or run without a global install
- run: npx @wireboundlabs/cli@0.4.2 auth0 users search --help
```

### 3. Run commands with `--json`

Pass credentials via `env` (never on the command line). Always add **`--json`** so stdout is a single JSON document suitable for `jq` or artifact upload.

```yaml
env:
  AUTH0_DOMAIN: ${{ secrets.AUTH0_DOMAIN }}
  AUTH0_MGMT_CLIENT_ID: ${{ secrets.AUTH0_MGMT_CLIENT_ID }}
  AUTH0_MGMT_CLIENT_SECRET: ${{ secrets.AUTH0_MGMT_CLIENT_SECRET }}
run: wirebound auth0 users search --query 'email:*@example.com' --json
```

**Exit codes:** `0` on success; non-zero when Auth0 calls fail or a mutation reports errors (e.g. partial delete failures). Check `$?` or let the step fail the job.

### 4. Example: read-only audit (safe for scheduled CI)

Dry-run and read-only commands need no `--confirm`. Good for nightly or weekly checks:

```yaml
name: Auth0 tenant audit

on:
  schedule:
    - cron: '0 6 * * 1'   # Mondays 06:00 UTC
  workflow_dispatch:

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v6
        with:
          node-version: 24

      - run: npm install -g @wireboundlabs/cli

      - name: Duplicate email audit
        env:
          AUTH0_DOMAIN: ${{ secrets.AUTH0_DOMAIN }}
          AUTH0_MGMT_CLIENT_ID: ${{ secrets.AUTH0_MGMT_CLIENT_ID }}
          AUTH0_MGMT_CLIENT_SECRET: ${{ secrets.AUTH0_MGMT_CLIENT_SECRET }}
        run: |
          wirebound auth0 users duplicate-emails --json > duplicate-emails.json
          echo "duplicate groups: $(jq '.duplicateCount' duplicate-emails.json)"

      - name: Fail if duplicates found
        run: |
          count=$(jq '.duplicateCount' duplicate-emails.json)
          test "$count" -eq 0 || (echo "Found $count duplicate email group(s)" && exit 1)

      - name: Upload report
        uses: actions/upload-artifact@v4
        with:
          name: auth0-audit
          path: duplicate-emails.json
```

Other read-only commands: `auth0 users search`, `auth0 logs search`, `auth0 orgs list`, `auth0 users cleanup-google-orphans` (dry-run lists candidates only).

### 5. Example: destructive changes (manual approval)

Destructive commands **dry-run by default**. In CI, add **`--confirm`** only when you intend to mutate the tenant.

Use a separate job, **`workflow_dispatch`** (manual run), and a GitHub **environment** with required reviewers so production deletes are never accidental:

```yaml
  cleanup:
    needs: audit
    if: github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    environment: production-auth0   # configure approval rules in repo Settings → Environments
    steps:
      - uses: actions/setup-node@v6
        with:
          node-version: 24

      - run: npm install -g @wireboundlabs/cli

      - name: Preview Google-only orphans (dry-run)
        env:
          AUTH0_DOMAIN: ${{ secrets.AUTH0_DOMAIN }}
          AUTH0_MGMT_CLIENT_ID: ${{ secrets.AUTH0_MGMT_CLIENT_ID }}
          AUTH0_MGMT_CLIENT_SECRET: ${{ secrets.AUTH0_MGMT_CLIENT_SECRET }}
        run: wirebound auth0 users cleanup-google-orphans --json

      - name: Apply cleanup
        env:
          AUTH0_DOMAIN: ${{ secrets.AUTH0_DOMAIN }}
          AUTH0_MGMT_CLIENT_ID: ${{ secrets.AUTH0_MGMT_CLIENT_ID }}
          AUTH0_MGMT_CLIENT_SECRET: ${{ secrets.AUTH0_MGMT_CLIENT_SECRET }}
        run: wirebound auth0 users cleanup-google-orphans --confirm --json
```

Run the dry-run step in PR checks; gate `--confirm` behind environment approval or a protected branch.

### CI best practices

- Scope the M2M app to least privilege for the job
- Store secrets in your CI vault, not in the repo or workflow logs
- Use `--json` on every command you parse or archive
- Run dry-run or read-only commands in scheduled jobs
- Use `--confirm` only in approved, manual, or explicitly trusted pipelines
- Set `AUTH0_PLAN` (and `AUTH0_TENANT_ENV` if applicable) on paid tenants so commands use your plan's rate limits (defaults to free-tier 2 req/s)

More examples: [docs/CONFIGURATION.md#ci--automation](docs/CONFIGURATION.md#ci--automation)

---

## Flags

| Flag | Description |
|------|-------------|
| `--profile <name>` | Load `.wirebound/profiles/<name>.env` or a global profile |
| `--confirm` | Perform destructive actions (default is dry-run) |
| `--json` | Machine-readable JSON output for scripts and CI |
| `--verbose` | Log resolved tenant, rate limits, pagination, and 429 retries |
| `--limit <n>` | Cap how many records to fetch or process |
| `--rps <n>` | Override global Management API requests per second (default from plan) |
| `--auth0-plan <plan>` | Auth0 subscription plan: `free`, `essentials-professional`, `enterprise` |
| `--auth0-tenant-env <env>` | Tenant environment: `production`, `non-production` (Enterprise) |

---

## FAQ

### How is wirebound different from the Auth0 dashboard?

The dashboard is great for one-off edits. **wirebound** wraps the **Auth0 Management API** in scriptable commands with **dry-run defaults** — bulk user block, org membership changes, log search, and duplicate-email audits are faster from the terminal, especially in CI.

### How is wirebound different from the official `auth0` CLI?

The [official Auth0 CLI](https://github.com/auth0/auth0-cli) deploys tenant configuration (Actions, applications, branding). **wirebound** **operates** a live tenant — user search, block/unblock, Auth0 Organizations, log forensics, and safe cleanup jobs.

### Is it safe to run against production?

Yes. **Dry-run is the default** for every destructive command. Review output, then add `--confirm`. Use `--profile production` explicitly so you never accidentally target the wrong tenant.

### Can I use this in GitHub Actions or CI pipelines?

Yes — see **[CI / automation](#ci--automation)** for a full workflow, secrets setup, `--json` output, exit codes, and patterns for read-only audits vs destructive `--confirm` jobs.

### What Auth0 Management API scopes do I need?

At minimum: `read:users` for search/get. Block/unblock needs `update:users`. Deletes need `delete:users`. Org commands need `read:organizations` and member mutation scopes. See the [scope table](docs/vendors/auth0.md).

### Who is wirebound for?

- **Platform / identity engineers** managing Auth0 tenants without clicking through the dashboard
- **Support teams** looking up users, org membership, and login failures from the terminal
- **CI/CD pipelines** that need scripted user block/unblock, org changes, or tenant audits
- **Multi-environment teams** with repo-local Auth0 credentials per profile

---

## Rate limits

Auth0 throttles Management API traffic by plan and endpoint. wirebound applies [Auth0’s documented limits](https://auth0.com/docs/troubleshoot/customer-support/operational-policies/rate-limit-policy) automatically.

| Plan | What to set | Global rate |
|------|-------------|-------------|
| Free / trial | *(default — nothing to set)* | 2 req/s |
| Essentials / Professional | `AUTH0_PLAN=essentials-professional` | ~3 req/s + per-endpoint limits |
| Enterprise production | `AUTH0_PLAN=enterprise` | 16 req/s |
| Enterprise dev/staging | `AUTH0_PLAN=enterprise` + `AUTH0_TENANT_ENV=non-production` | 2 req/s |

Use `--verbose` to confirm resolved settings. Override the global rate with `--rps` or `AUTH0_RPS` if needed. The CLI retries on **HTTP 429** using `X-RateLimit-Reset`.

See [docs/CONFIGURATION.md](docs/CONFIGURATION.md#rate-limits) for profile examples.

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

**Like wirebound?** [Star the repo on GitHub](https://github.com/wireboundlabs/wirebound-cli) — it helps others discover the CLI.

---

## License

MIT · [Wirebound Labs](https://github.com/wireboundlabs)
