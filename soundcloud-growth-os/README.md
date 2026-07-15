# SoundCloud Growth OS

White-hat SoundCloud growth workspace for MarcsMusic. The app measures track performance, syncs official SoundCloud metadata, captures daily snapshots, drafts weekly reports, and keeps unsafe automation out of the system.

## What This Is

- A Next.js + TypeScript dashboard for SoundCloud-only growth work.
- A Prisma/Postgres data model for artists, tracks, daily metrics, comments, fans, experiments, and smartlinks.
- A read-only SoundCloud API wrapper using OAuth PKCE.
- CLI jobs for daily track snapshots and weekly growth reports.
- Guardrails that block fake plays, auto-following, auto-liking, auto-reposting, auto-commenting, auto-DMs, scraping, and paid actions.

## Setup

1. Install dependencies:

```bash
npm --prefix soundcloud-growth-os install
```

2. Copy the environment template:

```bash
cp soundcloud-growth-os/.env.example soundcloud-growth-os/.env
```

3. Fill in:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/soundcloud_growth_os?schema=public"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
GROWTH_OS_ADMIN_USERNAME="growth-admin"
GROWTH_OS_ADMIN_PASSWORD=""
SOUNDCLOUD_CLIENT_ID=""
SOUNDCLOUD_CLIENT_SECRET=""
SOUNDCLOUD_REDIRECT_URI="http://localhost:3000/api/auth/soundcloud/callback"
SOUNDCLOUD_TOKEN_ACTIVE_KID="local-2026-01"
SOUNDCLOUD_TOKEN_KEYS_JSON='{"local-2026-01":"replace-with-canonical-base64-32-byte-key"}'
```

The empty admin password and placeholder encryption value are intentionally invalid. Generate the admin password with `openssl rand -base64 48` and a 32-byte encryption key with `openssl rand -base64 32`; keep both in the environment/secret store only. The browser uses its native Basic-auth prompt; never put credentials in a URL. All pages and application APIs require admin authentication except exact `/api/health`, Next static assets, and the separately protected deprecated outreach endpoint. Public `/api/health` is a readiness check: it validates SoundCloud configuration, the encryption keyring, bounded runtime settings, and a deadline-bounded database transaction, but returns only `ready` or `not_ready` without dependency details.

Optional Mailgun outreach settings:

```bash
MAILGUN_API_KEY=""
MAILGUN_DOMAIN="mg.marcsmusic.nl"
MAILGUN_BASE_URL="https://api.eu.mailgun.net"
OUTREACH_FROM_EMAIL="outreach@mg.marcsmusic.nl"
OUTREACH_FROM_NAME="Marc Rene"
OUTREACH_REPLY_TO="marc@marcsmusic.nl"
OUTREACH_MAIL_TOKEN=""
LEGACY_OUTREACH_SEND_ENABLED="false"
OUTREACH_MAX_EMAILS_PER_HOUR="20"
OUTREACH_MP3_ROOT="outreach-mp3"
OUTREACH_ALLOWED_RECIPIENT_DOMAINS=""
```

Use the verified EU Mailgun sending subdomain `mg.marcsmusic.nl` for production outreach. Keep MXRoute on `marcsmusic.nl` for normal inbox hosting, and send outreach as `Marc Rene <outreach@mg.marcsmusic.nl>` with `Reply-To: marc@marcsmusic.nl`. The default Mailgun sandbox domain is useful for tests, but it can only send to authorized recipients and is not suitable for real outreach.

4. Generate Prisma and run the migration:

```bash
npm --prefix soundcloud-growth-os run prisma:generate
npm --prefix soundcloud-growth-os run prisma:migrate
```

5. Start the app:

```bash
npm run growth:dev
```

Open `http://localhost:3000/dashboard`, connect SoundCloud, then run the sync endpoint from the app or with an HTTP POST to `/api/tracks/sync`.

## Jobs

Run a daily snapshot:

```bash
npm run growth:daily-snapshot
```

Generate a weekly report:

```bash
npm run growth:weekly-report
```

OAuth access/refresh tokens are always written as versioned AES-256-GCM envelopes. For the bounded dry-run/apply migration and key-rotation procedure, follow [docs/security-runbook.md](docs/security-runbook.md). Do not enable legacy plaintext migration on the long-running web process.

Weekly reports are written to `soundcloud-growth-os/reports/` and ignored by git because they may contain private account performance data.

