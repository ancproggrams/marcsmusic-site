# Outreach worker — Railway production runbook

| Attribute | Value |
| --- | --- |
| Owner | MarcsMusic Engineering; privacy owner and campaign owner are separate approvers |
| Operational tier | Tier 1 safety-controlled external messaging |
| Service | Dedicated Railway outreach API/worker and dedicated PostgreSQL |
| Version | Versioned with the deployed `main` commit and EspoCRM extension manifest |
| Default safety state | `OUTREACH_KILL_SWITCH=true`, `OUTREACH_SEND_ENABLED=false` |

This runbook covers deployment, canary, incident response, recovery and rollback. Never paste output from `railway variable list --kv` or `--json` into chat, tickets or logs; those formats include raw secret values.

The semantic single-page operator view is [runbook.html](runbook.html).

## Current verified baseline — 15 July 2026

- The isolated restored Railway staging EspoCRM database contains 141 tables and 2,815 legacy `Lead` rows.
- The hardened EspoCRM runtime requires its Railway volume mounted exactly at `/var/www/persistent`.
- Production sending remains fail-closed: `OUTREACH_KILL_SWITCH=true` and `OUTREACH_SEND_ENABLED=false`.
- These observations are release inputs, not proof that the release is production-ready. A completed security scan, restored-state E2E, provider/webhook contract checks and a timed restore remain hard no-go gates.
- RPO <= 15 minutes and RTO <= 4 hours are provisional objectives until a timed isolated restore proves them.

This repository implements ISO/NIS2-oriented controls and evidence boundaries; it does not claim certification or legal compliance.

Signing-key changes follow the separate [key-rotation and rollback runbook](key-rotation.md). Consumer-first source rotation, unsubscribe overlap, bounded key IDs, explicit legacy cutoff, and secret-free evidence are release gates; direct one-value replacement is not an approved rotation.

## Dependencies

- Railway runtime, private network and deployment history.
- Dedicated PostgreSQL with `pgcrypto`, backups and a tested restore path.
- EspoCRM 10 with the MarcsMusic Outreach extension, least-privilege API user and signed webhooks.
- Plunk API and dedicated Plunk worker, with MXRoute SMTP relay on
  `tuesday.mxrouting.net:587` using authenticated STARTTLS. Transactional
  mail uses `noreply@marcsmusic.nl`; outreach uses `marc@marcsmusic.nl`.
- A separately approved legacy inbound/outcome boundary, if still enabled;
  Mailgun is not the outbound provider.
- Public TLS route for webhooks and unsubscribe confirmation.
- DNS, SPF, DKIM and DMARC managed outside the worker.

Loss of PostgreSQL makes the service not ready. Loss of EspoCRM or Plunk pauses
processing through retry/backoff; it must never bypass evidence or resend an
uncertain provider request.

## Release gates

All boxes require named evidence in the change record:

- [ ] Pull request reviewed; `npm run verify` passes on the exact commit.
- [ ] Formal security scan completed on the exact release candidate; critical/high findings are remediated or explicitly accepted by the authorized risk owner.
- [ ] Dependency/SBOM evidence and deployment provenance are retained.
- [ ] EspoCRM extension and worker field/status contract test passes.
- [ ] A current production EspoCRM database backup and complete `/var/www/persistent` application state have been restored into isolated staging; the current 141-table and 2,815-Lead baselines, version and schema integrity reconcile.
- [ ] Restored-state E2E passes extension install, daemon, queue, webhook, suppression, `delivery_unknown`, reconciliation, restore and rollback paths.
- [ ] Staging uses dedicated PostgreSQL, isolated provider credentials and allowlisted non-production recipients. It cannot route mail to production recipients.
- [ ] PostgreSQL and EspoCRM backups exist; a restore drill on the exact release candidate is successful and evidence is current.
- [ ] EspoCRM `/var/www/persistent/{data,custom,client-custom}` trees are durable and mapped to the runtime paths; stable cryptographic/configuration secrets are preserved and recoverable without logging them.
- [ ] Schema migration is additive and compatible with both old and new application versions.
- [ ] Least-privilege EspoCRM API role and Railway access review are approved.
- [ ] Webhook secrets are independently generated; signature and replay tests pass.
- [ ] Privacy owner approved purpose, lawful basis, evidence standard, retention and rights process.
- [ ] `legacy-leads-v2` dry-run has balanced reconciliation, stable `(modifiedAt,id)` ordering, matching source/report digests and explicit digest-bound approvals; no `Unknown`/ambiguous row is sendable.
- [ ] Old outreach cron/send path is disabled before the new path is enabled.
- [ ] Production initially has kill switch on and send enabled false. Circuit state is recorded and reviewed; neither a closed circuit nor a passing health check overrides the two deployment controls.
- [ ] Canary list contains only deliberately approved, validated contacts.

