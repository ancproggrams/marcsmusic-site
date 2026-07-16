# Production activation: outreach-worker

This is the production provisioning runbook for the new `outreach-worker` service.
It must be a separate Railway service. Do not replace or redeploy the legacy
`radio-outreach-cron` service.

## Safety invariant

The worker derives `OUTREACH_NEW_CONTACTS_ONLY_FROM` from the current
Europe/Amsterdam business date when the variable is omitted. For this first
activation, set it explicitly to `2026-07-16`. A queued item is rejected before
Plunk I/O when its authoritative discovery evidence predates this date; the
queue timestamp is never used as a substitute.

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
- `PLUNK_BASE_URL`, `PLUNK_SECRET_KEY`, `PLUNK_FROM` and the shared
  `PLUNK_WEBHOOK_SECRET`;
- Mailgun variables only when the explicitly retained legacy inbound/outcome
  reconciliation boundary is enabled; they are never the outbound provider;
- `EMAIL_VALIDATION_PROVIDER_*` for an independent validation service, or the
  approved bounded SMTP/MX mode;
- `OUTREACH_DATA_ENCRYPTION_KEY`, `OUTREACH_HASH_KEY`, unsubscribe keyring and
  `METRICS_TOKEN`;
- `OUTREACH_PUBLIC_BASE_URL` and the approved privacy/observability policy.

The runtime refuses to enable sending when the Plunk secret/fixed sender,
independent email validation or observability policy is absent. The hash
key/epoch must be attested once and must not be changed without the future
re-key migration.

## Activation sequence

1. Deploy with both safety switches disabled.
2. Run `/readyz` and `/capabilities`; require current schema, CRM, matching,
   Plunk, validation and observability capabilities.
3. Confirm the queue contains only contacts created on or after the activation
   date. Cancel or quarantine every older queued item; do not delete audit data.
4. Set `OUTREACH_NEW_CONTACTS_ONLY_FROM` explicitly to today's Amsterdam date.
5. Set `OUTREACH_SEND_ENABLED=true` while keeping the kill switch enabled.
6. Review capabilities again; only then set `OUTREACH_KILL_SWITCH=false`.
7. Monitor the first bounded batch and verify the Plunk provider ID, MXRoute
   acceptance and the configured outcome/webhook path.
8. Re-enable the kill switch immediately on any capability degradation.

No production activation is complete until the service deployment ID, capability
response and first-batch audit report are recorded in the runbook.
