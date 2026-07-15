# Privacy governance runbook

Status: worktree control implementation. Owner roles, lawful bases, approved retention periods, production schedules, access reviews, backup deletion and cross-store execution remain organizational controls. This document and the code do not claim ISO 27001/27701 certification or determine a statutory retention period.

## Safety model

Privacy governance runs as direct PostgreSQL one-shot jobs, separate from the outreach worker and EspoCRM integration. It is disabled when `OUTREACH_RETENTION_POLICY_JSON` is blank. An enabled schema-version-1 policy is accepted only when it explicitly configures all nine compiled data classes; a disabled policy must configure none. Every duration must be inside its separately supplied approved minimum and maximum. The application has no default duration.

The privacy jobs load only PostgreSQL connection limits plus the active/historical data-encryption keys and the independent hash key. They neither load nor require EspoCRM, Mailgun, source-ingestion or sending credentials. Run them with a dedicated non-owner database login and a separate Railway service/job identity; never reuse the schema-migration owner or the outreach send identity.

PostgreSQL operations use fixed table/index/constraint allowlists. Retention has two phases: an immutable canonical dry-run plan and an exact digest-bound execution. Execution also requires approval, change and recovery identifiers, disabled sending, the dedicated confirmation value, a singleton fenced lease, a valid online-schema contract and a final drift/legal-hold check inside each mutation transaction. There are no hard deletes: attributable content is crypto-tombstoned or metadata is anonymized. Suppression hashes and contact genre denials remain deny-wins safety evidence.

| Data class | PostgreSQL scope |
| --- | --- |
| `inbound_event_evidence` | encrypted inbound event evidence |
| `generated_copy_evidence` | encrypted generated copy |
| `automatic_response_evidence` | encrypted response queue |
| `human_review_evidence` | encrypted human-review evidence |
| `queue_routing_metadata` | work items, send queue, sequence allocations, lifetime campaign/outlet allocation ledger and deny-wins aggregate counters |
| `delivery_attempt_metadata` | send and response delivery attempts |
| `outcome_metadata` | outcome events and CRM delivery projections; genre denials are planned as safety-preserved |
| `source_traceability_metadata` | ingestion links, source identity bindings, claims and claim items, direct-CRM intake receipts and purpose-bound evidence attestations |
| `email_validation_metadata` | keyed email-validation cache |

Pseudonymous identifiers and keyed hashes remain personal data. Email linkage deliberately supports all established conventions: send/allocation hashes use `HMAC("email:" + normalizedEmail)`, validation cache uses `HMAC(normalizedEmail)`, and source identity uses `HMAC("source-identity:email:" + normalizedEmail)`.

Migration 018 binds the complete keyed-identity namespace to one immutable database attestation: the configured epoch, subject/integrity hash versions, a keyed fingerprint and an authenticated MAC. Every long-running runtime and every job that reads or writes keyed identities verifies that row after migrations and before doing work. A changed key, changed epoch, unsupported identity version or forged row is a non-retryable startup failure. `crm_intake_receipts.revision_digest` and `purpose_bound_evidence_attestations.evidence_digest` are unkeyed canonical SHA-256 digests; they are still subject-linkable privacy metadata and therefore participate in the subject graph, DSAR, legal hold and retention lifecycle, but they are not members of the `OUTREACH_HASH_KEY` namespace.

Subject relationships are materialized as immutable, keyed-HMAC links with a versioned byte-exact integrity digest. Retention and DSAR operations use that durable graph in bounded set queries and verify its digest before acting. Mutation plans additionally bind an immutable target-contract digest. A legal hold is checked while holding the same transaction fence used to export an erasure plan, so a hold created after planning cannot race the export.

## Migration identity and audit privileges

Production uses separate principals:

1. a migration owner runs `npm run db:migrate` and owns schema objects;
2. a non-login group role named exactly `outreach_privacy_runtime` receives the audit append capability;
3. the privacy job login is a member of that group and receives only the table privileges required by the approved job;
4. all other application and reporting roles receive no audit-table DML or append-function execution.

