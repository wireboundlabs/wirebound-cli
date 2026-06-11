# Configuration

Everything you need to run `wirebound` after `npm install -g @wireboundlabs/cli`. No code in this repo, no `.env` committed — credentials live on your machine only.

## The 60-second version

```bash
# 1. Install
npm install -g @wireboundlabs/cli

# 2. Create a profile (one per customer / tenant)
mkdir -p ~/.config/wirebound/profiles
cp docs/templates/profile.env.example ~/.config/wirebound/profiles/acme.env
# Edit acme.env — paste domain, client ID, and client secret from Auth0

# 3. Set your default profile (optional — skip --profile on every command)
echo 'export WIREBOUND_PROFILE=acme' >> ~/.zshrc   # or ~/.bashrc
source ~/.zshrc

# 4. Dry-run (safe — lists candidates, deletes nothing)
wirebound auth0 delete-google-users

# 5. Delete after you review the list
wirebound auth0 delete-google-users --confirm
```

If step 4 prints users instead of an error, you are configured correctly.

---

## Where credentials live

| Location | Best for | Path / usage |
|----------|----------|----------------|
| **Profile file** (recommended) | Multiple customers, daily ops | `~/.config/wirebound/profiles/<name>.env` + `--profile <name>` or `$WIREBOUND_PROFILE` |
| **Shell environment** | Single tenant, CI, one-off scripts | `export AUTH0_DOMAIN=...` etc. |
| **CLI flags** | Debugging only | `--domain`, `--client-id`, `--client-secret` (avoid — secrets end up in shell history) |

Profiles are plain `.env` files. One profile can hold credentials for **multiple vendors** (Auth0 today; Okta, Azure, Transmit later) in the same file.

```
~/.config/wirebound/
└── profiles/
    ├── acme.env          # customer A
    ├── globex.env        # customer B
    └── internal.env      # your dev tenant
```

**Never commit profile files or real secrets.** The repo only ships `.env.example` and `docs/templates/` with placeholders.

---

## Profile file format

Copy the template:

```bash
cp docs/templates/profile.env.example ~/.config/wirebound/profiles/acme.env
chmod 600 ~/.config/wirebound/profiles/acme.env   # optional but recommended
```

Example `~/.config/wirebound/profiles/acme.env`:

```dotenv
# Auth0 — required for auth0:* commands
AUTH0_DOMAIN=acme.us.auth0.com
AUTH0_MGMT_CLIENT_ID=abcdefghijklmnopqrstuvwxyz1234
AUTH0_MGMT_CLIENT_SECRET=your-secret-here-use-the-auth0-dashboard-value

# Future vendors can live in the same file:
# OKTA_DOMAIN=acme.okta.com
# OKTA_API_TOKEN=...
```

### Using a profile

```bash
# Explicit
wirebound auth0 delete-google-users --profile acme

# Default profile via environment (set once in ~/.zshrc)
export WIREBOUND_PROFILE=acme
wirebound auth0 delete-google-users
```

### Multiple customers

Switch profiles per invocation or per shell session:

```bash
wirebound auth0 delete-google-users --profile acme
wirebound auth0 delete-google-users --profile globex

# Or in separate terminal sessions with different WIREBOUND_PROFILE
```

---

## Environment variables (no profile file)

If you only ever touch one tenant, you can skip profiles and export vars in your shell or CI:

```bash
export AUTH0_DOMAIN=acme.us.auth0.com
export AUTH0_MGMT_CLIENT_ID=your-client-id
export AUTH0_MGMT_CLIENT_SECRET=your-client-secret

wirebound auth0 delete-google-users
```

Oclif also reads these when resolving `--domain`, `--client-id`, and `--client-secret` flags, so `--help` documents the mapping.

### Variable reference (Auth0)

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH0_DOMAIN` | Yes | Tenant domain, **without** `https://` (e.g. `acme.us.auth0.com`) |
| `AUTH0_MGMT_CLIENT_ID` | Yes | Machine-to-Machine application Client ID |
| `AUTH0_MGMT_CLIENT_SECRET` | Yes | M2M Client Secret (shown once when created — save it) |
| `WIREBOUND_PROFILE` | No | Default profile name (same as `--profile`) |

