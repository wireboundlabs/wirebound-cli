# @wireboundlabs/cli

Wirebound customer operations CLI. Install once, point at a customer’s Auth0 tenant, run operational commands.

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

**Don’t have an M2M app yet?** Follow [Set up M2M credentials in Auth0](docs/vendors/auth0.md#set-up-machine-to-machine-credentials-in-auth0) (5 minutes).

### Recommended: profile file + default profile

Best for working with one or more customers. Credentials stay in one place; you don’t pass secrets on the command line.

```bash
# 1. Create profile directory
mkdir -p ~/.config/wirebound/profiles

# 2. Create profile (paste your Auth0 values from the dashboard)
cat > ~/.config/wirebound/profiles/acme.env <<'EOF'
AUTH0_DOMAIN=acme.us.auth0.com
AUTH0_MGMT_CLIENT_ID=paste-client-id-here
AUTH0_MGMT_CLIENT_SECRET=paste-client-secret-here
EOF

chmod 600 ~/.config/wirebound/profiles/acme.env
```

Or copy the template shipped with the package:

```bash
cp "$(npm root -g)/@wireboundlabs/cli/docs/templates/profile.env.example" \
   ~/.config/wirebound/profiles/acme.env
$EDITOR ~/.config/wirebound/profiles/acme.env
chmod 600 ~/.config/wirebound/profiles/acme.env
```

```bash
# 3. Default profile — no --profile on every command
echo 'export WIREBOUND_PROFILE=acme' >> ~/.zshrc   # or ~/.bashrc
source ~/.zshrc
```

Your `acme.env` should look like:

```dotenv
AUTH0_DOMAIN=acme.us.auth0.com
AUTH0_MGMT_CLIENT_ID=abc123...
AUTH0_MGMT_CLIENT_SECRET=long-secret-from-auth0-dashboard
```

### Alternative: shell environment only

Fine for a single tenant or CI:

```bash
export AUTH0_DOMAIN=acme.us.auth0.com
export AUTH0_MGMT_CLIENT_ID=your-client-id
export AUTH0_MGMT_CLIENT_SECRET=your-client-secret
```

No profile file and no `--profile` flag needed.

### Alternative: flags (avoid for secrets)

```bash
wirebound auth0 delete-google-users \
  --domain acme.us.auth0.com \
  --client-id '...' \
  --client-secret '...'
```

Secrets may be stored in shell history — use profiles or env vars instead.

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

If you didn’t set `WIREBOUND_PROFILE`:

```bash
wirebound auth0 delete-google-users --profile acme
```

---

## Configuration reference

| Method | When to use |
|--------|-------------|
| Profile + `$WIREBOUND_PROFILE` | **Default recommendation** — multiple customers, daily use |
| `--profile <name>` | One-off switch between customers |
| `export AUTH0_*` | Single tenant, CI/CD |
| `--domain` / `--client-id` / `--client-secret` | Debugging only |

**Precedence** (highest wins): CLI flags → environment variables → profile file → defaults.

Full guide: **[docs/CONFIGURATION.md](docs/CONFIGURATION.md)** — precedence, CI, troubleshooting, security.

---

## Commands

| Command | Description |
|---------|-------------|
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
| `WIREBOUND_PROFILE` | Default profile name (optional) |

Deprecated aliases: `MGMT_CLIENT_ID`, `MGMT_CLIENT_SECRET`.

---

## Common flags

| Flag | Description |
|------|-------------|
| `--profile <name>` | Load `~/.config/wirebound/profiles/<name>.env` (or set `WIREBOUND_PROFILE`) |
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
./bin/dev.js auth0 delete-google-users --help
```

---

## License

MIT
