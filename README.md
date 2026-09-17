# MarcsMusic site, CRM and booking system

This project serves the MarcsMusic site and a server-side booking flow with a self-hosted CRM and CalDAV calendar.

## What is included

- Responsive MarcsMusic onepage site
- Dedicated booking page at `/booking` / `booking.html`
- Server-side EspoCRM integration for contacts, newsletter opt-ins and `DJBooking` records
- Server-side CalDAV integration for availability checks and confirmed calendar events
- Server-side Mollie Payments API integration and webhook verification
- Newsletter endpoint at `/api/newsletter/subscribe`
- Periodic, idempotent import of public assignments from De Transparante Broker
- Admin page at `/admin`
- Optional manifest-backed public EPK at `/epk/:slug` with JSON at `/api/epk/:slug`
- Deployment starter files for EspoCRM and Radicale

## Architecture

- Website/backend: Node.js on Railway
- CRM: EspoCRM on Railway, currently `https://marcsmusic-crm-production.up.railway.app`
- Calendar: Radicale CalDAV on Railway, currently `https://marcsmusic-calendar-production.up.railway.app`
- Public site: `https://www.marcsmusic.nl`
- Payments: Mollie

The frontend never talks directly to EspoCRM, CalDAV or Mollie. All credentials stay server-side.

## Required environment variables

Set the values from `.env.example` as Railway service variables. Do not commit real secrets.

Important production values:

- `APP_BASE_URL=https://www.marcsmusic.nl`
- `ESPOCRM_BASE_URL`
- `ESPOCRM_API_KEY`
- `NEWSLETTER_FROM_EMAIL=noreply@marcsmusic.nl`
- `CALDAV_BASE_URL`
- `CALDAV_USERNAME`
- `CALDAV_PASSWORD`
- `CALDAV_CALENDAR_PATH`
- `MOLLIE_API_KEY`
- `MOLLIE_PROFILE_ID`
- `MOLLIE_MODE` (`test` or `live`, matching the API key)
- `ADMIN_TOKEN` (32–512 random bytes, no whitespace)
- `PRIVACY_HASH_SALT`
- `DATABASE_URL` (recommended for production and required for multiple replicas)

`TRUSTED_PROXY_CIDRS` is empty by default, so client-supplied `X-Real-IP`,
`CF-Connecting-IP` and `X-Forwarded-For` values cannot rotate rate-limit
buckets. Set it only to staged and attested IP/CIDR ranges of the reverse proxy
that sanitizes those headers. `X-Real-IP` has precedence for Railway; an
ambiguous highest-priority value falls back to the socket peer instead of a
weaker header. On Railway with no attested range, requests share a bounded
300/minute peer bucket and remain subject to the independent 1,000/minute
global cap. This preserves a fail-safe capacity floor without trusting an
unverified network range.

The EPK is intentionally disabled when its manifest is absent. See [the public EPK contract and activation runbook](docs/epk.md) for its Railway variables, atomic builder and the release-activation blocker.

## EspoCRM setup

1. Deploy EspoCRM on Railway using `deploy/espocrm/`.
2. Use a new, empty MySQL schema for a fresh build; never point a fresh
   install at a non-empty EspoCRM schema with missing persistent config.
3. Set the EspoCRM admin and database credentials as Railway variables.
4. Create a dedicated API User in EspoCRM or via the admin API.
5. Give the API User only the permissions required by the integration:
   - `Contact`
   - `TargetList` if you want CRM mailing-list linking
   - custom entity `DJBooking`
6. Set `ESPOCRM_API_KEY` in every consuming Railway service.
7. Create custom entity `DJBooking` with fields matching:
   - `bookingId`
   - `contactId`
   - `customerName`
   - `customerEmail`
   - `customerPhone`
   - `eventType`
   - `eventDate`
   - `startUtc`
   - `endUtc`
   - `durationMinutes`
   - `location`
   - `message`
   - `priceCents`
   - `currency`
   - `status`
   - `molliePaymentId`
   - `molliePaymentStatus`
   - `caldavEventUid`
   - `calendarUrl`
   - `source`

Optional newsletter custom fields on Contact:

- `newsletterOptIn`
- `consentAt`
- `consentSource`
- `source`

Set `ESPOCRM_USE_CUSTOM_FIELDS=true` only after those fields exist.

### Historical Mailgun list import

