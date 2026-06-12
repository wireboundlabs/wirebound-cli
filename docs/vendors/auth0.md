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

Required Management API scopes for current commands:

| Scope | Used by |
|-------|---------|
| `read:users` | Listing users |
| `delete:users` | `delete-google-users --confirm` |

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
   - **`delete:users`**
3. **Authorize** / save

Grant only what you need. For dry-runs you still need `read:users`; deletes require `delete:users`.

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

### `wirebound auth0 delete-google-users`

Deletes Auth0 users that have **exactly one** identity and that identity’s provider is `google-oauth2`.

| Behavior | Detail |
|----------|--------|
| Includes | Users with only a Google social login |
| Skips | Users with 2+ identities (e.g. Google + database linked) |
| Does not check | Whether another database user shares the same email |
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

| Flag | Default | Description |
|------|---------|-------------|
| `--domain` | `$AUTH0_DOMAIN` / config | Tenant domain |
| `--client-id` | `$AUTH0_MGMT_CLIENT_ID` / config | M2M Client ID |
| `--client-secret` | `$AUTH0_MGMT_CLIENT_SECRET` / config | M2M Client Secret |
| `--profile` | `$WIREBOUND_PROFILE` | Global profile name |
| `--limit` | unlimited | Max google-only users to process |
| `--rps` | `2` | Management API requests per second |
| `--verbose` | `false` | Log pagination and rate-limit waits |
| `--json` | `false` | JSON output |
| `--confirm` | `false` | Perform deletes |

---

## Rate limits

Auth0 throttles Management API traffic. Typical limits:

| Tenant type | Sustained rate |
|-------------|----------------|
| Free / dev | ~2 requests/second |
| Paid | Higher (varies by plan) |

The CLI defaults to `--rps 2` and queues every API call (token, list, delete). On **HTTP 429**, it reads `X-RateLimit-Reset`, waits, and retries (up to 5 times). Use `--verbose` to see retry messages.

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
| HTTP **403** | M2M app missing `read:users` or `delete:users` on Management API |
| HTTP **429** | Rate limited — CLI retries; reduce `--rps` or wait |
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
