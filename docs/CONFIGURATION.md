# Configuration

Everything you need to run `wirebound` after `npm install -g @wireboundlabs/cli`. Wirebound stores per-tenant credentials in **repo-local profiles** (recommended) or on your machine — never committed to git. Auth0 is the supported provider today.

## The 60-second version

```bash
# 1. Install
npm install -g @wireboundlabs/cli

# 2. Set up profiles (dev, test, production, etc.)
cd ~/repos/my-app
wirebound setup --profile dev --default
wirebound setup --profile production

# 3. Dry-run (safe — lists candidates, deletes nothing)
wirebound auth0 users cleanup-google-orphans

# 4. Delete after you review the list
wirebound auth0 users cleanup-google-orphans --confirm
```

If step 3 prints users instead of an error, you are configured correctly.

Optional: verify credentials during setup with `wirebound setup --check`.

---

## Where credentials live

| Location | Best for | Path / usage |
|----------|----------|----------------|
| **Repo-local profiles** (recommended) | Multiple tenant envs per repo | `.wirebound/profiles/<name>.env` + `--profile <name>` or `.wirebound/default` |
| **Global profile file** | Shared profiles outside repo context | `~/.config/wirebound/profiles/<name>.env` + `--profile <name>` or `$WIREBOUND_PROFILE` |
| **Shell environment** | Single tenant, CI, one-off scripts | `export AUTH0_DOMAIN=...` etc. |
| **CLI flags** | Debugging only | `--domain`, `--client-id`, `--client-secret` (avoid — secrets end up in shell history) |

---

## Repo-local profiles

Run setup for each Auth0 environment in the repo:

```bash
cd ~/repos/my-app
wirebound setup --profile dev --default
wirebound setup --profile test
wirebound setup --profile production
```

This creates:

```
my-app/
└── .wirebound/
    ├── default              # contains "dev" — used when --profile is omitted
    └── profiles/
        ├── dev.env
        ├── test.env
        └── production.env
```

The CLI walks up from your current directory until it finds `.wirebound/`. Commands in subdirectories still pick up the repo root profiles.

`wirebound setup` also appends `.wirebound/` to `.gitignore` when a `.gitignore` file exists and does not already ignore it.

### Switching profiles

```bash
# Explicit profile
wirebound auth0 users cleanup-google-orphans --profile test

# Shell default for the session
export WIREBOUND_PROFILE=production
wirebound auth0 users cleanup-google-orphans

# Repo default (.wirebound/default) when neither is set
wirebound auth0 users cleanup-google-orphans
```

List configured profiles:

```bash
wirebound setup --list
```

### Manual creation

```bash
mkdir -p .wirebound/profiles
cp docs/templates/repo-config.env.example .wirebound/profiles/dev.env
chmod 600 .wirebound/profiles/dev.env
echo dev > .wirebound/default
```

Example `.wirebound/profiles/dev.env`:

```dotenv
AUTH0_DOMAIN=dev-tenant.us.auth0.com
AUTH0_MGMT_CLIENT_ID=abcdefghijklmnopqrstuvwxyz1234
AUTH0_MGMT_CLIENT_SECRET=your-secret-here-use-the-auth0-dashboard-value

# Optional — only for paid Auth0 plans (see Rate limits below)
# AUTH0_PLAN=essentials-professional
# AUTH0_TENANT_ENV=production
```

### Legacy single-file config

Older setups used `.wirebound/config.env` (no profile name). That still works when no default profile or `--profile` is set.

### Setup flags

| Flag | Description |
|------|-------------|
| `--profile <name>` | Profile name (prompted if omitted) |
| `--default` | Set this profile as the repo default (`.wirebound/default`) |
| `--list` | List repo-local profiles and exit |
| `--force` | Overwrite existing profile without prompting |
| `--dir <path>` | Target repo directory (default: current working directory) |
| `--check` | Verify Auth0 credentials after writing config |

---

## Global profile file format

Copy the template:

```bash
mkdir -p ~/.config/wirebound/profiles
cp docs/templates/profile.env.example ~/.config/wirebound/profiles/acme.env
chmod 600 ~/.config/wirebound/profiles/acme.env
```