Any failed or undocumented gate is a no-go.

### EspoCRM worker API role — required grant/deny matrix

This matrix is the maximum runtime role, not evidence that the role is configured. `read all` is required because matching, reconciliation and the bounded daily aggregate operate across record ownership. Espo team/ownership filters must not silently turn a complete scan into a partial one.

| Scope | Read | Create | Edit / relate | Delete | Required limitation |
| --- | --- | --- | --- | --- | --- |
| MusicRelease | all | yes | yes | deny | no status bypass; server EPK/OCC hook remains authoritative |
| MediaOutlet | all | yes | yes | deny | no bulk delete/import administration |
| MediaContact | all | yes | yes | deny | personal-data access is service-only and logged |
| OutreachMatch | all | yes | yes | deny | transition hook must reject direct state bypass |
| OutreachEvent | dedicated outreach team | yes | deny | deny | append-only hook and link immutability |
| OutreachSuppression | dedicated outreach team | yes | yes | deny | deny-wins hook; deactivation forbidden |
| OutreachDailyReport | all | yes | yes | deny | one date-keyed report; aggregate route also requires read-all contact/match/report scopes |
| Campaign | dedicated outreach team | yes | yes | deny | only managed grouping projection; no Mass Email permission |
| TargetList | dedicated outreach team | yes | only reviewed membership relations | deny | reporting membership never authorizes transport |
| Opportunity | dedicated outreach team | yes | yes | deny | managed interest projection; financial fields require human confirmation |
| Email | dedicated outreach team | only managed receipt creation | deny | deny | receipt status is already `Sent`; API identity has no transport capability |
| Lead and CampaignLogRecord | deny at runtime | deny | deny | deny | use a separate expiring read-only migration identity |
| User, Role, API key, Entity Manager, Extension, EmailAccount, InboundEmail/Group Email Account, MassEmail and every unlisted scope | deny | deny | deny | deny | no administration, credential management or alternative sender |

The API user must be type `api`, non-admin, owned by a named service owner, restricted to this role and assigned to a dedicated default outreach team shared only with approved replacement/migration identities. Managed projections must inherit that team. The identity has no personal SMTP identity, group SMTP identity, outbound-email permission or Mass Email capability. Its key is independent from webhook/provider keys and has a recorded rotation/revocation owner.

### Staging proof for the API role

Run this only in isolated staging with both outreach send switches disabled, a provider stub or isolated non-production domain, and a hard recipient sink. Store sanitized response status/reason, provider-stub request count, role-export digest, API-user ID, image/extension/commit digests and approver IDs; never store credentials or record payloads.

1. Export the effective Espo role through the controlled administrator workflow. Compare every scope/action to the matrix above and SHA-256 the sanitized export.
2. Authenticate as the dedicated API user and call `GET /api/v1/App/user`; assert the expected non-admin API-user ID. Do not print the authorization header.
3. Perform bounded `maxSize=1` reads for every allowed read-all scope and the daily aggregate; assert success and prove records owned by a different test user are visible.
4. Perform non-mutating list calls to `MassEmail`, `EmailAccount`, `InboundEmail`, `User`, `Role` and extension/entity administration endpoints; assert `403`, not an empty-but-authorized result.
5. On disposable fixtures, create one fully managed Email receipt with status `Sent`; assert `200`, immutable readback and zero provider-stub requests.
6. Attempt a standard Email with status `Sending` to the approved non-production sink; require `403` and zero provider-stub requests. Any other status, provider request or queued mail is a P0 failure.
7. Attempt delete and immutable-field/state-bypass operations on disposable managed records; require explicit `403` denial and prove the exact identity, OCC version and audit metadata are unchanged in both API readback and database state. Then remove the entire isolated environment through the approved cleanup procedure.
8. Revoke the API key, prove the next harmless read is unauthorized, issue the replacement through secret custody and repeat the identity plus negative-send checks.