Create `outreach_privacy_runtime` before migration 014 so its conditional grants are installed. Migration 014 revokes `PUBLIC` execution, direct audit DML and `PUBLIC` schema creation. The database-owned `SECURITY DEFINER` function serializes the hash chain, validates the compiled event contract and records `session_user`; the runtime role cannot supply its own predecessor hash. The runtime login must not own `privacy_audit_events`, the append function, or the `public` schema. Verify effective privileges as the actual job login before go-live and after every restore.

Migration files are SHA-256 bound in `schema_migrations`. Existing installations with historical NULL checksums require one reviewed baseline run with the exact temporary confirmation below; unset it immediately afterwards. Any later byte drift fails closed.

```bash
export OUTREACH_MIGRATION_CHECKSUM_BASELINE_CONFIRM=reviewed-historical-migration-baseline
npm run db:migrate
unset OUTREACH_MIGRATION_CHECKSUM_BASELINE_CONFIRM
```

Do not use the baseline confirmation to accept an unexplained change. Compare every deployed historical migration with the release artifact first. New databases and already checksummed databases do not need this value. Migrations marked `no-transaction` are accepted only when they contain exactly one SQL statement; stacked SQL is rejected.

## First-time online preparation

Keep both send controls closed for every apply operation:

```bash
export OUTREACH_KILL_SWITCH=true
export OUTREACH_SEND_ENABLED=false
npm run db:migrate
npm run privacy:index -- --actor-id privacy-operator-001
```

On the first migration-018 rollout to a database that already contains keyed identities, startup intentionally refuses to self-assert the active key. With sending disabled, compare the deployed secret against the previously controlled secret, attach the evidence to a change record, then perform exactly one bootstrap start with:

```bash
export OUTREACH_HASH_KEY_EPOCH=v1
export OUTREACH_HASH_KEY_BOOTSTRAP_REFERENCE=approved-change-reference-001
export OUTREACH_HASH_KEY_BOOTSTRAP_CONFIRM=approved-existing-hash-key-attestation
# start one runtime or privacy job; verify the attestation succeeds
unset OUTREACH_HASH_KEY_BOOTSTRAP_REFERENCE OUTREACH_HASH_KEY_BOOTSTRAP_CONFIRM
```

An empty database bootstraps automatically. The attestation row is database-immutable and must travel with backup/restore. Never delete or recreate it to make a key mismatch pass.

The dry run reports every required index, FK, record-ID default/NOT-NULL contract and remaining backfill count. Review it before apply. Apply requires the exact dedicated confirmation:

```bash
export OUTREACH_PRIVACY_INDEX_CONFIRM=approved-bounded-privacy-index-backfill
npm run privacy:index -- --apply --actor-id privacy-operator-001 --batch-size 100 --max-batches 100
```

Re-run bounded batches until `ready` is true. The operation is resumable and performs this order:

1. build each fixed index with `CREATE [UNIQUE] INDEX CONCURRENTLY`, one at a time;
2. recover invalid indexes left by interrupted concurrent builds;
3. validate named `NOT VALID` plan FKs one at a time;
4. backfill UUIDs with primary/natural-key batches and `FOR UPDATE SKIP LOCKED`;
5. only after zero NULLs, install the metadata-only UUID default;
6. add and validate a temporary `CHECK (privacy_record_id IS NOT NULL) NOT VALID`, set `NOT NULL` using that proof, then remove the temporary check.

Every lock and statement is time-bounded. A timeout, duplicate UUID, changed default, wrong index definition, missing FK, NULL row or interrupted validation leaves planning and execution fail-closed. Fix the cause and rerun; do not replace the job with an unbounded SQL backfill.

## Retention plan and execution

Create a canonical plan. Persist the returned plan ID, policy digest, canonical digest, snapshot and counts in the restricted change record:

```bash
npm run privacy:retention -- --actor-id privacy-operator-001 --snapshot-at 2026-07-15T10:00:00Z
```

Only after accountable review may the same plan be executed:

