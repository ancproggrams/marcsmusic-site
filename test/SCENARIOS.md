# MarcsMusic Scenario Suite

## Evaluation Method

All scenarios use the same pass/fail method. A scenario passes only when every success criterion below is satisfied by automated checks in `test/scenario-suite.test.js`.

Every scenario runs under the same harness conditions:

- Node starts `server.js` as a real HTTP process.
- EspoCRM, Mollie, and CalDAV are local HTTP stubs.
- The booking database is an isolated temporary JSON file.
- Booking time zone is `UTC`, workday is `10:00-18:00`, slot step is 60 minutes, and booking buffer is 0 minutes.
- No production credentials, production CRM, production calendar, or live Mollie API are used.

Each run writes outcome evidence to `test/scenario-evidence.json`. The file is generated locally and intentionally not tracked.

## Scenarios

### S1 - Public Site And Operational Readiness

Major capabilities covered: static serving, route aliases, health checks, public booking config.

Success criteria:

- `GET /` returns HTML containing the MarcsMusic page.
- `GET /booking` returns the booking page through the route alias.
- `GET /api/health` returns `status: ok`.
- `GET /api/booking/config` reports calendar, CRM, and Mollie readiness as true.
- Public booking config includes the expected booking type and pricing data.

### S2 - Availability Excludes Busy Calendar And Local Holds

Major capabilities covered: CalDAV availability, local pending holds, slot generation.

Success criteria:

- Availability request succeeds for a valid future date and booking type.
- CalDAV is queried and reported as connected.
- A slot blocked by a CalDAV busy event is absent.
- A slot blocked by a local pending booking hold is absent.
- At least one other valid slot remains available.

### S3 - Booking Creation Produces CRM Record And Mollie Checkout

Major capabilities covered: customer validation, atomic file persistence, CRM contact/booking sync, Mollie payment creation.

Success criteria:

- Booking creation returns `201` with `pending_payment`.
- Response includes a Mollie checkout URL from the local payment stub.
- Database contains the booking and payment record.
- CRM receives contact and booking record requests.
- Mollie receives a payment creation request with booking metadata.

### S4 - Paid Webhook Confirms Booking And Creates Calendar Event

Major capabilities covered: webhook verification-by-fetch, payment state update, confirmation workflow, CalDAV event creation, CRM status sync.

Success criteria:

- A paid Mollie webhook returns `200`.
- The booking moves from `pending_payment` to `confirmed`.
- The payment record is updated to `paid`.
- CalDAV receives an event `PUT`.
- CRM receives status updates for payment and calendar confirmation.

### S5 - Newsletter And Admin Cancellation Workflow

Major capabilities covered: newsletter capture, CRM newsletter sync, admin authorization, admin listing, cancellation, CalDAV deletion.

Success criteria:

- Newsletter subscription succeeds and is persisted.
- Consent IP is hashed, not stored as the raw forwarded IP.
- Admin list rejects missing credentials.
- Admin list succeeds with the bearer token.
- Admin cancellation marks the booking cancelled and sends a CalDAV `DELETE`.
