# MarcsMusic site, CRM and booking system

This project serves the MarcsMusic site and a server-side booking flow with a self-hosted CRM and CalDAV calendar.

## What is included

- Responsive MarcsMusic onepage site
- Dedicated booking page at `/booking` / `booking.html`
- Server-side EspoCRM integration for contacts, newsletter opt-ins and `DJBooking` records
- Server-side CalDAV integration for availability checks and confirmed calendar events
- Server-side Mollie Payments API integration and webhook verification
- Newsletter endpoint at `/api/newsletter/subscribe`
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
   FILM_DIRECTOR_SEARCH_OUTPUT_CSV=/tmp/marcsmusic-film-director-leads-combined.csv
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

Use `ADMIN_TOKEN` in the admin form. Admin can view bookings and cancel a booking. If a booking has a CalDAV event, cancellation deletes that event.

## Railway data storage

The booking database path is `/data/bookings.json`. Mount a Railway volume at `/data` on the website service. For multiple replicas, high volume, or long-term audit retention, replace the file store with Railway Postgres and enforce the same overlap check inside a database transaction.