```bash
export OUTREACH_PRIVACY_EXECUTION_CONFIRM=approved-digest-bound-privacy-execution
npm run privacy:retention -- --execute \
  --plan-id 00000000-0000-4000-8000-000000000000 \
  --expected-digest REPLACE_WITH_64_HEX_DIGEST \
  --approval-id privacy-approval-001 \
  --change-id privacy-change-001 \
  --recovery-id privacy-recovery-001 \
  --actor-id privacy-operator-001 \
  --batch-size 100 --max-batches 100
```

A max-batch stop safely relinquishes the lease; rerun with the exact same binding. An expired/crashed lease can be fenced and resumed. Digest drift aborts the batch before commit. Do not edit a plan or reuse its approval identifiers for another digest.

## Legal holds

Create input as a new regular file with mode `0600`; do not put evidence or subjects on a command line:

```json
{
  "subjectType": "contact",
  "subject": "REPLACE_IN_RESTRICTED_FILE",
  "scopeDataClass": "inbound_event_evidence",
  "caseReference": "legal-case-001",
  "evidence": { "authorityReference": "restricted-reference" }
}
```

```bash
chmod 0600 /restricted/legal-hold.json
npm run privacy:legal-hold -- --create --input /restricted/legal-hold.json --actor-id privacy-operator-001
npm run privacy:legal-hold -- --release \
  --hold-id 00000000-0000-4000-8000-000000000000 \
  --release-reference legal-release-001 --actor-id privacy-operator-001
```

Only `subjectType=global` blocks an entire matching class. Contact, email, outlet and domain holds match keyed subject references per record. Planning marks matching records held; execution rechecks matching holds per record while holding the legal-hold fence. A hold added after approval rolls back that complete batch.

## DSAR and EspoCRM separation of duties

DSAR input must be a new or controlled `0600` JSON file. Supported request types are `lookup`, `export`, `correction` and `erasure`:

```bash
npm run privacy:dsar -- --create --input /restricted/dsar.json --actor-id privacy-operator-001
npm run privacy:dsar -- --plan \
  --request-id 00000000-0000-4000-8000-000000000000 \
  --actor-id privacy-operator-001 --maximum-records 5000
```

The bounded snapshot covers subject-linked queues, counters/reservations/guards, the lifetime allocation ledger, encrypted evidence, work items, attempts, outcomes, source receipts/traceability, direct-CRM evidence metadata, validation cache, CRM delivery projections, deny-wins genre decisions and suppressions. Request payloads, artifacts and Espo plans are encrypted; stdout contains identifiers, digests, statuses and counts, never the subject or exported records. Planning stops before encryption when the canonical artifact exceeds the 8 MiB preflight budget, preserving headroom beneath the 10 MiB encrypted envelope limit.

Export a digest-verified DSAR artifact only to a newly created restricted file; stdout contains its manifest, not its payload:

```bash
npm run privacy:dsar -- --export-artifact \
  --request-id 00000000-0000-4000-8000-000000000000 \
  --artifact-id 00000000-0000-4000-8000-000000000000 \
  --actor-id privacy-operator-001 \
  --output /restricted/dsar-artifact-export.json
```

This worker deliberately has no EspoCRM mutation executor. Correction/erasure input creates only field-allowlisted, expected-version-bound, encrypted plans. Export a verified plan into a newly created `0600` file for a separately authorized cross-store process:

```bash
npm run privacy:dsar -- --export-espo-plan \
  --plan-id 00000000-0000-4000-8000-000000000000 \
  --actor-id privacy-operator-001 \
  --output /restricted/espo-plan-export.json
```

The export recomputes the keyed digest, entity hash and metadata binding before writing and appends an audit event. Stdout contains only the safe manifest. No hard delete or broadened EspoCRM credential is implemented here. Until an authorized OCC executor and cross-store recovery process exist, PostgreSQL planning is implemented but end-to-end DSAR correction/erasure remains organizationally open.

Close a completed, rejected or otherwise resolved request with an attributable reference. Closure atomically cancels every still-planned Espo mutation and makes future export fail closed:

