# Legacy EspoCRM Lead migration — `legacy-leads-v2`

Legacy `Lead` rows are untrusted staging input. They are never eligible recipients by virtue of being imported. Existing descriptions contain free-form radio/DJ dialects, duplicate addresses and incomplete purpose/evidence; a historic score, send, open or click is not consent and is not current submission evidence.

The implemented migration contract is `legacy-leads-v2`. Its deterministic ordering, digest-bound approval, restart checkpoints and contact-linked historical-event import are covered by automated tests. Those controls make the import reproducible; they do not authorize outreach and do not constitute an ISO/IEC 27001, ISO/IEC 27701 or NIS2 certification.

## Current environment evidence

The isolated Railway staging restore contains 141 EspoCRM tables and 2,815 `Lead` rows. Treat those values as the current rehearsal baseline, not permanent constants: record them again for every approved snapshot. EspoCRM application state is mounted at `/var/www/persistent`. Production sending remains fail-closed with `OUTREACH_KILL_SWITCH=true` and `OUTREACH_SEND_ENABLED=false` throughout migration and review.

## V2 safety contract

- Dry run is the default; apply requires both `--apply` and an approved `--report` file.
- The command reads complete `Lead` and `CampaignLogRecord` sources twice. It rejects the run when their canonical SHA-256 source digests differ.
- Source rows are canonically ordered by `(modifiedAt ASC, id ASC)`. Equal timestamps therefore have a stable secondary cursor.
- Contacts and outlets are fingerprint-upserted. Historical events use deterministic `externalEventId` values and are idempotently upserted.
- Apply operations have a stable order: selected outlets, selected contacts, then their contact-linked historical events. PostgreSQL checkpoints persist the next operation offset and counters after each completed batch.
- Apply holds one PostgreSQL session advisory lock for the migration version. A concurrent apply is rejected; a crashed process releases the lock with its database session so the checkpoint can be resumed safely.
- The run ID binds migration version, source digest and scope: `legacy-leads-v2-<digest-prefix>:<limit|all>`. A completed run returns `already_succeeded`; a mismatched version or digest is rejected.
- Dry-run output includes a content digest, full reconciliation equations, category counts, per-field conflict counts and redacted samples. It emits no raw email, name, body, token or provider ID in samples.
- Apply recalculates the live snapshot and verifies the report content, `sourceDigest`, `reportDigest`, explicit approver identity and approval time before writing.
- Unknown values stay `Unknown`/`Needs Validation`; AI, score and optimistic interpretation cannot supply evidence.
- Every imported contact is quarantined with `status=Needs Validation` and `doNotContact=true`, including contacts with a prior send.
- Only recognized historic `opt_out`, `spam_complaint` and `hard_bounce` signals create permanent deny-wins suppressions. A soft bounce or prior send stays quarantined but is not silently converted into permanent objection evidence.
- No source `Lead` or `CampaignLogRecord` is modified or deleted.
- Suppression has precedence over every positive or newer-looking source record.

## Operator command contract

Run from the worker directory against the explicitly selected environment. Never print Railway variables or report contents into chat, CI logs or tickets.

```bash
cd services/outreach-worker
export RAILWAY_ENVIRONMENT="staging"
export RAILWAY_SERVICE="outreach-worker"
railway status

railway run --environment "$RAILWAY_ENVIRONMENT" --service "$RAILWAY_SERVICE" \
  npm run migrate:legacy -- --dry-run --report legacy-dry-run.json
chmod 0600 legacy-dry-run.json
```

`--dry-run` is descriptive; absence of `--apply` is the actual fail-safe. The report process exits non-zero when reconciliation does not allow apply.

### Digest-bound approval

The engineering reviewer validates deterministic reconciliation and idempotency. The campaign/privacy owner validates purpose, evidence and suppression interpretation. Record both approvals in the controlled change record. The report's `approvedBy` value must identify the accountable approval identity/change record, not a generic word such as `admin`.

After review, update only the approval envelope; do not recalculate or edit the protected report material:

```bash
export MIGRATION_APPROVAL_ID="CHANGE-RECORD/APPROVER-IDENTITY"
tmp_report="$(mktemp)"
jq --arg by "$MIGRATION_APPROVAL_ID" \
   --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
   '.approval.approved = true |
    .approval.approvedBy = $by |
    .approval.approvedAt = $at' \
   legacy-dry-run.json > "$tmp_report"
chmod 0600 "$tmp_report"
mv "$tmp_report" legacy-dry-run.json
unset MIGRATION_APPROVAL_ID
```

The v2 verifier then proves all of the following:

1. `migrationVersion` is exactly `legacy-leads-v2`;
2. both old and newly calculated reports have `applyAllowed=true`;
3. recalculating the content digest equals the stored `reportDigest`;
4. approved and current `sourceDigest` values match;
5. approved and current `reportDigest` values match;
6. `approved=true`, `approvedBy` is non-empty and `approvedAt` is a valid timestamp; and
7. the approval envelope repeats the current source and report digests.