The one-time `scripts/import-mailgun-list-to-espocrm.mjs` command accepts only
the verified Mailgun EU API and imports members into `MediaContact` quarantine.
It performs a count-reconciled GET-only source read, deduplicates by a
deterministic email fingerprint, preserves Mailgun unsubscribe state, and
never treats list membership as consent. Dry-run is the default:

```text
railway run --service marcsmusic-release-os --environment production -- \
  npm run crm:import-mailgun-list -- \
  --list-address radio-stations@mg.marcsmusic.nl \
  --outlet-id <approved-unverified-outlet-id>
```

Applying requires the explicit confirmation flag documented in the script.
All imported contacts remain `Needs Validation` and `doNotContact=true`; no
outreach send is enabled by this import. Do not export member addresses,
names or Mailgun `vars` to Git, logs or unencrypted local files.

## Live crawl of all DJ/media sources

The production source crawler is defined in
[`deploy/dj-source-crawler`](deploy/dj-source-crawler). Its registry contains
all 27 public sources. Railway runs it as a bounded `*/30 * * * *` cron job;
each run honours `robots.txt`, uses HTTPS only, rejects private DNS targets,
limits redirects/bytes/pages, and applies a per-host delay.

The crawler never sends email. It stores only aggregate run information in
logs. A contact is emitted only when a public page explicitly labels the
address for music submissions, promotion, or press; that live page evidence
is marked as source-verified. Generic, booking, management, unlabelled and
denied addresses remain held. The signed artifact is sent to the outreach
worker, which calls Mailgun validation; only exact `Valid` results can pass
outreach eligibility. Locale, outlet, release and suppression gates still
apply before any send.

For deployment variables and the rollback procedure, see
[`deploy/dj-source-crawler/README.md`](deploy/dj-source-crawler/README.md).

## Film director outreach search cron

Run the film director outreach search/import as a separate Railway cron service, not inside the website service.

1. Create a new Railway service from this same repository.
2. Set the service start command to:
   ```text
   npm run search:film-directors
   ```
3. In the Railway service settings, set Cron Schedule to:
   ```text
   */5 * * * *
   ```
4. Set Restart Policy to `Always`.
5. Add the same CRM variables used by the website service:
   ```text
   ESPOCRM_BASE_URL=https://marcsmusic-crm-production.up.railway.app
   ESPOCRM_API_KEY=...
   ESPOCRM_IMPORT_ENTITY=Contact
   FILM_DIRECTOR_LEADS_CSV=data/film-director-leads-2026-07-06.csv
   FILM_DIRECTOR_DISCOVERY_ENABLED=true
   FILM_DIRECTOR_SOURCE_CONFIG=data/film-director-discovery-sources.json
   FILM_DIRECTOR_COUNTRY_SHARDS=data/film-director-country-shards.json
   FILM_DIRECTOR_MAX_SOURCE_ITEMS=12
   FILM_DIRECTOR_SHARDS_PER_RUN=8
   FILM_DIRECTOR_SEARCH_TEMPLATES_PER_SHARD=2
   FILM_DIRECTOR_SEARCH_ITEMS_PER_QUERY=2
   FILM_DIRECTOR_SEARCH_MAX_PAGE_FETCHES=32
   FILM_DIRECTOR_MIN_CONFIDENCE=6
   FILM_DIRECTOR_FETCH_TIMEOUT_MS=15000
   FILM_DIRECTOR_FETCH_MAX_BYTES=2097152
   FILM_DIRECTOR_SEARCH_OUTPUT_CSV=/tmp/marcsmusic-film-director/combined-leads.csv
   FILM_DIRECTOR_RETAIN_DISCOVERY_OUTPUT=false
   SEARCH_ACTION_LOCK_TTL_MS=600000
   ```

For a dedicated cron service, the equivalent deploy config is:

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "deploy": {
    "startCommand": "npm run search:film-directors",
    "cronSchedule": "*/5 * * * *",
    "restartPolicyType": "ALWAYS"
  }
}
```

This config is committed at `deploy/film-director-search/railway.json`. In the Railway cron service, set the config file path to `/deploy/film-director-search/railway.json`. Do not put these cron settings in the existing website service `railway.json`; that file must keep running `npm start`.

Railway cron schedules are UTC and the shortest supported interval is 5 minutes. Each cron run should finish and exit; if a previous run is still active, Railway skips the next scheduled run. The local script also uses a lock so local/manual runs do not overlap. See the Railway cron documentation at `https://docs.railway.com/cron-jobs`.