There is no safe repository-only substitute for steps 1, 5, 6 and 8. Until their exact-deployment evidence is approved, R50 remains an external P0 gate and production sending remains disabled.

## Required environment promotion model

Production is never the first extension-install or restored-state test. Use this promotion path:

```text
reviewed main commit
  -> isolated Railway staging
  -> restored production-like EspoCRM database and persistent state
  -> extension install/rebuild + worker migrations with sending disabled
  -> contract, reconciliation, failure and restore checks
  -> production cutover with fresh backups and sending disabled
  -> separately approved five-recipient outreach canary
```

Staging must use the same EspoCRM version and extension artifact intended for production. Pin container versions by immutable digest in the release record when the platform supports it. A production upgrade and a new extension install are separate risk changes; rehearse them separately unless an approved change explicitly combines them.

### Restored-DB staging rehearsal

1. Create/select an isolated Railway staging environment. Give EspoCRM, its pinned MySQL 9.4 database and the worker PostgreSQL dedicated services/volumes; do not reference production databases over the private network.
2. Keep `OUTREACH_KILL_SWITCH=true` and `OUTREACH_SEND_ENABLED=false`. Use a non-production Mailgun domain or a provider stub plus a hard recipient allowlist outside this repository.
3. Take a consistent production EspoCRM database backup and application-state backup (the complete `/var/www/persistent` recovery set, uploads where separately configured, and active configuration/key-version metadata). Transfer them through the approved encrypted backup channel, not shell output or Git.
4. Restore into staging. Preserve the stable EspoCRM password salt, crypt key, hash secret and other active API/signing keys through the secret store; do not generate new values over encrypted fields from the restored database.
5. Start one EspoCRM web replica and one daemon. The extension install/schema rebuild must hold the MySQL advisory lock. Verify `/readyz.php` proves the expected extension entities/tables, then test the daemon, webhook queue and inbound mailbox jobs.
6. Deploy the worker, run additive PostgreSQL migrations, then run full reconciliation. Compare the 141-table/2,815-Lead baseline, aggregate entity counts and a privacy-safe sample; exercise duplicate webhooks, suppression, terminal match cancellation, `delivery_unknown`, dead-letter and rollback paths.
7. Re-run the restore from scratch. A staging environment manually repaired into health is not restore evidence.

Record backup IDs, restore timestamps, source/target EspoCRM versions, image digests, extension version, commit, row-count checks, test results and approvers. Do not record secret values or exported personal data.

## Worker deployment procedure

Set the local service selector once. Confirm the linked project and environment before every mutation.

```bash
export RAILWAY_SERVICE="outreach-worker"
export RAILWAY_ENVIRONMENT="staging"
railway status
```

Preferred Git deployment settings:

- branch: `main`;
- root directory: `/services/outreach-worker`;
- config path: `/services/outreach-worker/railway.json`;
- pre-deploy: `npm run db:migrate`;
- health check: `/readyz`;
- restart: on failure, bounded by Railway configuration.

Before uploading or triggering any deployment, enforce the safe state in one variable update:

```bash
railway variable set --service "$RAILWAY_SERVICE" --environment "$RAILWAY_ENVIRONMENT" \
  OUTREACH_KILL_SWITCH=true OUTREACH_SEND_ENABLED=false
```

For a reviewed manual upload from the repository root:

```bash
railway up ./services/outreach-worker --path-as-root \
  --service "$RAILWAY_SERVICE" --environment "$RAILWAY_ENVIRONMENT" --detach
railway deployment list --service "$RAILWAY_SERVICE" --environment "$RAILWAY_ENVIRONMENT" --limit 5
railway logs --service "$RAILWAY_SERVICE" --environment "$RAILWAY_ENVIRONMENT" --latest --lines 100
```

Then verify from an operator workstation:

```bash
curl --fail --silent --show-error "https://OUTREACH_HOST/livez"
curl --fail --silent --show-error "https://OUTREACH_HOST/readyz"
curl --fail --silent --show-error "https://OUTREACH_HOST/capabilities"
```

Expected `/readyz` output includes only `status=ready`, `database=up` and `schema=current`. Confirm `/capabilities` separately reports `sending=disabled` while the kill switch is on, plus Mailgun domain/auth health, inbound-route evidence (`configured` or `unknown`) and email-validation health. A provider failure must degrade `/capabilities` but must not make `/readyz` fail. Do not log the metrics bearer token; fetch `/metrics` from the approved monitoring integration.