The JSON envelope is a technical integrity and stale-snapshot gate, not a digital signature. Protect the file, deployment identity and change record with platform access control and independent review.

## Deterministic mapping

| Legacy input | Destination | V2 rule |
| --- | --- | --- |
| Outlet/station/DJ name and website/domain | `MediaOutlet` | Normalize domain, retain source URL and fingerprint-upsert; never fabricate a website. |
| Type/format/country/language/timezone | `MediaOutlet` | Map only allowlisted values; unknown stays unknown or needs validation. |
| Published submission policy and URL/text | submission fields | Require explicit source evidence; a general contact page is not explicit music submission evidence. |
| Person name, role and email | `MediaContact` | Normalize email, derive deterministic fingerprint, merge duplicate candidates by the documented canonical rule and quarantine. |
| Contact-purpose text | `MediaContact.contactPurpose` | Map only explicit allowlisted phrases; otherwise `Unknown`. |
| Contact-basis evidence | `MediaContact.contactBasis` | Map only documented opt-in, relationship or explicit submission-address evidence; otherwise `Unknown`. |
| Historic validation | validation fields | Import only verifiable source/status/date; stale or ambiguous state remains pending/unknown. |
| Historic opt-out, complaint or hard bounce | contact flags plus `OutreachSuppression` | Deny wins in PostgreSQL and EspoCRM; retain source type and event time. |
| Historic sent, delivered, opened, clicked, replied or bounced row | `OutreachEvent` linked to `MediaContact` | Deterministic external ID and correlation ID; no invented `OutreachMatch` link. Contact stays quarantined. |
| Unsupported/unlinked/invalid historic row | reconciliation category | Do not fabricate an event; count it exactly and require review. |
| Free-form notes/descriptions | migration evidence only | Parse deterministically with the versioned parser; notes are never send-authoritative. |
| Legacy score | report only | Do not import as a current `matchScore`; recompute only after current-policy validation. |

## Historical event contract

V2 imports supported `CampaignLogRecord` actions as append-only `OutreachEvent` records linked to the canonical `MediaContact`:

| Historic action family | Event type | Permanent suppression? |
| --- | --- | --- |
| sent/send | `Sent` | No |
| delivered | `Delivered` | No |
| opened | `Opened` | No |
| clicked | `Clicked` | No |
| replied | `Replied` | No |
| soft bounce | `Soft Bounced` | No; quarantine remains |
| hard bounce | `Hard Bounced` | Yes |
| complaint/spam | `Spam Complaint` | Yes |
| opted out/unsubscribe | `Opted Out` | Yes |

`externalEventId` is derived from the CampaignLogRecord identity, and details retain only the migration version, source type and hashed source identity. Historic rows without a target, with a non-Lead target, an unlinked Lead, an invalid contact, unsupported action or missing event time are not discarded silently; they appear in mutually exclusive reconciliation categories. Conflicting duplicate event identities make `applyAllowed=false`.

## Reconciliation and evidence

V2 enforces these equations:

```text
sourceTotal = invalidOrMissingEmail + canonicalContacts + duplicateRows

canonicalContacts = permanentSuppression
                  + priorSendQuarantine
                  + duplicateConflictQuarantine
                  + validationQuarantine
                  + baselineManualReviewQuarantine

campaignTotal = importableEvents
              + duplicateEventRows
              + missingTargetRows
              + nonLeadTargetRows
              + unlinkedTargetRows
              + invalidContactRows
              + unsupportedActionRows
              + missingEventDateRows
```

Approval evidence must contain:

- version, migration run ID, source and report digests;
- snapshot ordering and Lead/CampaignLogRecord counts;
- canonical contacts/outlets, invalid rows and duplicate rows;
- contact outcome categories and field-level conflict counts;
- historic event and non-importable-history categories;
- redacted samples keyed by truncated hashes only;
- all three balanced equations and `applyAllowed=true`;
- test result, database backup/restore identifiers and accountable approvals.

For the current staging restore, the Lead baseline must reconcile to 2,815 before canary apply. The known 141-table count proves the restored schema's current breadth, not content correctness; separately verify entity counts, schema integrity, login/API access and persistent application state.

## Phase 0 — freeze, backup and restore evidence

1. Record UTC cutoff, Git commit, EspoCRM/extension versions and image digest.
2. Confirm the old sender has no active schedule/deployment and keep both new-worker send controls disabled.
3. Capture consistent EspoCRM database and `/var/www/persistent` state backups plus worker PostgreSQL backup.
4. Restore into isolated staging; verify 141 tables and 2,815 Leads against the recorded source snapshot.
5. Verify EspoCRM keys/config decrypt restored data; never generate replacement cryptographic keys over an existing database.
6. Run the exact release-candidate tests and record evidence.