**Deprecated aliases** (still work; use namespaced vars for new setups):

| Old name | Use instead |
|----------|-------------|
| `MGMT_CLIENT_ID` | `AUTH0_MGMT_CLIENT_ID` |
| `MGMT_CLIENT_SECRET` | `AUTH0_MGMT_CLIENT_SECRET` |

---

## Precedence (what wins when several sources are set)

For each Auth0 setting, **later steps override earlier ones**:

1. Built-in defaults (e.g. `--rps` defaults to `2`)
2. **Profile file** (when `--profile` or `$WIREBOUND_PROFILE` is set)
3. **Process environment** (`export AUTH0_*=...`)
4. **CLI flags** (`--domain`, `--client-id`, `--client-secret`)

Example: profile sets `AUTH0_DOMAIN=prod.auth0.com`, but you pass `--domain staging.auth0.com` → **staging** is used.

---

## Auth0 setup (M2M credentials)

You need a **Machine-to-Machine** application authorized for the **Auth0 Management API** with scopes `read:users` and `delete:users`.

Full click-by-click instructions: [docs/vendors/auth0.md](vendors/auth0.md#set-up-machine-to-machine-credentials-in-auth0).

Short version:

1. Auth0 Dashboard → **Applications** → **Create Application**
2. Name it e.g. `Wirebound CLI`, type **Machine to Machine**
3. Authorize it for **Auth0 Management API**
4. Enable scopes: **`read:users`**, **`delete:users`**
5. Copy **Domain** (Settings → Domain), **Client ID**, and **Client Secret** into your profile

---

## Verifying configuration

### Missing config

```bash
wirebound auth0 delete-google-users
```

If nothing is configured, you should see:

```text
Missing required Auth0 configuration: domain (...), client ID (...), client secret (...)
```

Fix: create a profile or export the three `AUTH0_*` variables.

### Profile not found

```bash
wirebound auth0 delete-google-users --profile nonexistent
```

```text
Profile not found: /Users/you/.config/wirebound/profiles/nonexistent.env
```

Fix: create the file or fix the profile name.

### Successful dry-run

```bash
wirebound auth0 delete-google-users --profile acme --verbose
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
run: wirebound auth0 delete-google-users --json
```

Always **dry-run in CI first**; add `--confirm` only when the pipeline is trusted and reviewed.

---

## Security checklist

- [ ] Profile files are mode `600` (`chmod 600 ~/.config/wirebound/profiles/*.env`)
- [ ] Profiles are **not** in git (only `*.env.example` / templates in the repo)
- [ ] M2M app has **only** the scopes you need (`read:users`, `delete:users` for the current command)
- [ ] Use a **dedicated** M2M app per customer/tenant where possible
- [ ] Prefer `--profile` / `$WIREBOUND_PROFILE` over passing `--client-secret` on the command line
- [ ] Default is **dry-run** — deletes require explicit `--confirm`

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `Missing required Auth0 configuration` | No profile / env / flags | See [The 60-second version](#the-60-second-version) |
| `Profile not found` | Wrong name or path | `ls ~/.config/wirebound/profiles/` |
| `HTTP 401` | Wrong client secret or ID | Regenerate secret in Auth0 dashboard |
| `HTTP 403` | Missing API scopes | Add `read:users` + `delete:users` on M2M app |
| `HTTP 429` | Rate limit | CLI retries automatically; lower volume or reduce `--rps` |
| Command hangs then retries | Normal on 429 | Use `--verbose` to see wait messages |
| Only 1000 users seen | Auth0 search cap | Documented limit; use `--limit` or future export command |

---

## Further reading

- [Auth0 vendor guide](vendors/auth0.md) — dashboard setup, commands, rate limits
- [Profile template](templates/profile.env.example) — copy-paste starter file
- [README](../README.md) — install and command index