The cron run now has two stages:

1. Discover new public film-director leads from configured public sources.
2. Import the seed leads plus discovered leads into EspoCRM with upsert-by-name behavior.

Discovery sources are configured in `data/film-director-discovery-sources.json`. `Short of the Week RSS` is enabled by default because its public pages expose film title, filmmaker, genre, country and project website metadata. `Shortverse New Films Feed` is present but disabled by default because the raw feed is noisier and needs stricter review before enabling.

Discovery accepts only credential-free public HTTPS URLs. DNS results and every
redirect are checked against loopback, private, link-local and reserved address
ranges, and the validated address is pinned for the connection. Fetch duration,
redirect count and response size are bounded. Runtime CSV files are written
atomically as mode `0600` inside a mode `0700` directory and are deleted after
import unless `FILM_DIRECTOR_RETAIN_DISCOVERY_OUTPUT=true` is explicitly set.
Dry-run and failure logs contain counts and reason codes, never lead names,
contact URLs or upstream response bodies.

Country shards are configured in `data/film-director-country-shards.json`. The cron rotates through the country list instead of querying the whole world in one run. With `FILM_DIRECTOR_SHARDS_PER_RUN=8`, the 197-country shard list cycles roughly every two hours while each 5-minute run stays bounded.

Validate the task without writing to EspoCRM:

```text
npm run search:film-directors -- --dry-run
```

Validate discovery only:

```text
npm run search:discover-film-directors -- --dry-run
```

## Newsletter sender

Newsletter subscriptions are stored with this sender identity:

```text
NEWSLETTER_FROM_EMAIL=noreply@marcsmusic.nl
NEWSLETTER_FROM_NAME=MarcsMusic
```

Transactionele e-mail uses Plunk as the application provider and MXRoute as
the SMTP relay; it remains from `noreply@marcsmusic.nl`. Outreach is sent from
`marc@marcsmusic.nl` through the explicit Plunk sender allowlist. Verify
SPF/DKIM/DMARC for `marcsmusic.nl` before enabling a controlled campaign. See
[`services/release-os/docs/plunk.md`](services/release-os/docs/plunk.md).
Voor Railway/DNS-rollout en secretrotatie: [`docs/plunk-mxroute-runbook.md`](docs/plunk-mxroute-runbook.md).

## Radicale CalDAV setup on Railway

Use `deploy/radicale/` as the Railway service source.

Recommended subdomain:

```text
https://calendar.marcsmusic.nl
```

Example calendar path:

```text
/marcsmusic/bookings/
```

Set:

```text
CALDAV_BASE_URL=https://marcsmusic-calendar-production.up.railway.app
CALDAV_USERNAME=marcsmusic
CALDAV_PASSWORD=...
CALDAV_CALENDAR_PATH=/marcsmusic/bookings/
CALDAV_HTTP_TIMEOUT_MS=5000
CALDAV_RESPONSE_MAX_BYTES=1048576
CALENDAR_FULFILLMENT_LEASE_MS=30000
```

## iPhone Calendar connection

1. Open Settings.
2. Go to Calendar > Accounts > Add Account > Other.
3. Choose Add CalDAV Account.
4. Server: `calendar.marcsmusic.nl`
5. Username/password: the Radicale user.
6. Save and enable Calendar.

## Android Calendar connection

Use DAVx5:

1. Install DAVx5.
2. Add account with URL and username.
3. URL: `https://calendar.marcsmusic.nl`
4. Enable the MarcsMusic bookings calendar.
5. Open your Android calendar app and enable that calendar.

## Mollie setup

1. Create or open the Mollie website profile for MarcsMusic.
2. Use a test API key first, then replace it with the live key.
3. Set `MOLLIE_API_KEY`, the matching `MOLLIE_PROFILE_ID`, and `MOLLIE_MODE`
   (`test` or `live`) server-side only. Keep `MOLLIE_API_BASE_URL` on
   `https://api.mollie.com` outside tests.
4. The app sends Mollie this webhook URL per payment:
   - `https://www.marcsmusic.nl/api/webhooks/mollie`

