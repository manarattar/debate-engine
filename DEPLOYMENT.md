# Deploying Munazara — AI Debate Engine

**Live at `munazara.manarattar.com` (and `debate.manarattar.com`, which 301s to it).**

## How it is put together

Vite SPA served by Caddy; FastAPI proxied at `/api/*` on the same origin.

## Where this runs

Everything is on a single Contabo VPS. There is no Vercel, Render, or other
PaaS involved any more.

| | |
|---|---|
| Server | `194.163.176.183` — `ssh ubuntu@194.163.176.183` (key only, no password) |
| Stack | `/srv/stack/docker-compose.yml` + `/srv/stack/Caddyfile` |
| App sources | `/srv/apps/<name>` |
| Built static sites | `/srv/www/<name>` |
| Secrets | `/srv/stack/env/<name>.env` (0600, root-owned) |
| Database | one `postgres:18-alpine` container, internal network only |
| TLS | Caddy, automatic Let's Encrypt |
| Backups | nightly 03:17 to `/srv/backup/nightly`, 14-day rotation |

Caddy terminates TLS for every hostname and routes by host. Postgres has no
published port — it is reachable only on the internal Docker network.

## Secrets

Never commit them. Each app reads `/srv/stack/env/<name>.env` on the server,
which compose injects via `env_file`. `DATABASE_URL` is set by compose, not by
that file, so an app cannot accidentally point at an old database.

## Deploying a change

```bash
# do NOT pass an empty VITE_CLERK_PUBLISHABLE_KEY, see gotchas
cd frontend && VITE_API_URL="" npm run build
tar czf - -C dist . | ssh ubuntu@194.163.176.183 \
  'rm -rf /srv/www/munazara && mkdir -p /srv/www/munazara && tar xzf - -C /srv/www/munazara'

cd ../backend && tar czf - --exclude=venv --exclude=.env --exclude=chroma --exclude=data . \
  | ssh ubuntu@194.163.176.183 'tar xzf - -C /srv/apps/munazara'
ssh ubuntu@194.163.176.183 'cd /srv/stack && sudo docker compose up -d --build munazara'
```

## Things that will catch you out

- **Clerk auth is easy to break silently.** `frontend/.env.local` holds a live
  `VITE_CLERK_PUBLISHABLE_KEY`. Passing that variable empty on the command line
  overrides the file and ships a bundle with no auth — the build still succeeds.
  Override only `VITE_API_URL`, and verify afterwards:
  `grep -rhoE "pk_(test|live)_[A-Za-z0-9_-]{{6}}" dist`
- Clerk also needs five CNAMEs under `munazara` in DNS (`clerk`, `accounts`,
  `clkmail`, and two `_domainkey`). Delete those and logins break.
- Streams SSE, so Caddy sets `flush_interval -1`.
- Uses the `munazaradb` database — the only one carrying real user data.
- `chromadb` is in `requirements.txt` but never imported. Dead dependency.

## Rolling back

Rebuild from the previous commit and redeploy. There is no rollback to a
previous provider — the old Vercel and Render deployments were deleted in
September 2026. Database backups are on the server at
`/srv/backup/nightly` (nightly, 14-day rotation).