```bash
npm run privacy:dsar -- --close \
  --request-id 00000000-0000-4000-8000-000000000000 \
  --closure-reference dsar-case-resolution-001 \
  --actor-id privacy-operator-001
```

## Data-key and hash-key lifecycle

The bounded `crypto:reencrypt` job covers inbound events, generated copy, responses, human-review evidence, legal holds, DSAR requests, DSAR artifacts and Espo mutation plans. Supply the new 32-byte key as the active version and every still-present prior key in `OUTREACH_DATA_DECRYPTION_KEYS_JSON`; preview first, then apply bounded batches. Keep old keys available until the version report contains no rows for them and backup-retention/key-destruction approval is complete.

Hash-key rotation is not implemented in this release. Rows are globally version-bound by the immutable epoch attestation, but there is intentionally no per-row dual-read/write rehash, collision reconciliation or rollback executor. Therefore never change `OUTREACH_HASH_KEY` or `OUTREACH_HASH_KEY_EPOCH`. A future rotation must first ship a separately approved bounded migration covering suppressions, queue/allocation identities, capacity counters/guards, validation identities, source aliases, privacy subject graphs, genre-denial hashes and campaign/outlet counter+ledger identities, with collision and rollback evidence. The current hard startup gate prevents a silent disjoint namespace until that work exists.

## Failure response

| Signal | Meaning | First response |
| --- | --- | --- |
| `PRIVACY_POLICY_DISABLED` / `PRIVACY_POLICY_INVALID` | missing, partial or unapproved policy | stop; obtain a complete versioned owner-approved policy |
| `PRIVACY_INDEX_NOT_READY` | index/FK/default/NOT-NULL/backfill contract incomplete | run dry `privacy:index`, inspect drift, then resume bounded apply |
| PostgreSQL `55P03` / `57014` | lock or statement time bound reached | identify blocker; do not raise bounds without reviewed evidence; rerun |
| PostgreSQL `23505` during unique index | duplicate privacy UUIDs | investigate duplicate provenance, correct explicitly, rerun invalid-index recovery |
| `PRIVACY_PLAN_DRIFT` | approved row changed | abandon execution and create/reapprove a fresh dry-run |
| `PRIVACY_LEGAL_HOLD_ACTIVE` | matching hold appeared | keep data unchanged; validate case ownership and release only with authority |
| `PRIVACY_EXECUTION_ALREADY_RUNNING` / lease lost | concurrent or fenced worker | inspect lease owner/expiry; allow expiry or stop duplicate operator |
| `PRIVACY_ESPO_PLAN_INTEGRITY_FAILED` | encrypted plan or metadata no longer matches digest | quarantine export, investigate storage/key integrity; never apply it |
| `HASH_KEY_ATTESTATION_BOOTSTRAP_APPROVAL_REQUIRED` | existing keyed rows have no durable namespace attestation | keep sending disabled; verify the existing secret and perform the one-time approved bootstrap |
| `HASH_KEY_ATTESTATION_MISMATCH` / `HASH_KEY_ROTATION_REQUIRED` | configured key or epoch differs from the immutable database namespace | stop every writer; restore the correct secret/epoch; do not recreate the attestation |

## Evidence and external obligations

`privacy_audit_events` is an append-only hash chain; PostgreSQL rejects updates and deletes. Preserve plan JSON, policy version/digest, approvals, job output, audit-chain verification and restore-test evidence under the organization's evidence policy. Application logs must never receive DSAR subjects, decrypted artifacts, legal evidence or Espo plan payloads.

The following are outside this repository and must be evidenced before production readiness is claimed: privacy/records-owner approval of every duration; lawful-basis and data-subject verification; RBAC and dual-control for secure files/jobs; supervised cadence and alerts; EspoCRM DSAR execution; Mailgun/provider retention; Railway/PostgreSQL backups, PITR and backup expiry; log/APM deletion; key custody and destruction; incident exercises; vendor agreements; and periodic access/control reviews.
