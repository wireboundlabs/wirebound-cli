# Auth0

How to connect `wirebound` to an Auth0 tenant after `npm install -g @wireboundlabs/cli`.

**Configuration overview:** [docs/CONFIGURATION.md](../CONFIGURATION.md)

---

## What you need

Three credentials for the **Management API**, obtained from a **Machine-to-Machine (M2M)** application:

| Wirebound variable | Auth0 concept |
|--------------------|---------------|
| `AUTH0_DOMAIN` | Tenant domain |
| `AUTH0_MGMT_CLIENT_ID` | M2M application Client ID |
| `AUTH0_MGMT_CLIENT_SECRET` | M2M application Client Secret |

Optional rate-limit settings (paid plans only — [details](#rate-limits)):

| Wirebound variable | When to set |
|--------------------|-------------|
| `AUTH0_PLAN` | Essentials, Professional, or Enterprise subscription |
| `AUTH0_TENANT_ENV` | Enterprise dev/staging tenants (`non-production`) |
| `AUTH0_RPS` | Manual global slowdown (rare) |

Required Management API scopes for current commands:

| Scope | Used by |
|-------|---------|
| `read:users` | `users search`, `users get`, `users duplicate-emails`, block/unblock dry-run, `delete-google-users`, org member add/remove dry-run |
| `update:users` | `users block --confirm`, `users unblock --confirm` |
| `delete:users` | `delete-google-users --confirm` |
| `read:logs` | `logs search` |
| `read:organizations` | `orgs list`, `orgs members list`, org member add/remove dry-run |
| `create:organization_members` | `orgs members add --confirm` |
| `delete:organization_members` | `orgs members remove --confirm` |

---

## Set up Machine-to-Machine credentials in Auth0

### 1. Open the Auth0 Dashboard

Go to [manage.auth0.com](https://manage.auth0.com/) and select the tenant you want to manage.

Copy your **domain** now — you will need it for `AUTH0_DOMAIN`:

- **Settings** (gear, bottom left) → **Domain**
- Example: `acme.us.auth0.com` (use this string only — no `https://`)

### 2. Create an M2M application

1. **Applications** → **Applications** → **Create Application**
2. **Name:** `Wirebound CLI` (or per-customer, e.g. `Wirebound CLI - Acme`)
3. **Type:** **Machine to Machine Applications** → **Create**

### 3. Authorize Management API access

On the next screen (or **APIs** tab of the new app):

1. Select **Auth0 Management API**
2. Enable scopes:
   - **`read:users`**
   - **`update:users`**
   - **`delete:users`**
   - **`read:logs`**
   - **`read:organizations`** (for org commands)
   - **`create:organization_members`** (for `orgs members add --confirm`)
   - **`delete:organization_members`** (for `orgs members remove --confirm`)
3. **Authorize** / save

Grant only what you need. For dry-runs you still need `read:users`; block/unblock require `update:users`; deletes require `delete:users`; log search requires `read:logs`.

### 4. Save credentials with Wirebound setup

1. Open the M2M app → **Settings**
2. Copy **Client ID** → `AUTH0_MGMT_CLIENT_ID`
3. Copy **Client Secret** → `AUTH0_MGMT_CLIENT_SECRET`  
   (If you lost it: **Rotate** secret in the dashboard and update your config.)

In the customer repo:

```bash
cd ~/repos/my-app
wirebound setup --profile dev --default
wirebound setup --profile test
wirebound setup --profile production
```

Paste domain, client ID, and client secret when prompted for each profile. List profiles with `wirebound setup --list`. Optional credential check:

```bash
wirebound setup --profile production --check
```

Or create a profile manually:

```bash
mkdir -p .wirebound/profiles
cp docs/templates/repo-config.env.example .wirebound/profiles/dev.env
chmod 600 .wirebound/profiles/dev.env
echo dev > .wirebound/default
```

### 5. Verify with a dry-run

```bash
wirebound auth0 delete-google-users --verbose
```

Expected:

- No `Missing required Auth0 configuration` error
- Output listing zero or more google-only users
- **No** deletes (unless you passed `--confirm`)

---

## Shared command flags

All `wirebound auth0:*` commands accept these flags (in addition to command-specific options):

| Flag | Default | Description |
|------|---------|-------------|
| `--profile` | `$WIREBOUND_PROFILE` / repo default | Load credentials from a profile |
| `--domain` | `$AUTH0_DOMAIN` | Tenant domain |
| `--client-id` | `$AUTH0_MGMT_CLIENT_ID` | M2M Client ID |
| `--client-secret` | `$AUTH0_MGMT_CLIENT_SECRET` | M2M Client Secret |
| `--auth0-plan` | `free` | `free`, `essentials-professional`, or `enterprise` |
| `--auth0-tenant-env` | `production` | `production` or `non-production` (Enterprise) |
| `--rps` | from plan | Override global requests per second |
| `--verbose` | `false` | Show tenant, rate limits, pagination, and 429 retries |
| `--json` | `false` | Machine-readable output |
| `--confirm` | `false` | Apply destructive changes (default is dry-run) |

Profile/env vars (`AUTH0_PLAN`, `AUTH0_TENANT_ENV`, `AUTH0_RPS`) are usually easier than flags for plan settings.

---

## Wiring credentials: four ways

### A. Repo-local config (recommended)

```bash
cd ~/repos/customer-acme
wirebound setup
wirebound auth0 delete-google-users
```

File: `.wirebound/config.env` (auto-discovered from cwd upward)

### B. Global profile file

```bash
wirebound auth0 delete-google-users --profile acme
# or with WIREBOUND_PROFILE=acme:
wirebound auth0 delete-google-users
```

File: `~/.config/wirebound/profiles/acme.env`

### C. Environment variables

```bash
export AUTH0_DOMAIN=acme.us.auth0.com
export AUTH0_MGMT_CLIENT_ID=...
export AUTH0_MGMT_CLIENT_SECRET=...

wirebound auth0 delete-google-users
```

Works in CI — inject vars from your secrets store.

### D. CLI flags

```bash
wirebound auth0 delete-google-users \
  --domain acme.us.auth0.com \
  --client-id '...' \
  --client-secret '...'
```

Avoid for production use (shell history).

### Precedence

**CLI flags** beat **environment variables** beat **global profile file** beat **repo-local config** beat **defaults**.

---

## Commands

### `wirebound auth0 users search`

Search Auth0 users with Lucene v3 query syntax.

```bash
wirebound auth0 users search --query 'email:*@acme.com'
wirebound auth0 users search --query 'identities.provider:"google-oauth2"' --limit 50 --json
```

| Flag | Default | Description |
|------|---------|-------------|
| `--query` / `-q` | required | Lucene v3 search query |
| `--limit` | unlimited | Max users to return |
| `--fields` | `email,user_id,created_at,blocked,last_login` | Comma-separated projection |

---

### `wirebound auth0 users get`

Look up a user by email or user ID.

```bash
wirebound auth0 users get --email user@example.com
wirebound auth0 users get --id auth0|abc123 --json
```

| Flag | Description |
|------|-------------|
| `--email` | Lookup via users-by-email (shows all matches if duplicates) |
| `--id` | Direct user_id lookup |

---

### `wirebound auth0 users block` / `wirebound auth0 users unblock`

Block or unblock users by email, user ID, or search query. Dry-run by default.

```bash
wirebound auth0 users block --email user@example.com
wirebound auth0 users block --query 'email:*@acme.com' --confirm
wirebound auth0 users unblock --query 'blocked:true' --confirm
```

| Flag | Default | Description |
|------|---------|-------------|
| `--email` | — | User email address |
| `--id` | — | Auth0 user ID |
| `--query` / `-q` | — | Lucene v3 search query |
| `--limit` | unlimited | Max users when using `--query` |
| `--confirm` | false | Apply the change (default is dry-run) |

Exactly one of `--email`, `--id`, or `--query` is required.

---

### `wirebound auth0 users duplicate-emails`

Find users that share the same email across different Auth0 user records (e.g. Google + database accounts with the same address).

```bash
wirebound auth0 users duplicate-emails
wirebound auth0 users duplicate-emails --limit 500 --json
```

| Flag | Default | Description |
|------|---------|-------------|
| `--limit` | unlimited | Max users to scan (Auth0 search cap: 1000) |

Use this before `delete-google-users` to detect email collisions across connections.

---

### `wirebound auth0 orgs list`

List organizations in the tenant.

```bash
wirebound auth0 orgs list
wirebound auth0 orgs list --limit 20 --json
```

| Flag | Default | Description |
|------|---------|-------------|
| `--limit` | unlimited | Max organizations to return |

---

### `wirebound auth0 orgs members list`

List members of an organization.

```bash
wirebound auth0 orgs members list --org-name acme-corp
wirebound auth0 orgs members list --org-id org_abc123 --json
```

| Flag | Description |
|------|-------------|
| `--org-id` | Organization ID |
| `--org-name` | Organization name |
| `--limit` | Max members to return |

Exactly one of `--org-id` or `--org-name` is required.

---

### `wirebound auth0 orgs members add` / `wirebound auth0 orgs members remove`

Add or remove users from an organization by email, user ID, or search query. Dry-run by default.

```bash
wirebound auth0 orgs members add --org-name acme-corp --email user@example.com
wirebound auth0 orgs members add --org-id org_abc --query 'email:*@acme.com' --confirm
wirebound auth0 orgs members remove --org-name acme-corp --email user@example.com --confirm
```

| Flag | Default | Description |
|------|---------|-------------|
| `--org-id` | — | Organization ID |
| `--org-name` | — | Organization name |
| `--email` | — | User email address |
| `--id` | — | Auth0 user ID |
| `--query` / `-q` | — | Lucene v3 search query |
| `--limit` | unlimited | Max users when using `--query` |
| `--confirm` | false | Apply the change (default is dry-run) |

Exactly one of `--org-id` or `--org-name` is required. Exactly one of `--email`, `--id`, or `--query` is required.

Already-member users are skipped on add; non-members are skipped on remove.

---

### `wirebound auth0 logs search`

Search tenant logs with Lucene query syntax.

```bash
wirebound auth0 logs search --query 'type:failed_login'
wirebound auth0 logs search --query 'type:seccft' --limit 20 --json
wirebound auth0 logs search --from 2026-06-01 --to 2026-06-12 --query 'type:f'
```

| Flag | Default | Description |
|------|---------|-------------|
| `--query` / `-q` | optional | Lucene query |
| `--from` | — | Start date (ISO 8601) |
| `--to` | — | End date (ISO 8601) |
| `--limit` | `50` | Max log entries |

---

### `wirebound auth0 delete-google-users`

Deletes Auth0 users that have **exactly one** identity and that identity’s provider is `google-oauth2`.

| Behavior | Detail |
|----------|--------|
| Includes | Users with only a Google social login |
| Skips | Users with 2+ identities (e.g. Google + database linked) |
| Does not check | Whether another database user shares the same email — use `users duplicate-emails` first |
| Default mode | **Dry-run** — lists candidates only |
| Destructive mode | `--confirm` — deletes listed users |

Rationale: orphan Google users from failed linking should be removed; the post-login Action can re-link on next login.

#### Examples

```bash
# Safe preview (default)
wirebound auth0 delete-google-users

# Preview with pagination / rate-limit logs
wirebound auth0 delete-google-users --verbose

# Scripting
wirebound auth0 delete-google-users --json

# Delete at most 50 users, 2 requests/sec
wirebound auth0 delete-google-users --confirm --limit 50 --rps 2
```

#### Human output (dry-run)

```text
Found 3 google-only user(s) (dry run — use --confirm to delete)

EMAIL                          USER_ID                      CREATED
solo@gmail.com                 google-oauth2|123            2024-01-01T00:00:00.000Z

Summary: found=10, eligible=3, would_delete=3
```

#### JSON output

```json
{
  "dryRun": true,
  "found": 10,
  "eligible": 3,
  "candidates": [
    {
      "user_id": "google-oauth2|123",
      "email": "solo@gmail.com",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "deleted": [],
  "errors": []
}
```

#### Flags

Shared Auth0 flags (`--profile`, `--domain`, credentials, rate limits, `--verbose`, `--json`, `--confirm`) are documented in [Shared command flags](#shared-command-flags). Command-specific:

| Flag | Default | Description |
|------|---------|-------------|
| `--limit` | unlimited | Max google-only users to process |

---

## Rate limits

wirebound queues Management API calls to match [Auth0’s documented limits](https://auth0.com/docs/troubleshoot/customer-support/operational-policies/rate-limit-policy). **Free tenants need no configuration.**

| Plan | Profile settings | Global rate |
|------|------------------|-------------|
| Free (default) | — | 2 req/s |
| Essentials / Professional | `AUTH0_PLAN=essentials-professional` | ~3 req/s + per-endpoint limits |
| Enterprise production | `AUTH0_PLAN=enterprise` | 16 req/s |
| Enterprise dev/staging | `AUTH0_PLAN=enterprise` + `AUTH0_TENANT_ENV=non-production` | 2 req/s |

Example profile snippet:

```dotenv
AUTH0_PLAN=essentials-professional
# Enterprise non-production only:
# AUTH0_TENANT_ENV=non-production
```

`AUTH0_RPS` or `--rps` caps the global rate only — endpoint limits still apply on paid plans. On **HTTP 429**, the CLI reads `X-RateLimit-Reset`, waits, and retries (up to 5 times). Run with `--verbose` to see resolved settings and retry messages.

---

## Search limit

`GET /api/v2/users` search returns at most **1000** users per query. If you have more google-oauth2 matches:

- Use `--limit` to cap how many you process per run

---

## Troubleshooting

| Error / symptom | Fix |
|-----------------|-----|
| `Missing required Auth0 configuration` | Add repo config or `export AUTH0_*` — see [CONFIGURATION.md](../CONFIGURATION.md) |
| `Profile not found: .../profiles/foo.env` | Create the global profile or use `wirebound setup` in the repo |
| HTTP **401** | Wrong client ID/secret; rotate secret in Auth0 and update profile |
| HTTP **403** | M2M app missing required Management API scopes — see scope table above |
| HTTP **429** | Rate limited — CLI retries; set `AUTH0_PLAN` for paid tenants, or reduce `--rps` |
| `0 google-only user(s)` | No matching users, or all Google users are linked to another identity |

---

## Security notes

- Use a **dedicated** M2M app per customer where possible
- Grant **minimum scopes** (`read:users` + `delete:users` only)
- Store config as `chmod 600`; never commit `.wirebound/`
- Always dry-run before `--confirm`
- Rotate client secrets if exposed

---

## Related

- [Configuration guide](../CONFIGURATION.md)
- [Repo config template](../templates/repo-config.env.example)
- [Global profile template](../templates/profile.env.example)