## Railway Deploy

Deploy the subapp as its own Railway service. Do not deploy it over the existing homepage service.

Recommended service settings:

```bash
Root directory: soundcloud-growth-os
Build command: npm run build
Start command: npm run railway:start
Health endpoint: /api/health
```

Required Railway variables:

```bash
DATABASE_URL="${{Postgres.DATABASE_URL}}"
NEXT_PUBLIC_APP_URL="https://your-railway-domain.up.railway.app"
GROWTH_OS_ADMIN_USERNAME="growth-admin"
GROWTH_OS_ADMIN_PASSWORD="..."
SOUNDCLOUD_CLIENT_ID="..."
SOUNDCLOUD_CLIENT_SECRET="..."
SOUNDCLOUD_REDIRECT_URI="https://your-railway-domain.up.railway.app/api/auth/soundcloud/callback"
SOUNDCLOUD_TOKEN_ACTIVE_KID="prod-2026-01"
SOUNDCLOUD_TOKEN_KEYS_JSON='{"prod-2026-01":"..."}'
SOUNDCLOUD_REFRESH_LOCK_WAIT_MS="1500"
SOUNDCLOUD_API_DEADLINE_MS="15000"
SOUNDCLOUD_API_MAX_RESPONSE_BYTES="1048576"
SOUNDCLOUD_HEALTH_DB_TIMEOUT_MS="2000"
LEGACY_OUTREACH_SEND_ENABLED="false"
```

After Railway creates the public domain, update `NEXT_PUBLIC_APP_URL` and `SOUNDCLOUD_REDIRECT_URI`, then add the same callback URL in the official SoundCloud developer app settings.

OAuth refresh is serialized per artist across Railway replicas with a bounded PostgreSQL transaction-scoped advisory lease. The winning replica rereads and decrypts under the lease before calling SoundCloud, then persists behind revision/row fencing; queued replicas reuse the winner and never submit the same single-use refresh token twice. Lock contention returns a short `503` instead of starting unsafe provider I/O. Official API reads enforce an exact parsed `https://api.soundcloud.com` origin, reject redirects and credential/authority tricks, use an overall deadline plus per-attempt abort, cap decoded response bytes, and retry only classified transient failures with bounded `Retry-After` and jitter.

The `/outreach` page and `/api/outreach/email` route are retained only as a deprecated local/manual interface. Exact `LEGACY_OUTREACH_SEND_ENABLED="true"` works only in a non-production, non-Railway development/test runtime. `NODE_ENV=production` or any Railway environment/project/service marker forces both the route gate and the independent Mailgun provider gate closed, regardless of all other variables. Production must remove Mailgun send credentials from this service and use `services/outreach-worker` as the only outreach send authority so EspoCRM decisions, suppressions, durable idempotency, capacity controls and audit events cannot be bypassed.

## Safety Rules

The codebase is intentionally not a SoundCloud bot. It may:

- read your own SoundCloud account and track metadata through the official API;
- calculate engagement, momentum, fan, and reply-priority scores;
- create local reports and recommendations;
- produce drafts that you approve manually.

It may not:

- create fake plays;
- auto-follow, auto-unfollow, auto-like, auto-repost, auto-comment, or auto-DM;
- scrape SoundCloud outside the official API;
- upload, delete, or edit public SoundCloud content without explicit human action;
- perform paid Artist Pro or promotion actions automatically.

## MVP Status

Implemented:

- project scaffold;
- Prisma schema;
- SoundCloud OAuth PKCE skeleton;
- fail-closed admin authentication at proxy and sensitive API route boundaries;
- versioned AES-256-GCM OAuth token envelopes, bounded key rotation, cross-replica refresh serialization with fencing, and a migration job;
- read-only SoundCloud API client with exact-origin enforcement, deadlines, response caps, and classified bounded retries;
- non-diagnostic configuration/keyring/database readiness;
- `/dashboard`;
- `/tracks`;
- `/api/tracks/sync`;
- `/api/metrics/snapshot`;
- `/api/reports/weekly`;
- daily snapshot job;
- weekly report job;
- scoring and metadata tests.

Still needed before production:

- database-backed OAuth state instead of short-lived cookies only;
- structured logging, metrics, alerting, and job scheduling;
- comment ingestion and manual reply-draft workflow;
- smartlink redirect endpoint and click tracking;
- load testing and API rate-limit monitoring.
