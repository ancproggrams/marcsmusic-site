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
SOUNDCLOUD_CLIENT_ID=""
SOUNDCLOUD_CLIENT_SECRET=""
SOUNDCLOUD_REDIRECT_URI="http://localhost:3000/api/auth/soundcloud/callback"
```

Optional Mailgun outreach settings:

```bash
MAILGUN_API_KEY=""
MAILGUN_DOMAIN="mg.marcsmusic.nl"
MAILGUN_BASE_URL="https://api.eu.mailgun.net"
OUTREACH_FROM_EMAIL="outreach@mg.marcsmusic.nl"
OUTREACH_FROM_NAME="Marc Rene"
OUTREACH_REPLY_TO="marc@marcsmusic.nl"
OUTREACH_MAIL_TOKEN=""
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
SOUNDCLOUD_CLIENT_ID="..."
SOUNDCLOUD_CLIENT_SECRET="..."
SOUNDCLOUD_REDIRECT_URI="https://your-railway-domain.up.railway.app/api/auth/soundcloud/callback"
MAILGUN_API_KEY="..."
MAILGUN_DOMAIN="mg.marcsmusic.nl"
MAILGUN_BASE_URL="https://api.eu.mailgun.net"
OUTREACH_FROM_EMAIL="outreach@mg.marcsmusic.nl"
OUTREACH_FROM_NAME="Marc Rene"
OUTREACH_REPLY_TO="marc@marcsmusic.nl"
OUTREACH_MAIL_TOKEN="generate-a-long-random-token"
OUTREACH_MAX_EMAILS_PER_HOUR="20"
OUTREACH_MP3_ROOT="outreach-mp3"
OUTREACH_ALLOWED_RECIPIENT_DOMAINS=""
```

After Railway creates the public domain, update `NEXT_PUBLIC_APP_URL` and `SOUNDCLOUD_REDIRECT_URI`, then add the same callback URL in the official SoundCloud developer app settings.

The `/outreach` page includes reusable templates for playlist curators, blogs/channels, radio/DJ contacts, label/sync contacts, and follow-ups. It can optionally attach selected MP3s from `OUTREACH_MP3_ROOT`, with a conservative server-side bundle size limit. The production deploy expects the six approved MP3s in `outreach-mp3/`; use a mounted directory only when you intentionally manage the audio files outside the deploy bundle. It sends one human-approved plain-text email at a time through `/api/outreach/email`. The API requires `OUTREACH_MAIL_TOKEN` in an `Authorization: Bearer ...` header, applies `OUTREACH_MAX_EMAILS_PER_HOUR`, and keeps `MAILGUN_API_KEY` server-side only. Mailgun tracking is disabled by default.

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
- read-only SoundCloud API client;
- `/dashboard`;
- `/tracks`;
- `/api/tracks/sync`;
- `/api/metrics/snapshot`;
- `/api/reports/weekly`;
- daily snapshot job;
- weekly report job;
- scoring and metadata tests.

Still needed before production:

- encrypted token storage;
- database-backed OAuth state instead of short-lived cookies only;
- migrations committed after a real database is selected;
- structured logging, metrics, alerting, and job scheduling;
- comment ingestion and manual reply-draft workflow;
- smartlink redirect endpoint and click tracking;
- load testing and API rate-limit monitoring.
