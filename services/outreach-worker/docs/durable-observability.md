# Durable operational observability core

## Status and boundary

Migrations `010_durable_observability.sql` and `011_operational_alert_delivery_outbox.sql` provide the PII-free PostgreSQL durability boundary for R55. An approved enabled policy is wired through `config.mjs` and `container.mjs` into one supervised worker loop. That loop collects, captures, prunes and projects alert events in bounded operations. No live dashboard, retained Prometheus/OpenTelemetry backend, page delivery or on-call acknowledgement is claimed.

The implemented local flow is:

1. the included PostgreSQL collector calculates all 18 finite metrics below without selecting business identifiers;
2. `createOperationalObservabilityService(...).capture(...)` persists one digest-bound collection bucket and evaluates every configured rule;
3. a transactional projector advances a durable `sequence_id` cursor and copies typed alert evidence into an idempotent delivery outbox;
4. the same supervisor runs bounded `service.prune(...)` maintenance on its separately approved cadence;
5. a dashboard may read bounded rollups through `readRollups` or an external retained monitoring backend.

The external router and dashboard remain unconfigured capabilities. The worker does not claim outbox deliveries and must not infer successful delivery from an event or outbox row existing in PostgreSQL. This runtime records detection and durable hand-off evidence only.

## PII and cardinality contract

Snapshots accept numeric values only. There is no labels, tags, payload or arbitrary metadata column. Metric names are compiled into both application validation and database `CHECK` constraints:

| Metric | Range / unit |
| --- | --- |
| `outreach_health_sent_24h` | non-negative integer count |
| `outreach_health_harmful_rate` | ratio `0..1` |
| `outreach_health_failure_rate` | ratio `0..1` |
| `outreach_work_queue_depth` | non-negative integer count |
| `outreach_send_queue_depth` | non-negative integer count |
| `outreach_response_queue_depth` | non-negative integer count |
| `outreach_event_inbox_depth` | non-negative integer count |
| `outreach_oldest_work_seconds` | non-negative seconds |
| `outreach_oldest_event_seconds` | non-negative seconds |
| `outreach_work_dead_letters` | non-negative integer count |
| `outreach_send_dead_letters` | non-negative integer count |
| `outreach_response_dead_letters` | non-negative integer count |
| `outreach_delivery_unknown` | non-negative integer count |
| `outreach_full_reconcile_age_seconds` | seconds; `-1` means no successful run |
| `outreach_incremental_reconcile_age_seconds` | seconds; `-1` means no successful run |
| `outreach_send_circuit_open` | integer `0` or `1` |
| `outreach_technical_state_ready` | integer `0` or `1` |
| `outreach_crm_projection_backlog` | non-negative integer count |

The included collector defines `outreach_technical_state_ready=1` only when the required PostgreSQL relations and global safety-circuit row are present. It does not prove EspoCRM, Mailgun, HTTP readiness or end-to-end service readiness; later wiring must retain the existing external readiness probes separately.

Never add contact, recipient, email, domain, outlet, release, campaign, correlation or exception-text dimensions to this store. A new operational metric requires a reviewed schema and code change; it is not an environment-only label expansion.

Policy versions, approval references and rule IDs accept only bounded operational tokens. Digests are derived only from the policy, timestamps and numeric operational values.

## Fail-closed configuration

`loadOperationalObservabilityPolicy` reads `OUTREACH_OBSERVABILITY_POLICY_JSON`. Missing or blank configuration is disabled. Invalid JSON, unknown keys, unknown metrics, duplicate rule IDs, invalid numeric ranges, non-integral counts, unsafe time/cap bounds or an enabled policy without rules is rejected. Alert-evaluation evidence must cover the full accepted snapshot window so an older retained snapshot can never bypass stale-evidence fencing. No retention duration or alert threshold is invented by the application.

Example configuration (design example, not production approval):

```json
{
  "schemaVersion": 1,
  "policyVersion": "observability-policy-v1",
  "enabled": true,
  "approvedPolicyReference": "change-observability-001",
  "sampleIntervalSeconds": 60,
  "rollupBucketSeconds": 300,
  "snapshotRetentionHours": 168,
  "rollupRetentionDays": 90,
  "alertEvidenceRetentionDays": 180,
  "maximumClockSkewSeconds": 30,
  "pruneBatchSize": 500,
  "maximumSnapshots": 11000,
  "maximumRollupBucketsPerMetric": 27000,
  "maximumEvaluationsPerRule": 11000,
  "maximumEventsPerRule": 1000,
  "rules": [
    {
      "id": "event-lag",
      "metric": "outreach_oldest_event_seconds",
      "comparator": "greater_than",
      "threshold": 300,
      "severity": "sev2",
      "cooldownSeconds": 900
    },
    {
      "id": "work-lag",
      "metric": "outreach_oldest_work_seconds",
      "comparator": "greater_than",
      "threshold": 300,
      "severity": "sev2",
      "cooldownSeconds": 900
    }
  ]
}
```