Mollie webhooks are not trusted blindly. Before making any provider request, the
backend requires the strict payment ID to be uniquely and durably bound to both
one local booking and one payment-ledger entry. It then validates the returned
ID, booking metadata, exact EUR amount, profile and test/live mode. Provider,
CRM and CalDAV calls have bounded deadlines, response sizes, and no redirects.
`CALENDAR_FULFILLMENT_LEASE_MS` must exceed the combined CRM and CalDAV
deadlines by at least one second; startup fails closed on an unsafe lease.

Payment-ledger rows created before this integrity contract may lack stored
currency, profile, or mode evidence. Such pending payments intentionally fail
closed and must be reconciled manually against Mollie before their ledger data
is repaired; do not bulk-backfill identity fields without provider evidence.

## Booking flow

1. Visitor books at `/booking`.
2. Backend checks CalDAV availability.
3. Backend creates a pending booking in the Railway data store.
4. Backend creates or updates EspoCRM Contact.
5. Backend creates EspoCRM `DJBooking`.
6. Backend creates Mollie payment.
7. Mollie webhook is verified server-side.
8. Only when a fully validated Mollie payment says `paid`, a durable fenced
   claim creates the deterministic CalDAV event. Concurrent or replayed
   webhooks cannot issue competing PUTs; ambiguous timeouts, crashes and `412`
   responses are reconciled by an exact event-URL GET and UID/booking marker
   verification.
9. CRM booking is updated to `confirmed`.

## Admin

Open:

```text
https://www.marcsmusic.nl/admin
```

Use `ADMIN_TOKEN` in the admin form. Use a random value of at least 32 characters. Admin can view
bookings and request cancellation. Calendar deletion and CRM synchronization are durable jobs; a
failed integration remains visible and is retried instead of being reported as completed.

Assignment administration is available through authenticated API endpoints:

- `GET /api/admin/assignments?source=de-transparante-broker`
- `POST /api/admin/assignments/sync`
- `GET /api/admin/jobs?status=dead`

Both require `Authorization: Bearer <ADMIN_TOKEN>`.

## De Transparante Broker assignment sync

On Railway the sync is enabled automatically unless `TRANSPARANTE_BROKER_SYNC_ENABLED=false`.
It runs once after startup and then every 60 minutes by default. The importer reads every public
source page, upserts by the stable external assignment ID, and marks disappeared assignments
inactive only after a complete import.

Configuration:

```text
TRANSPARANTE_BROKER_SYNC_ENABLED=true
TRANSPARANTE_BROKER_SYNC_INTERVAL_MINUTES=60
TRANSPARANTE_BROKER_BASE_URL=https://www.detransparantebroker.nl
```

## Railway data storage

Use Railway Postgres through `DATABASE_URL` in production. The SQL store keeps bookings, payments,
newsletter consent, assignments, durable jobs and audit events in separate indexed records. Booking
overlap checks and state changes run under a cross-process transaction lock, so multiple replicas do
not overwrite each other.

For a single local process, set `BOOKING_SQLITE_PATH`. On first startup the application imports an
existing `BOOKING_DB_PATH` JSON file into the empty SQL database and records the migration. Keep the
JSON file as a rollback backup until booking, payment, newsletter and assignment counts have been
verified; the importer refuses to merge it into a non-empty database.

The browser sends an idempotency key when creating a booking. Mollie receives the booking ID as its
idempotency key. Paid bookings continue to reserve their time while calendar creation is retried,
and cancellations cannot be changed back into confirmed bookings by a replayed webhook.

## Operations

- `/api/health/live` is the process liveness endpoint used by Railway.
- `/api/health` verifies writable storage and reports dead integration jobs.
- Logs are structured JSON and contain a request ID. HTTP responses expose the same ID.
- Integration requests have a deadline and concurrency limit.
- `TRUSTED_PROXY_IPS` must list only direct reverse-proxy addresses before forwarded client IPs are trusted.
- Audit events, completed jobs and inactive assignments use the configurable retention periods in `.env.example`; financial and consent records require an explicit operator-approved retention/deletion process.

Back up Postgres independently of the application and run a restore exercise before production use.
Alert on a non-200 `/api/health`, dead jobs, `calendar_failed`, `manual_review`, `refund_review`, and
the age of the oldest pending job. Reconcile Mollie payments against bookings after an outage.

## Verification

Run `npm test`. The suite covers the public-file boundary, payment replay, cancellation, calendar
failure recovery, recurrence and time zones, concurrent reservations, paginated imports, rate-limit
memory bounds, network deadlines and invalid startup configuration. Run `npm audit` before release.