Example `~/.config/wirebound/profiles/acme.env`:

```dotenv
# Auth0 — required for auth0:* commands
AUTH0_DOMAIN=acme.us.auth0.com
AUTH0_MGMT_CLIENT_ID=abcdefghijklmnopqrstuvwxyz1234
AUTH0_MGMT_CLIENT_SECRET=your-secret-here-use-the-auth0-dashboard-value
```

### Using a global profile

```bash
wirebound auth0 users cleanup-google-orphans --profile acme

# Default profile via environment (set once in ~/.zshrc)
export WIREBOUND_PROFILE=acme
wirebound auth0 users cleanup-google-orphans
```

---

## Environment variables (no config file)

If you only ever touch one tenant, you can skip config files and export vars in your shell or CI:

```bash
export AUTH0_DOMAIN=acme.us.auth0.com
export AUTH0_MGMT_CLIENT_ID=your-client-id
export AUTH0_MGMT_CLIENT_SECRET=your-client-secret

wirebound auth0 users cleanup-google-orphans
```

Oclif also reads these when resolving `--domain`, `--client-id`, and `--client-secret` flags, so `--help` documents the mapping.

### Variable reference (Auth0)

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH0_DOMAIN` | Yes | Tenant domain, **without** `https://` (e.g. `acme.us.auth0.com`) |
| `AUTH0_MGMT_CLIENT_ID` | Yes | Machine-to-Machine application Client ID |
| `AUTH0_MGMT_CLIENT_SECRET` | Yes | M2M Client Secret (shown once when created — save it) |
| `AUTH0_PLAN` | No | Subscription plan for rate limits: `free` (default), `essentials-professional`, or `enterprise` |
| `AUTH0_TENANT_ENV` | No | Tenant environment for Enterprise: `production` (default) or `non-production` |
| `AUTH0_RPS` | No | Override global Management API requests per second (endpoint limits still apply) |
| `WIREBOUND_PROFILE` | No | Default global profile name (same as `--profile`) |

---

## Precedence (what wins when several sources are set)

For each Auth0 setting, **later steps override earlier ones**:

1. Built-in defaults (e.g. `AUTH0_PLAN=free`, global **2 req/s** for Free tenants)
2. **Legacy repo config** (`.wirebound/config.env`, when no profile is selected)
3. **Default repo profile** (`.wirebound/default` → `.wirebound/profiles/<name>.env`)
4. **Named profile** (`--profile` or `$WIREBOUND_PROFILE` — repo-local first, then global)
5. **Process environment** (`export AUTH0_*=...`)
6. **CLI flags** (`--domain`, `--client-id`, `--client-secret`, `--auth0-plan`, `--auth0-tenant-env`, `--rps`)

Example: repo config sets `AUTH0_DOMAIN=prod.auth0.com`, but you pass `--domain staging.auth0.com` → **staging** is used.

---

## Rate limits