An accountable operations owner must approve the thresholds, cooldowns, evidence horizon and hard caps. Enabling the worker also requires the independent bounded token `OUTREACH_OBSERVABILITY_RUNTIME_APPROVAL_REFERENCE`. Startup validates that prune cadence is an exact sample-cadence multiple, retry cadence is shorter than every supervised cadence, each evidence cap contains the configured headroom, a prune run has sufficient bounded throughput and the outbox exceeds one projection batch by that headroom. Invalid combinations stop startup.

Runtime controls are explicit and bounded:

- `OUTREACH_OBSERVABILITY_PRUNE_INTERVAL_MS`
- `OUTREACH_OBSERVABILITY_RETRY_INTERVAL_MS`
- `OUTREACH_OBSERVABILITY_PRUNE_MAX_BATCHES`
- `OUTREACH_OBSERVABILITY_CAPACITY_HEADROOM_SAMPLES`
- `OUTREACH_ALERT_PROJECTOR_INTERVAL_MS`
- `OUTREACH_ALERT_PROJECTOR_BATCH_SIZE`
- `OUTREACH_ALERT_OUTBOX_MAX_BACKLOG`

The capture cadence comes only from the approved policy's `sampleIntervalSeconds`; it cannot be overridden by a second source of truth.

## Storage and replay semantics

- One snapshot exists per policy digest and collection bucket. Exact replay returns the existing receipt. Different values for the same bucket produce `OBSERVABILITY_SNAPSHOT_BUCKET_COLLISION`; neither evidence set is silently selected.
- A newly inserted snapshot contributes exactly once to its rollup. Rollups store count, sum, minimum, maximum and the value from the latest observed sample.
- Snapshot ingestion, samples, rollup contribution and exact quota-counter changes share one PostgreSQL transaction.
- A rule evaluation key binds policy digest, rule ID and snapshot digest. Per-rule advisory serialization plus a unique key makes concurrent replicas and replays converge to one decision and at most one transition event.
- Out-of-order evidence is retained as a `stale` evaluation and cannot change current alert state.
- Snapshots outside the approved retention/clock-skew window are rejected before database access.

## Alert state machine

| Prior state | Condition | Decision | Append state event |
| --- | --- | --- | --- |
| healthy/resolved | threshold breached | `opened` | yes |
| open | still breached, before cooldown | `deduplicated` | no |
| open | still breached, cooldown elapsed | `reminder` | yes |
| open | recovered | `resolved` | yes |
| healthy/resolved | healthy | `healthy` | no |
| any | older than the latest evaluation | `stale` | no |

Evaluations and transition events are immutable after insertion; database triggers reject `UPDATE`. Configured retention/cap maintenance deletes whole records rather than rewriting evidence. Event pruning preserves the latest state baseline for every rule in the active policy, even when that baseline is older than the alert-evidence horizon. Active-policy maintenance never applies its retention or cap terms to another policy digest. Transition rows contain the complete numeric evidence required for later incident investigation, so pruning an older evaluation cannot mutate the retained event.

No alert is marked delivered, acknowledged or resolved by an operator in this core. `resolved` means only that a later metric no longer breached the deterministic rule.

## Runtime supervision and durable delivery hand-off

Capture, prune and projection share one PostgreSQL session-advisory runtime lock keyed by policy digest. They therefore cannot overlap across replicas. Lock contention is a normal skipped attempt and is retried on the bounded retry cadence. The supervisor checks the abort signal before starting work, uses abortable sleeps, records finite-label success/failure/contention/backpressure metrics, and participates in the worker's bounded shutdown drain. PostgreSQL statement/query timeouts remain the upper bound for an in-flight database operation.

The projector locks one singleton cursor with `FOR UPDATE SKIP LOCKED`, reads at most the approved batch after `operational_alert_events.sequence_id`, inserts immutable typed evidence under `delivery_key = event_key`, creates its pending delivery state and advances the cursor in the same transaction. A crash rolls back both insert and cursor. Replay verifies the existing key-to-evidence binding and advances without duplicating. The exact projection row carries outstanding and dead-letter counts; the projector stops before `OUTREACH_ALERT_OUTBOX_MAX_BACKLOG` rather than dropping evidence or scanning an unbounded table. Core event retention and cap pruning may delete only events at or behind this cursor and must still retain the latest policy/rule state baseline. When projection is behind, alert capacity therefore fails closed with backpressure instead of erasing an unprojected notification.