The Mailgun capability check is a cached, non-mutating domain `GET`; it does not send mail and does not enumerate or create routes. Keep `MAILGUN_INBOUND_ROUTE_EVIDENCE=unknown` until an operator has completed and archived a live signed inbound-reply test. Only then set it to `configured` with a non-secret evidence reference. For HTTP email validation, configure a dedicated non-mutating health URL returning JSON `{"status":"ok"}`. For `EMAIL_VALIDATION_PROVIDER_TYPE=mailgun`, set a separate `MAILGUN_VALIDATION_API_KEY` with the Mailgun Email Validation permission; do not reuse a sending/webhook-only key. Reuse the cached Mailgun domain GET for control-plane health and never call the billable address-validation endpoint as a health check. Never point the health setting at a billable validation endpoint unless that endpoint explicitly guarantees `GET` is non-mutating.

### One-time validation of historical contacts

The normal full reconcile runs the intake/merge pipeline and intentionally
skips provider calls for denied contacts. When an operator wants to refresh the
technical Mailgun status of the imported quarantine, enqueue this separate,
idempotent work item after checking that no unexpected send work is pending:

```sql
INSERT INTO work_items (kind, entity_type, entity_id, dedupe_key, payload, priority)
VALUES (
  'run_mailgun_validation_reconcile',
  'System',
  'espocrm',
  'mailgun-validation-reconcile:YYYY-MM-DD',
  '{"reason":"operator-approved-mailgun-validation"}'::jsonb,
  55
)
ON CONFLICT (dedupe_key) DO NOTHING;
```

The maintenance item scans only `MediaContact` records and creates bounded
`validate_contact_email` work. The handler updates `emailValidationStatus`
and `lastValidatedAt` only; it never clears `doNotContact`, opt-out,
hard-bounce, consent, purpose, basis, evidence, or campaign safeguards. Do not
clear those fields based solely on a Mailgun `Valid` response. Review the
remaining CRM eligibility evidence before enabling outreach.

## Production cutover

Select production explicitly and have a second operator verify the project, environment and service before mutation:

```bash
export RAILWAY_ENVIRONMENT="production"
railway status
```

1. Reconfirm the legacy sender has no schedule, active deployment or self-loop that can send. Keep it stopped; do not merely assume an old stopped deployment remains stopped.
2. Freeze outreach-related CRM changes for the recorded cutover window. Set both worker controls to their disabled values and verify there are no in-flight provider requests.
3. Take fresh, consistent EspoCRM database/application-state and worker PostgreSQL backups. Record backup IDs and prove they can be selected for restore.
4. Deploy EspoCRM at exactly one replica with its singleton Railway volume and stable configuration secrets. Wait for the guarded extension install/rebuild, `/readyz.php`, daemon health and aggregate reconciliation. Do not scale this volume-bound topology horizontally; that requires a separate reviewed design with externalized shared state and explicit daemon/leader ownership.
5. Deploy the worker commit already proven in staging. Run additive PostgreSQL migrations with sending disabled; verify `/livez`, `/readyz`, protected metrics, signed webhooks and full reconciliation.
6. Run the `legacy-leads-v2` dry run against production and archive the exact approved source/report digests. Apply only through the [legacy migration procedure](legacy-lead-migration.md); its stable cursor, checkpoints and contact-linked historic events do not authorize sending.
7. End the freeze, monitor for one full reconciliation cycle, and leave both send controls disabled until the separate canary approval.

Abort cutover on schema drift, missing persistent state, regenerated keys, readiness failure, row-count mismatch, invalid webhook signatures, dead letters, uncertain delivery or evidence/suppression disagreement. Do not solve a cutover issue by weakening readiness, signature checks or eligibility.

## Dry run and canary

1. Confirm `RAILWAY_ENVIRONMENT=production` and the intended service again; keep both send controls disabled.
2. Install and test EspoCRM webhooks. Confirm valid events are queued once and bad signatures return 401.
3. Run reconciliation. Compare aggregate counts in PostgreSQL/EspoCRM; inspect a sample without exporting PII.
4. Confirm every canary has valid email status, allowed purpose and contact basis, source URL, evidence text, active outlet, email acceptance and an active release with an EPK/private stream.
5. Set temporary caps: global `5`, per-domain `1`, no more than the approved canary population.
6. Enable in one atomic configuration change:

```bash
railway variable set --service "$RAILWAY_SERVICE" --environment "$RAILWAY_ENVIRONMENT" \
  OUTREACH_KILL_SWITCH=false OUTREACH_SEND_ENABLED=true \
  OUTREACH_DAILY_SEND_LIMIT=5 OUTREACH_DOMAIN_DAILY_LIMIT=1
```

1. Observe every canary attempt, provider acceptance/event, EspoCRM event and suppression path. A canary smaller than the configured minimum health sample will not prove automatic circuit behavior; monitor manually.
1. Hold expansion for at least one business-day outcome window. Any duplicate, complaint, unexpected recipient, missing event or uncertain delivery stops the canary.
1. Increase limits only through a reviewed change. Never jump from five to the full legacy population.

## Provisional service objectives

These are launch objectives, not measured achievements or provider guarantees. The service owner must connect the listed metrics to retained monitoring, validate queries with synthetic events and review targets after a 30-day baseline. A safety objective is never traded for availability.

| SLI / objective | Provisional target | Measurement and response |
| --- | --- | --- |
| Unauthorized or duplicate automated recipients | Exactly `0` | Compare provider acceptance, unique queue keys and approved recipient evidence. Any event is SEV-1 and consumes the entire safety budget. |
| Confirmed unsubscribe protection | 100% persisted and pending sequence canceled; 99% within 5 minutes | Synthetic signed opt-out plus queue/CRM projection checks. Any later send is SEV-1. |
| Signed webhook durable acceptance | 99.9% successful valid requests per rolling 30 days | Synthetic valid request and HTTP status; exclude intentionally rejected invalid/replayed requests. |
| Event processing freshness | 99% of accepted events leave pending/processing within 5 minutes | `outreach_oldest_event_seconds`; page at 300 seconds. |
| Work processing freshness | 99% of runnable work leaves pending/processing within 5 minutes | `outreach_oldest_work_seconds`; page when oldest runnable work exceeds 300 seconds. |
| Full reconciliation | Successful once per Europe/Amsterdam day, completed by 07:00 | `outreach_full_reconcile_age_seconds` plus workflow result; page if age exceeds 25 hours. |
| Technical-state readiness | 99.9% monthly, excluding approved maintenance | Synthetic `/readyz`; sending remains disabled during dependency loss. |
| Projection convergence after dependency recovery | 99% within 15 minutes | Compare durable PostgreSQL outcomes with EspoCRM `OutreachEvent`; no resend is used to repair projection. |
| Backup recovery objective | Target RPO <= 15 minutes and RTO <= 4 hours for EspoCRM and PostgreSQL | Only a timed isolated restore proves this. If platform backup settings cannot meet it, document and approve a different business objective before production. |

The automatic health circuit uses the configured minimum sample and thresholds (defaults: 20 sends, harmful rate `5%`, failure rate `20%`). Alerting must use the deployed values, not assume defaults. Opening the circuit blocks sending; closure behavior must match the approved incident policy and be tested explicitly.

## Alerts and first response