wirebound queues Auth0 Management API calls to match [Auth0’s documented limits](https://auth0.com/docs/troubleshoot/customer-support/operational-policies/rate-limit-policy). **Free tenants need no configuration** (defaults to 2 req/s). On paid plans, set your plan so the CLI can use your subscription's higher limits instead of the default free-tier throttle:

| Your Auth0 subscription | Set in profile |
|-------------------------|----------------|
| Free or trial | *(nothing — default)* |
| Essentials or Professional | `AUTH0_PLAN=essentials-professional` |
| Enterprise (production) | `AUTH0_PLAN=enterprise` |
| Enterprise (dev / staging) | `AUTH0_PLAN=enterprise` and `AUTH0_TENANT_ENV=non-production` |

Optional: `AUTH0_RPS` or `--rps` lowers the global rate further. Per-endpoint limits still apply on paid plans.

Use `--verbose` to see the resolved tenant and rate-limit settings on each command. HTTP 429 responses are retried automatically.

Full details: [Auth0 vendor guide — Rate limits](vendors/auth0.md#rate-limits).

---

## Auth0 setup (M2M credentials)

You need a **Machine-to-Machine** application authorized for the **Auth0 Management API** with scopes `read:users`, `update:users`, `delete:users`, and `read:logs` (grant only what your commands need).

Full click-by-click instructions: [docs/vendors/auth0.md](vendors/auth0.md#set-up-machine-to-machine-credentials-in-auth0).

Short version:

1. Auth0 Dashboard → **Applications** → **Create Application**
2. Name it e.g. `Wirebound CLI`, type **Machine to Machine**
3. Authorize it for **Auth0 Management API**
4. Enable scopes: **`read:users`**, **`update:users`**, **`delete:users`**, **`read:logs`** (as needed)
5. Copy **Domain** (Settings → Domain), **Client ID**, and **Client Secret** into config via `wirebound setup`

---

## Verifying configuration

### Missing config

```bash
wirebound auth0 users cleanup-google-orphans
```

If nothing is configured, you should see:

```text
Missing required Auth0 configuration: domain (...), client ID (...), client secret (...)
```

Fix: run `wirebound setup` in the repo or export the three `AUTH0_*` variables.

### Profile not found

```bash
wirebound auth0 users cleanup-google-orphans --profile nonexistent
```

```text
Profile not found: /Users/you/.config/wirebound/profiles/nonexistent.env
```

Fix: create the file or fix the profile name.

### Successful dry-run

```bash
wirebound auth0 users cleanup-google-orphans --verbose
```

You should see token + user list activity (or “0 google-only users” if none match). **No deletes** unless you pass `--confirm`.

### Insufficient scopes (403)

If the M2M app is missing `read:users` or `delete:users`, API calls fail with HTTP 403. Re-open the M2M app in Auth0 → APIs → Auth0 Management API → grant the scopes.

---

## CI / automation

Use environment variables or a profile file written in the job (from secrets):

```yaml
# GitHub Actions example
env:
  AUTH0_DOMAIN: ${{ secrets.AUTH0_DOMAIN }}
  AUTH0_MGMT_CLIENT_ID: ${{ secrets.AUTH0_MGMT_CLIENT_ID }}
  AUTH0_MGMT_CLIENT_SECRET: ${{ secrets.AUTH0_MGMT_CLIENT_SECRET }}
run: wirebound auth0 users cleanup-google-orphans --json
```

Always **dry-run in CI first**; add `--confirm` only when the pipeline is trusted and reviewed.

---

## Security checklist

- [ ] Config files are mode `600` (`wirebound setup` sets this automatically)
- [ ] `.wirebound/` is in `.gitignore` (setup adds it when possible)
- [ ] Global profiles are **not** in git (only `*.env.example` / templates in the repo)
- [ ] M2M app has **only** the scopes you need (`read:users`, `update:users`, `delete:users`, `read:logs`)
- [ ] Use a **dedicated** M2M app per customer/tenant where possible
- [ ] Prefer repo-local config or env vars over passing `--client-secret` on the command line
- [ ] Default is **dry-run** — deletes require explicit `--confirm`

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `Missing required Auth0 configuration` | No repo config / profile / env / flags | Run `wirebound setup` in the repo |
| `Profile not found` | Wrong global profile name | `ls ~/.config/wirebound/profiles/` |
| Config ignored in subdirectory | No `.wirebound/config.env` in parent tree | Run setup at repo root |
| `HTTP 401` | Wrong client secret or ID | Regenerate secret in Auth0 dashboard |
| `HTTP 403` | Missing API scopes | Add `read:users` + `delete:users` on M2M app |
| `HTTP 429` | Rate limit | CLI retries automatically; reduce `--rps` or wait |
| Command hangs then retries | Normal on 429 | Use `--verbose` to see wait messages |
| Only 1000 users seen | Auth0 search cap | Documented limit; use `--limit` to cap per run |

---

## Further reading

- [Auth0 vendor guide](vendors/auth0.md) — dashboard setup, commands, rate limits
- [Repo config template](templates/repo-config.env.example) — copy-paste starter for `.wirebound/config.env`
- [Global profile template](templates/profile.env.example) — copy-paste starter for global profiles
- [README](../README.md) — install and command index