The repository contains bounded lease, retry, acknowledgement and dead-letter state transitions for a future router. The running worker intentionally does not call them. `acknowledgeDelivery` means only that an independently approved router has supplied an owned lease and acceptance result; it is not invoked by capture or projection. Dead letters remain in the hard backlog until an operator explicitly requeues them.

No generic HTTP pager adapter is present. Adding one requires a separately reviewed change with all of these gates: an exact approved HTTPS origin/path, public-address DNS validation and connection pinning against SSRF/rebinding on every redirect, an independent HMAC signing key and replay window, `delivery_key` as the provider idempotency key, bounded request/response/time limits, delivery-unknown classification for ambiguous transport failures, verified acceptance before acknowledgement, and staged crash/replay evidence. Until then `/capabilities` reports `external_alert_router_unconfigured`. The dashboard is likewise `external_dashboard_unconfigured`; these gates keep the aggregate capability status degraded but never block PostgreSQL-only `/readyz`. The public normalizer drops policy versions/references, digests, cursor/backlog/DLQ counts, endpoints, tokens and every non-allowlisted reason.

## Bounded retention and failure behavior

Capture and alert evaluation never prune, count retained tables or run window rankings. Their hot path consists of unique inserts, indexed point/latest-row reads and small trigger-maintained quota rows. A write that would exceed a hard cap rolls back with retryable capacity backpressure.

Only the explicit `prune` operation deletes evidence. It uses policy-scoped cutoff indexes, exact quota counters and index-ordered `LIMIT` candidates; there is no full-table window rank. Each call processes at most `pruneBatchSize * maxBatches` candidates per table/rule pass and is safe to replay. At an exact hard cap it removes a bounded oldest batch to create headroom, even when those rows are younger than the time horizon. This is why both duration and cap require approval.

- snapshots are bounded by time and `maximumSnapshots` per active policy;
- rollups are bounded by time and `maximumRollupBucketsPerMetric`;
- evaluations are bounded by time and `maximumEvaluationsPerRule`;
- transition evidence is bounded by time and `maximumEventsPerRule`, while retaining one latest active-policy state baseline;
- active-policy pruning never deletes evidence owned by another policy digest; already-empty historical quota projections may be removed.

Historical evidence is intentionally not auto-pruned using the active policy's terms. Safe historical cleanup requires reloading the exact approved policy for that digest, or a future durable registry that records per-digest retention and cap terms. Until that exists, non-empty historical rows remain; policy upgrades can therefore add retained series and require an explicit capacity plan.

If the prune schedule stops, capture remains bounded and eventually returns `OBSERVABILITY_METRIC_CAPACITY_BACKPRESSURE` or `OBSERVABILITY_ALERT_CAPACITY_BACKPRESSURE`; it does not perform an unbounded emergency cleanup. Run explicit bounded prune batches and investigate before resuming. The repository never accepts unbounded growth or silently drops the newest in-order evidence.

The isolated CLI requires exactly one explicit mode and does not run migrations:

```bash
node src/jobs/operational-observability.mjs --capture
node src/jobs/operational-observability.mjs --prune --max-batches 10
```

The worker supervisor now owns the approved recurring cadence. The CLI remains an explicit one-shot recovery/diagnostic path. A successful worker or CLI run is still not proof that an alert reached a responder.

## Verification

Targeted checks:

```bash
npm run check
node --test tests/operational-observability.test.mjs
node --test --test-concurrency=1 tests/operational-observability.integration.mjs
node --test --test-concurrency=1 tests/operational-alert-delivery.integration.mjs
node --test tests/worker-runtime.test.mjs
```

The PostgreSQL suites cover the 18-metric collector-to-alert path, concurrent replicas, exact replay, conflicting bucket evidence, rollup single-counting, cooldown deduplication, reminders, recovery, stale evidence, immutable rows, digest-isolated retention and hard-cap backpressure. They also exercise transactional cursor crash rollback, replay, concurrent projection, backlog stop, lease retry, DLQ/requeue/acknowledgement and cross-replica runtime exclusion. A 10,000-snapshot/evaluation fixture asserts index plans for collection replay, latest alert state and retention candidates, then executes a timed capture. These tests are worktree evidence only; live query latency, an external router, dashboard behavior and responder delivery still require staging and production operating evidence.