| Alert | Severity | Meaning | First response |
| --- | --- | --- | --- |
| Duplicate or unintended recipient | SEV-1 | Idempotency, eligibility or migration safety failed | Disable sending immediately; preserve IDs; start incident. |
| Runaway send rate / cap mismatch | SEV-1 | Capacity control is ineffective or misconfigured | Disable both controls; verify counters and active replicas. |
| Secret/webhook key exposure | SEV-1 | Provider or CRM events may be forged; data access at risk | Disable sending, revoke/rotate affected key, preserve access evidence. |
| Spam complaint or harmful-outcome threshold | SEV-1/2 | Campaign or evidence quality is unsafe | Open circuit/disable sending; suppress affected scope; privacy review. |
| `delivery_unknown` > 0 | SEV-2 | A provider request may have succeeded without response | Never retry; reconcile deterministic ID and Mailgun events. |
| `/readyz` 503 for 5 minutes | SEV-2 | Durable PostgreSQL ingress or its local schema is unavailable | Keep webhooks retrying; inspect DB/network/migration logs. CRM loss is reported by `/capabilities`, not ingress readiness. |
| `/capabilities` reports CRM/matching unavailable | SEV-2/3 | Ingress is durable but downstream processing is degraded | Keep ingress online; keep sending blocked; restore CRM and drain priority lanes. |
| `/capabilities` reports Mailgun auth/domain unavailable | SEV-2 | API key is rejected/revoked, domain is inactive, or the bounded probe cannot establish health | Keep `/readyz` and ingress online; keep sending blocked; verify key scope/domain in secret custody. Never print the credential or raw provider response. |
| `/capabilities` reports inbound route `unknown` | SEV-2 before send enablement | No operator-attested inbound-reply evidence is configured | Keep sending blocked; execute and archive a signed inbound-reply test, then record only its opaque non-secret evidence reference. |
| `/capabilities` reports email validation unavailable/unknown | SEV-2 before new-contact matching | The provider is disabled, its health endpoint failed, or no non-mutating health evidence exists | Keep new contacts at Needs Validation/Unknown; restore or approve the provider without using recipient validation as a health check. |
| Work/send dead letter > 0 | SEV-2 | Bounded retries exhausted | Disable if systemic; classify error; replay only after root cause. |
| Webhook signature rejects spike | SEV-2 | Secret mismatch, replay/attack or provider config error | Do not relax verification; compare webhook ID/key version and clocks. |
| Event backlog age > 5 minutes | SEV-2 | Worker unhealthy or downstream unavailable | Check leases, DB saturation, EspoCRM/Mailgun latency and replica health. |
| EspoCRM projection drift | SEV-2/3 | Durable provider state is not visible to operations | Keep technical events; run idempotent reconciliation after repair. |
| Full reconciliation age > 25 hours | SEV-2 | Webhook omissions may no longer be bounded by daily repair | Disable sending if authoritative freshness is uncertain; run one idempotent full reconciliation. |
| PostgreSQL storage > 80% or connections > 80% of limit | SEV-2 | Queue writes and webhook durability are at risk | Stop sending growth, preserve inbound durability, inspect retention/capacity and scale through reviewed change. |

Dashboard panels should include queue depth/oldest age, status counts, send rate vs caps, retries/dead letters, delivery unknown, webhook accept/reject/duplicate, provider outcomes, bounce/complaint/opt-out rates, circuit state, reconciliation freshness, HTTP latency/errors and PostgreSQL CPU/memory/connections/storage.

## Emergency stop

Do this before diagnosis when external messaging may be unsafe:

```bash
railway variable set --service "$RAILWAY_SERVICE" --environment "$RAILWAY_ENVIRONMENT" \
  OUTREACH_KILL_SWITCH=true OUTREACH_SEND_ENABLED=false
railway logs --service "$RAILWAY_SERVICE" --environment "$RAILWAY_ENVIRONMENT" \
  --since 30m --filter "@level:error OR @level:warn" --lines 200
```

Keep the API and webhook ingestion online if confidentiality and integrity are intact. Durable inbound events help recovery. If credentials are compromised, isolate the public endpoint and rotate keys as part of incident containment.

A correctly signed Mailgun complaint and an EspoCRM `Unauthorized Recipient Confirmed` event open `global-send-circuit` transactionally before the webhook receives `202`. Do not reset that circuit merely because the slower statistical window later looks healthy. An operator must complete incident review and use the explicit reset command.

On Railway termination the worker stops claims immediately, aborts dependency calls and has a hard 25-second budget inside Railway's 30-second window. Safe pre-provider leases return to their queue; an attempt whose provider phase started becomes `delivery_unknown`. If this classification appears during deployment, follow the procedure below before any replay.

## Incident checklist

1. **Contain:** disable both send controls; open the circuit; stop the legacy sender; do not delete queue rows.
2. **Preserve:** record deployment ID, commit, UTC window, correlation/message IDs, counters and relevant redacted logs. Do not export bodies or addresses into the incident channel.
3. **Assess:** recipients affected, duplicate/unauthorized count, provider acceptance vs delivery, suppression/rights impact and whether notification obligations may apply.
4. **Eradicate and recover:** fix root cause with regression test; reconcile uncertain deliveries; restore projections; canary again from five or fewer approved contacts.
5. **Close:** owner approval, post-incident review, risk/control update, retained evidence and tracked corrective actions. Privacy/security owner decides legal or data-subject notifications.

## `delivery_unknown` procedure