## Phase 1 — non-mutating dry run

Run the dry-run command twice. The two reports must have identical `sourceDigest`, `reportDigest`, ordering, reconciliation and category counts; `generatedAt` may differ. Investigate every identity conflict or unbalanced equation. No `MediaOutlet`, `MediaContact`, `OutreachEvent`, suppression, PostgreSQL migration-run or send-queue record may be created by this phase.

## Phase 2 — five-contact migration canary

Select five contacts that collectively exercise explicit submission evidence, a duplicate cluster, permanent suppression, unknown evidence and historical event import. `--limit` limits canonical contacts and includes only their required outlets/events.

Use the dedicated canary entrypoint. It refuses every environment except the exact Railway environment name `outreach-staging`, requires both send locks, accepts no caller-controlled limit or batch size, verifies the approved report again and requires the operator to supply both SHA-256 digests from the approved change record. Run it once without `--apply`; only the second invocation can mutate staging.

```bash
export RAILWAY_ENVIRONMENT="outreach-staging"
export LEGACY_EXPECTED_SOURCE_DIGEST="<approved-source-sha256-from-change-record>"
export LEGACY_EXPECTED_REPORT_DIGEST="<approved-report-sha256-from-change-record>"

railway run --environment "$RAILWAY_ENVIRONMENT" --service "$RAILWAY_SERVICE" \
  npm run migrate:legacy:canary -- \
  --report legacy-dry-run.json \
  --expected-source-digest "$LEGACY_EXPECTED_SOURCE_DIGEST" \
  --expected-report-digest "$LEGACY_EXPECTED_REPORT_DIGEST"

railway run --environment "$RAILWAY_ENVIRONMENT" --service "$RAILWAY_SERVICE" \
  npm run migrate:legacy:canary -- \
  --apply --report legacy-dry-run.json \
  --expected-source-digest "$LEGACY_EXPECTED_SOURCE_DIGEST" \
  --expected-report-digest "$LEGACY_EXPECTED_REPORT_DIGEST"

unset LEGACY_EXPECTED_SOURCE_DIGEST LEGACY_EXPECTED_REPORT_DIGEST
```

Validate after apply:

- every destination is fingerprint/external-ID upserted;
- all five contacts remain `Needs Validation` and `doNotContact=true`;
- recognized negative history exists in both suppression stores;
- supported history is linked to the correct canonical contact;
- no historical event has an invented `OutreachMatch` link;
- checkpoint counters reconcile exactly to outlets + contacts + events;
- no send queue or provider attempt exists; and
- rerunning returns `already_succeeded` or produces no new destination records.

The canary is a migration canary, never an email canary.

## Phase 3 — bounded full apply and restart behavior

```bash
railway run --environment "$RAILWAY_ENVIRONMENT" --service "$RAILWAY_SERVICE" \
  npm run migrate:legacy -- \
  --apply --report legacy-dry-run.json --batch-size 100
```

- The source digest is recomputed before apply. Any source change requires a new dry run and new approval.
- A checkpoint is committed only after each operation batch completes. On interruption, rerun the same approved command; it resumes from the stored operation offset.
- Resume resolves already-created outlet/contact dependencies by deterministic fingerprint and continues historical-event upserts by deterministic external ID.
- Stop on reconciliation drift, unknown enum, duplicate-identity conflict, missing checkpoint dependency, auth/signature failure or error-rate threshold.
- Never edit the checkpoint manually and never reuse a report with a different `--limit` as if it were the same approved run scope.
- Keep sending disabled throughout import, reconciliation and human validation.

## Phase 4 — current-policy validation and outreach canary

Migration completion does not confer permission to contact. For each canonical contact:

1. validate current purpose, basis, evidence URL/text and email status;
2. review duplicate conflicts and all prior communication history;
3. retain deny-wins suppression unless an accountable human resolves it with evidence;
4. recompute matches from current release/outlet/contact business state;
5. verify cooldown and active-sequence constraints; and
6. clear quarantine only through an audited per-contact approval.

Then follow the separate five-recipient outreach canary in the [Railway runbook](railway-runbook.md). Never clear `doNotContact` in bulk.

## Rollback and compensation

Migration rollback is a compensating operation scoped by migration run ID; it is not source deletion or a schema down-migration.

- Keep sending disabled and preserve source/destination evidence.
- Preserve imported suppressions and negative historical events unless the privacy/legal owner proves them invalid.
- Remove or mark only destination rows created solely by the run, not subsequently edited and not referenced by other valid records.
- Never drop shared tables or reset PostgreSQL checkpoints during an incident.
- Reconcile all v2 counters and event identities after compensation.
- Use a full database/application-state restore only for catastrophic corruption, after proving which post-backup changes and inbound events would be lost.

Retain the immutable report, its digests, approval record, checkpoint history, result counters and rollback decision according to the approved privacy/records policy.
