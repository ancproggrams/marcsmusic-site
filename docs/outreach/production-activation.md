# Production activation: outreach-worker

This is the production provisioning runbook for the new `outreach-worker` service.
It must be a separate Railway service. Do not replace or redeploy the legacy
`radio-outreach-cron` service.

## Safety invariant

The worker derives `OUTREACH_NEW_CONTACTS_ONLY_FROM` from the current
Europe/Amsterdam business date when the variable is omitted. For the first
activation, set it explicitly to the business date shown by `date` at the
change window (for example `2026-07-15`). A queued item is rejected before
Mailgun I/O when its canonical contact `createdAt` predates this date.

Keep both switches disabled until every capability check is green:

```text
OUTREACH_KILL_SWITCH=true
OUTREACH_SEND_ENABLED=false
```

## Railway service

Create a new service named `outreach-worker` in the existing `marcsmusic-site`
project, production environment. Deploy this directory as the service root:

```text
services/outreach-worker
```

The committed `railway.json` runs migrations before startup and exposes
`/readyz`. Do not connect the service to the legacy cron source.

## Required production inputs

Set these as Railway secrets or service references; never commit values:

- dedicated PostgreSQL `DATABASE_URL` for outreach state;
- `ESPOCRM_BASE_URL` and a least-privilege `ESPOCRM_API_KEY`;
- `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_FROM`, `MAILGUN_REPLY_TO`;
- `MAILGUN_WEBHOOK_SIGNING_KEY` and an archived inbound-route evidence reference;
- `EMAIL_VALIDATION_PROVIDER_*` for an independent validation service, or the
  approved bounded SMTP/MX mode;
- `OUTREACH_DATA_ENCRYPTION_KEY`, `OUTREACH_HASH_KEY`, unsubscribe keyring and
  `METRICS_TOKEN`;
- `OUTREACH_PUBLIC_BASE_URL` and the approved privacy/observability policy.

The runtime refuses to enable sending when inbound evidence or independent
email validation is absent. The hash key/epoch must be attested once and must
not be changed without the future re-key migration.

## Activation sequence

1. Deploy with both safety switches disabled.
2. Run `/readyz` and `/capabilities`; require current schema, CRM, matching,
   Mailgun, inbound route, validation and observability capabilities.
3. Confirm the queue contains only contacts created on or after the activation
   date. Cancel or quarantine every older queued item; do not delete audit data.
4. Set `OUTREACH_NEW_CONTACTS_ONLY_FROM` explicitly to today's Amsterdam date.
5. Set `OUTREACH_SEND_ENABLED=true` while keeping the kill switch enabled.
6. Review capabilities again; only then set `OUTREACH_KILL_SWITCH=false`.
7. Monitor the first bounded batch and verify Mailgun logs and inbound replies.
8. Re-enable the kill switch immediately on any capability degradation.

No production activation is complete until the service deployment ID, capability
response and first-batch audit report are recorded in the runbook.
