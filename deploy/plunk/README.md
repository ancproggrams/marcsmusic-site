# Self-hosted Plunk/MXRoute deployment

This directory builds the pinned Plunk source together with the reviewed
native MXRoute transport patch. The image is reproducible: the upstream source
is fixed at `8f23d8aac479ae4e7d9926965f090c75afd3f6d5` and the patch is applied
inside the Docker build before compilation.

The outbound topology is:

```text
MarcsMusic application -> Plunk API -> Plunk worker -> MXRoute SMTP
                       tuesday.mxrouting.net:587 / STARTTLS
```

The patch removes the live SES sender from the API runtime and adds a bounded
SMTP transport. Production requires explicit STARTTLS on port 587, certificate
verification, authenticated MXRoute delivery, a fixed
`noreply@marcsmusic.nl` sender, idempotency handling and an uncertain-delivery
state when the connection is lost after `DATA`. No AWS SES credentials are
accepted or required.

## Railway services

Use three separate services, all built from this directory. The API and worker
must use their service-specific Railway manifests:

| Service | `SERVICE` | Responsibility |
| --- | --- | --- |
| `plunk-api` | `api` | HTTPS API and health endpoint |
| `plunk-worker` | `worker` | BullMQ email/background workers |
| `plunk-migrate` | `migrate` | The single migration owner; run once per release |

Deploy `plunk-api` with `railway.json` (it exposes `/health`) and deploy
`plunk-worker` with `railway-worker.json` (no HTTP healthcheck; it is a queue
worker). Applying the API manifest to the worker causes a false healthcheck
failure after the container has started.

The API and worker use the same Postgres and Redis instances. Only
`plunk-migrate` runs `yarn workspace @plunk/db migrate:prod`; never add the
migration command to multiple long-running services.

## Required Railway variables

Set values only in Railway Variables. Do not put credentials in Git, Docker
arguments, shell history, logs or fixtures.

```text
NODE_ENV=production
JWT_SECRET=<unique Railway secret>
API_URI=https://<plunk-public-origin>
DASHBOARD_URI=https://<plunk-public-origin>
LANDING_URI=https://<plunk-public-origin>
WIKI_URI=https://<plunk-public-origin>
DATABASE_URL=${{Postgres-tGG2.DATABASE_URL}}
DIRECT_DATABASE_URL=${{Postgres-tGG2.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}

SMTP_HOST=tuesday.mxrouting.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<MXRoute username>
SMTP_PASSWORD=<Railway secret>
SMTP_TIMEOUT_MS=15000
SMTP_FROM_ADDRESS=noreply@marcsmusic.nl
SMTP_FROM_NAME=MarcsMusic
SMTP_ALLOWED_FROM_ADDRESS=noreply@marcsmusic.nl
SMTP_ALLOWED_FROM_DOMAIN=marcsmusic.nl
```

`SMTP_SECURE=false` is intentional: on port 587 the transport upgrades the
connection with explicit STARTTLS. It is not a plaintext fallback. Keep
`SMTP_PASSWORD` as a Railway secret and rotate it independently from Plunk
API or webhook secrets.

The current MarcsMusic production project uses the Railway service names
`Postgres-tGG2` and `Redis`; keep the references aligned if those services are
renamed during a controlled migration.

## Build and rollout

1. Deploy `plunk-migrate` and wait for a successful, one-shot migration.
2. Deploy `plunk-api`; verify `/health` returns HTTP 200 and inspect the image
   metadata for the Dockerfile, pinned upstream ref and patch build.
3. Deploy `plunk-worker`; verify that all workers start and that the bounded
   SMTP rate/concurrency is present in logs without credentials.
4. Create the first Plunk project/API secret through the protected dashboard
   bootstrap. Put that secret in the application Railway services as
   `PLUNK_SECRET_KEY`; never invent a key or place it in source control.
5. Keep application and send gates disabled until a controlled test proves
   Plunk acceptance, MXRoute delivery and SPF/DKIM/DMARC alignment. A Plunk
   `SENT` row proves the relay returned SMTP `250` after `DATA`; verify inbox
   placement and authentication headers separately.

Before enabling any dispatcher, inspect pending, failed and
`reconcile_required` records. Old pending records must not be released merely
because the provider was changed.

## Cloudflare

Point a dedicated public Plunk origin to the Railway service and keep all
mail-related DNS records DNS-only. In the current zone
`mail.marcsmusic.nl` already points to MXRoute and must not be repointed; use
the Railway origin or a new, non-conflicting subdomain after the required
Cloudflare CNAME is approved. Preserve the existing MXRoute MX records.
Maintain exactly one SPF record, use the DKIM selector that actually signs the
message (MXRoute for this topology), and start DMARC at `p=none` with a valid
reporting address. Verify every change with public DNS lookups; never add a
fictitious Plunk SES/DKIM record.

## Rollback

Disable `PLUNK_SEND_ENABLED`, `OUTREACH_SEND_ENABLED` and the kill switch before
changing provider identity. Do not retry a timeout after SMTP `DATA` blindly;
reconcile the deterministic message ID first. Roll back the API and worker to
the previous image only after the queue and uncertain-delivery records have
been reviewed.
