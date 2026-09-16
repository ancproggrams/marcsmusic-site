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
- `ADMIN_TOKEN`
- `PRIVACY_HASH_SALT`
- `DATABASE_URL` (recommended for production and required for multiple replicas)

## EspoCRM setup

1. Deploy EspoCRM on Railway using `deploy/espocrm/`.
2. Use the Railway MySQL service as the database.
3. Set the EspoCRM admin and database credentials as Railway variables.
4. Create an API User in EspoCRM or via the admin API.
5. Give the API User permissions for:
   - `Contact`
   - `TargetList` if you want CRM mailing-list linking
   - custom entity `DJBooking`
6. Set `ESPOCRM_API_KEY` in Railway.
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

## Newsletter sender

Newsletter subscriptions are stored with this sender identity:

```text
NEWSLETTER_FROM_EMAIL=noreply@marcsmusic.nl
NEWSLETTER_FROM_NAME=MarcsMusic
```

Make sure `noreply@marcsmusic.nl` exists in your mail provider and that SPF/DKIM/DMARC are configured for `marcsmusic.nl` before sending campaigns.

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
3. Set `MOLLIE_API_KEY` server-side only.
4. The app sends Mollie this webhook URL per payment:
   - `https://www.marcsmusic.nl/api/webhooks/mollie`

Mollie webhooks are not trusted blindly. The backend receives the payment id and fetches the payment status from Mollie before confirming the booking.

## Booking flow

1. Visitor books at `/booking`.
2. Backend checks CalDAV availability.
3. Backend creates a pending booking in the Railway data store.
4. Backend creates or updates EspoCRM Contact.
5. Backend creates EspoCRM `DJBooking`.
6. Backend creates Mollie payment.
7. Mollie webhook is verified server-side.
8. Only when Mollie says `paid`, backend creates CalDAV event.
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