1. Leave the row terminal and sending disabled for that match.
2. Search Mailgun using deterministic Message-ID, correlation ID and narrow UTC window.
3. Check signed webhook inbox and provider events for accepted/delivered/failed outcomes.
4. If provider acceptance is proven, reconcile to `sent`; do not send again.
5. If provider non-acceptance is conclusively proven, create a new reviewed attempt through an explicit recovery operation. Never mutate the old attempt history.
6. If still uncertain, keep it uncertain and close the sequence; avoiding a duplicate takes precedence over delivery.

## Application rollback

Rollback starts with the emergency stop. PostgreSQL migrations are forward-only; do not drop columns or tables during an incident.

```bash
railway deployment list --service "$RAILWAY_SERVICE" --environment "$RAILWAY_ENVIRONMENT" --limit 10
```

Railway CLI v5 does not expose a direct rollback command. Use the Railway deployment view to redeploy the last known-good deployment, or revert the bad commit on `main` and deploy that compatible commit. Record the chosen deployment ID in the incident/change record.

After rollback:

- `/livez` and `/readyz` pass with sending disabled;
- old application works against the forward-compatible schema;
- webhook signatures still validate;
- no queued row was duplicated or silently dropped;
- reconciliation succeeds;
- repeat the canary before re-enabling normal limits.

Do not uninstall the EspoCRM extension, drop its tables or restore only one side of the EspoCRM database/application-state pair during incident rollback. The release candidate must use additive, backward-compatible schema so the prior application can run against the forward schema. If a full restore is unavoidable, establish a write cutoff, preserve post-backup inbound/provider events separately, restore into isolation first, reconcile the exact loss window and obtain incident-owner approval before replacing production state.

## Key rotation

1. Disable sending and take backups.
2. Add a new EspoCRM webhook ID/key alongside the old key, deploy, switch sender, verify, then remove old key.
3. Rotate Mailgun API/signing keys at the provider, update Railway secret input without displaying it, redeploy disabled, verify signatures, then revoke old key.
4. Rotating unsubscribe signing invalidates outstanding links unless dual-key verification is implemented; privacy owner must approve the transition.
5. For data-encryption rotation, retain the previous version/key in the decrypt-only `OUTREACH_DATA_DECRYPTION_KEYS_JSON`, set a newly named active `OUTREACH_DATA_KEY_VERSION` and active `OUTREACH_DATA_ENCRYPTION_KEY`, then deploy with both send locks still disabled. A historical map entry may never redefine the active version.
6. Run `npm run crypto:reencrypt -- --batch-size 100 --max-batches 10` first. This is read-only and reports row counts by table/key version without printing key material. Confirm every reported historical version exists in the approved key inventory.
7. Take a new recovery point, then apply only with `OUTREACH_DATA_REENCRYPT_CONFIRM=reviewed-bounded-data-key-rotation npm run crypto:reencrypt -- --apply --batch-size 100 --max-batches 10`. The job uses a singleton advisory lock, `FOR UPDATE SKIP LOCKED`, bounded transactions and compare-by-old-version updates. Re-run until every encrypted table reports only the active version.
8. Verify event, copy and automatic-response reads plus an isolated restore before considering an old key removable. Keep old decrypt keys in protected recovery escrow for every retained backup that can still contain that version; deleting a key while such a backup exists destroys recoverability.
9. Remove a historical key only through a separate reviewed change after live rows, retained backups and legal-hold copies are accounted for. A direct variable replacement is not a rotation procedure.
10. Record key owner, creation, activation, row-count reconciliation, backup coverage, revocation and validation evidence without recording the value.

## Backup and restore

Back up PostgreSQL and the complete EspoCRM recovery set before schema/extension changes and on the approved schedule. The recovery set includes its database, the complete `/var/www/persistent` tree (`data`, `custom` and `client-custom`), any separately configured upload path, version/image identity and the separately protected key/configuration metadata required to decrypt existing data. Database and filesystem backups must share a documented consistency point.

A backup is not evidence until an isolated restore passes database integrity, entity/table and aggregate row-count checks, encryption-decryption, attachment access, daemon/cron execution, queue state, extension readiness and application login/API checks. Time the restore against RPO/RTO, record immutable backup identifiers and test restoration again after material version or storage changes. Mailgun is not a backup for CRM or workflow state.

On-call names and phone numbers belong in the restricted incident/contact system, not this public repository. The operational rotation must assign primary engineering, secondary platform and privacy/security escalation roles for every week.
