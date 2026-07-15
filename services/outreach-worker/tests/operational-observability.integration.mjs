import assert from "node:assert/strict";
import test from "node:test";

import pg from "pg";

import { createOperationalObservabilityService } from "../src/application/operational-observability-service.mjs";
import { loadOperationalObservabilityPolicy } from "../src/domain/operational-observability-policy.mjs";
import { OperationalMetricCollector } from "../src/infrastructure/operational-metric-collector.mjs";
import { OperationalAlertDeliveryRepository } from "../src/infrastructure/operational-alert-delivery-repository.mjs";
import { OperationalObservabilityRepository } from "../src/infrastructure/operational-observability-repository.mjs";
import { runMigrations } from "../src/infrastructure/postgres.mjs";
import { startPostgresTestCluster } from "./helpers/postgres-test-cluster.mjs";

const { Pool } = pg;

test("durable operational observability PostgreSQL contracts", async (t) => {
  const cluster = await startPostgresTestCluster();
  const database = await cluster.createDatabase();
  const pool = new Pool({ connectionString: database.url, max: 12 });
  t.after(async () => {
    await pool.end();
    await cluster.stop();
  });
  await runMigrations(pool);

  await t.test("database collector emits all 18 PII-free metrics into the durable capture and alert path", async () => {
    const now = new Date("2026-07-15T09:00:00.000Z");
    const { service, policy } = harness(pool, "collector-v1", () => now);
    const metrics = await new OperationalMetricCollector({ pool }).collect({ observedAt: now });
    assert.equal(Object.keys(metrics).length, 18);
    assert.equal(metrics.outreach_technical_state_ready, 1);
    assert.equal(metrics.outreach_send_circuit_open, 0);
    assert.equal(metrics.outreach_full_reconcile_age_seconds, -1);
    assert.equal(metrics.outreach_crm_projection_backlog, 0);
    const captured = await service.capture({ observedAt: now, metrics });
    assert.equal(captured.snapshot.metricCount, 18);
    assert.equal(captured.evaluations[0].decision, "healthy");
    assert.deepEqual(await policyCounts(pool, policy.digest), {
      snapshots: 1,
      samples: 18,
      rollups: 18,
      evaluations: 1,
      events: 0
    });
  });

  await t.test("concurrent replicas and exact replay create one snapshot, rollup contribution and alert event", async () => {
    const now = new Date("2026-07-15T10:00:00.000Z");
    const { service, policy } = harness(pool, "concurrency-v1", () => now);
    const results = await Promise.all(Array.from({ length: 12 }, () => service.capture({
      observedAt: now,
      metrics: { outreach_oldest_event_seconds: 301 }
    })));
    assert.equal(results.filter(({ snapshot }) => !snapshot.replayed).length, 1);
    assert.equal(results.filter(({ evaluations }) => !evaluations[0].replayed).length, 1);
    assert.ok(results.every(({ evaluations }) => evaluations[0].decision === "opened"));
    const counts = await policyCounts(pool, policy.digest);
    assert.deepEqual(counts, { snapshots: 1, samples: 1, rollups: 1, evaluations: 1, events: 1 });
    const rollup = (await pool.query(
      `SELECT sample_count,value_sum,value_min,value_max,value_last
         FROM operational_metric_rollups
        WHERE policy_digest=$1`,
      [policy.digest]
    )).rows[0];
    assert.deepEqual(rollup, {
      sample_count: 1,
      value_sum: 301,
      value_min: 301,
      value_max: 301,
      value_last: 301
    });
    await assert.rejects(
      () => service.capture({ observedAt: now, metrics: { outreach_oldest_event_seconds: 302 } }),
      (error) => error.code === "OBSERVABILITY_SNAPSHOT_BUCKET_COLLISION"
    );
    assert.deepEqual(await policyCounts(pool, policy.digest), counts);
  });

  await t.test("cooldown, recovery and out-of-order evaluation are deterministic and append-only", async () => {
    const base = new Date("2026-07-15T11:00:00.000Z");
    let clock = new Date(base);
    const { service, repository, policy } = harness(pool, "state-machine-v1", () => clock);
    const captureAt = async (offsetSeconds, value) => {
      const observedAt = new Date(base.getTime() + offsetSeconds * 1_000);
      if (observedAt > clock) clock = observedAt;
      return service.capture({ observedAt, metrics: { outreach_oldest_event_seconds: value } });
    };

    assert.equal((await captureAt(0, 301)).evaluations[0].decision, "opened");
    const deduplicated = (await captureAt(60, 450)).evaluations[0];
    assert.equal(deduplicated.decision, "deduplicated");
    assert.equal(deduplicated.nextNotificationAt.toISOString(), "2026-07-15T11:05:00.000Z");
    assert.equal((await captureAt(300, 500)).evaluations[0].decision, "reminder");
    const resolved = await captureAt(360, 10);
    assert.equal(resolved.evaluations[0].decision, "resolved");
    const replay = await captureAt(360, 10);
    assert.equal(replay.snapshot.replayed, true);
    assert.equal(replay.evaluations[0].replayed, true);
    clock = new Date(base.getTime() + 420_000);
    assert.equal((await service.capture({
      observedAt: new Date(base.getTime() + 120_000),
      metrics: { outreach_oldest_event_seconds: 700 }
    })).evaluations[0].decision, "stale");

    const transitions = (await repository.listAlertEvents()).map(({ transition }) => transition);
    assert.deepEqual(transitions, ["opened", "reminder", "resolved"]);
    assert.deepEqual(await policyCounts(pool, policy.digest), {
      snapshots: 5,
      samples: 5,
      rollups: 2,
      evaluations: 5,
      events: 3
    });
    await assert.rejects(
      () => pool.query(
        "UPDATE operational_alert_events SET severity='sev1' WHERE policy_digest=$1",
        [policy.digest]
      ),
      (error) => error.code === "55000"
    );
    await assert.rejects(
      () => pool.query(
        "UPDATE operational_alert_evaluations SET decision='healthy' WHERE policy_digest=$1",
        [policy.digest]
      ),
      (error) => error.code === "55000"
    );
  });

  await t.test("hard caps apply backpressure and dedicated indexed prune creates bounded headroom", async () => {
    const base = new Date("2026-07-15T12:00:00.000Z");
    let clock = new Date(base);
    const { service, repository, policy } = harness(pool, "bounded-growth-v1", () => clock, {
      maximumSnapshots: 50,
      maximumRollupBucketsPerMetric: 50,
      maximumEvaluationsPerRule: 4,
      maximumEventsPerRule: 3,
      pruneBatchSize: 2,
      rules: [rule({ cooldownSeconds: 60 })]
    });
    for (let index = 0; index < 3; index += 1) {
      clock = new Date(base.getTime() + index * 60_000);
      await service.capture({
        observedAt: clock,
        metrics: { outreach_oldest_event_seconds: index % 2 === 0 ? 301 : 0 }
      });
    }
    clock = new Date(base.getTime() + 180_000);
    await assert.rejects(
      () => service.capture({ observedAt: clock, metrics: { outreach_oldest_event_seconds: 0 } }),
      (error) => error.code === "OBSERVABILITY_ALERT_CAPACITY_BACKPRESSURE" && error.retryable === true
    );
    assert.deepEqual(await policyCounts(pool, policy.digest), {
      snapshots: 4,
      samples: 4,
      rollups: 1,
      evaluations: 3,
      events: 3
    });
    const protectedUntilProjected = await service.prune({ now: clock, maxBatches: 1 });
    assert.equal(protectedUntilProjected.deleted.events, 0);
    await drainAlertProjection(pool);
    const pruned = await service.prune({ now: clock, maxBatches: 1 });
    assert.equal(pruned.deleted.events, 2);
    assert.equal((await service.capture({
      observedAt: clock,
      metrics: { outreach_oldest_event_seconds: 0 }
    })).evaluations[0].decision, "resolved");
    const latest = (await repository.listAlertEvents({ limit: 3 })).at(-1);
    assert.equal(latest.transition, "resolved");
    assert.equal(latest.state_after, "resolved");

    let snapshotClock = new Date("2026-07-15T13:00:00.000Z");
    const snapshotCap = harness(pool, "snapshot-cap-v1", () => snapshotClock, {
      maximumSnapshots: 2,
      pruneBatchSize: 1
    });
    await snapshotCap.service.capture({ observedAt: snapshotClock, metrics: { outreach_oldest_event_seconds: 0 } });
    snapshotClock = new Date(snapshotClock.getTime() + 60_000);
    await snapshotCap.service.capture({ observedAt: snapshotClock, metrics: { outreach_oldest_event_seconds: 0 } });
    snapshotClock = new Date(snapshotClock.getTime() + 60_000);
    await assert.rejects(
      () => snapshotCap.service.capture({ observedAt: snapshotClock, metrics: { outreach_oldest_event_seconds: 0 } }),
      (error) => error.code === "OBSERVABILITY_METRIC_CAPACITY_BACKPRESSURE"
    );
    assert.equal((await policyCounts(pool, snapshotCap.policy.digest)).snapshots, 2);
    await snapshotCap.service.prune({ now: snapshotClock, maxBatches: 20 });
    await snapshotCap.service.capture({ observedAt: snapshotClock, metrics: { outreach_oldest_event_seconds: 0 } });
    assert.equal((await policyCounts(pool, snapshotCap.policy.digest)).snapshots, 2);

    let rollupClock = new Date("2026-07-15T14:00:00.000Z");
    const rollupCap = harness(pool, "rollup-cap-v1", () => rollupClock, {
      maximumSnapshots: 20,
      maximumRollupBucketsPerMetric: 2,
      pruneBatchSize: 1
    });
    await rollupCap.service.capture({ observedAt: rollupClock, metrics: { outreach_oldest_event_seconds: 0 } });
    rollupClock = new Date(rollupClock.getTime() + 300_000);
    await rollupCap.service.capture({ observedAt: rollupClock, metrics: { outreach_oldest_event_seconds: 0 } });
    rollupClock = new Date(rollupClock.getTime() + 300_000);
    await assert.rejects(
      () => rollupCap.service.capture({ observedAt: rollupClock, metrics: { outreach_oldest_event_seconds: 0 } }),
      (error) => error.code === "OBSERVABILITY_METRIC_CAPACITY_BACKPRESSURE"
    );
    assert.equal((await policyCounts(pool, rollupCap.policy.digest)).rollups, 2);
    await rollupCap.service.prune({ now: rollupClock, maxBatches: 20 });
    await rollupCap.service.capture({ observedAt: rollupClock, metrics: { outreach_oldest_event_seconds: 0 } });
    assert.equal((await policyCounts(pool, rollupCap.policy.digest)).rollups, 2);

    const usage = (await pool.query(
      `SELECT snapshot_count FROM operational_observability_policy_usage WHERE policy_digest=$1`,
      [snapshotCap.policy.digest]
    )).rows[0];
    assert.equal(Number(usage?.snapshot_count ?? 0), (await policyCounts(pool, snapshotCap.policy.digest)).snapshots);
    const forbiddenColumns = await pool.query(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema='public'
          AND table_name LIKE 'operational_%'
          AND column_name ~ '(email|contact|outlet|release|label|payload)'`
    );
    assert.deepEqual(forbiddenColumns.rows, []);
    await assert.rejects(
      () => pool.query(
        `INSERT INTO operational_metric_samples (snapshot_digest,metric_key,metric_value)
         SELECT snapshot_digest,'contact_id',1
           FROM operational_metric_snapshots
          WHERE policy_digest=$1 LIMIT 1`,
        [rollupCap.policy.digest]
      ),
      (error) => error.code === "23514"
    );
  });

  await t.test("10k retained fixtures keep capture and alert lookup on bounded index plans", async () => {
    const base = new Date("2026-07-08T00:00:00.000Z");
    let clock = new Date(base.getTime() + 10_000 * 60_000);
    const { service, policy } = harness(pool, "large-fixture-v1", () => clock, {
      snapshotRetentionHours: 744,
      rollupRetentionDays: 30,
      alertEvidenceRetentionDays: 31,
      maximumSnapshots: 20_000,
      maximumRollupBucketsPerMetric: 10_000,
      maximumEvaluationsPerRule: 20_000,
      maximumEventsPerRule: 100,
      pruneBatchSize: 100
    });
    await pool.query(
      `WITH fixture AS (
         SELECT i,
                $3::timestamptz+i*interval '1 minute' AS observed_at,
                encode(digest($1||':snapshot:'||i::text,'sha256'),'hex') AS snapshot_digest
           FROM generate_series(0,9999) AS series(i)
       )
       INSERT INTO operational_metric_snapshots
         (snapshot_digest,policy_digest,policy_version,observed_at,rollup_bucket_at,metric_count)
       SELECT snapshot_digest,$1,$2,observed_at,
              to_timestamp(floor(extract(epoch FROM observed_at)/300)*300),1
         FROM fixture`,
      [policy.digest, policy.policyVersion, base]
    );
    await pool.query(
      `INSERT INTO operational_metric_samples (snapshot_digest,metric_key,metric_value)
       SELECT snapshot_digest,'outreach_oldest_event_seconds',0
         FROM operational_metric_snapshots
        WHERE policy_digest=$1`,
      [policy.digest]
    );
    await pool.query(
      `INSERT INTO operational_metric_rollups
        (policy_digest,policy_version,bucket_at,metric_key,sample_count,value_sum,value_min,value_max,
         value_last,first_observed_at,last_observed_at)
       SELECT policy_digest,$2,rollup_bucket_at,'outreach_oldest_event_seconds',count(*)::int,0,0,0,0,
              min(observed_at),max(observed_at)
         FROM operational_metric_snapshots
        WHERE policy_digest=$1
        GROUP BY policy_digest,rollup_bucket_at`,
      [policy.digest, policy.policyVersion]
    );
    await pool.query(
      `INSERT INTO operational_alert_evaluations
        (evaluation_key,policy_digest,policy_version,rule_id,snapshot_digest,metric_key,comparator,
         threshold,observed_value,breached,decision,observed_at,evaluated_at)
       SELECT encode(digest($1||':evaluation:'||snapshot_digest,'sha256'),'hex'),$1,$2,'event-lag',
              snapshot_digest,'outreach_oldest_event_seconds','greater_than',300,0,false,'healthy',
              observed_at,observed_at
         FROM operational_metric_snapshots
        WHERE policy_digest=$1`,
      [policy.digest, policy.policyVersion]
    );
    await pool.query("ANALYZE operational_metric_snapshots");
    await pool.query("ANALYZE operational_alert_evaluations");

    const snapshotPlan = await explain(pool,
      `SELECT snapshot_digest FROM operational_metric_snapshots
        WHERE policy_digest=$1 AND observed_at=$2`,
      [policy.digest, new Date(base.getTime() + 9_999 * 60_000)]
    );
    const alertPlan = await explain(pool,
      `SELECT observed_at FROM operational_alert_evaluations
        WHERE policy_digest=$1 AND rule_id=$2
        ORDER BY observed_at DESC,evaluation_key DESC LIMIT 1`,
      [policy.digest, "event-lag"]
    );
    const retentionPlan = await explain(pool,
      `SELECT snapshot_digest FROM operational_metric_snapshots
        WHERE policy_digest=$1 AND observed_at<$2 ORDER BY observed_at,snapshot_digest LIMIT 100`,
      [policy.digest, new Date(base.getTime() + 60_000)]
    );
    for (const plan of [snapshotPlan, alertPlan, retentionPlan]) {
      assert.equal(plan.includes("Seq Scan"), false, plan);
      assert.match(plan, /Index/u);
    }

    const startedAt = performance.now();
    const captured = await service.capture({
      observedAt: clock,
      metrics: { outreach_oldest_event_seconds: 0 }
    });
    const elapsedMilliseconds = performance.now() - startedAt;
    assert.equal(captured.evaluations[0].decision, "healthy");
    assert.ok(elapsedMilliseconds < 2_000, `indexed hot-path capture took ${elapsedMilliseconds.toFixed(1)}ms`);
    const usage = await pool.query(
      `SELECT snapshot_count FROM operational_observability_policy_usage WHERE policy_digest=$1`,
      [policy.digest]
    );
    assert.equal(Number(usage.rows[0].snapshot_count), 10_001);
  });

  await t.test("retention pruning is bounded, replay-safe and cannot apply one policy to another digest", async () => {
    const base = new Date("2026-07-01T00:00:00.000Z");
    const historicalBase = new Date(base.getTime() - 3 * 86_400_000);
    const historical = harness(pool, "historical-retention-v1", () => historicalBase, {
      snapshotRetentionHours: 744,
      rollupRetentionDays: 30,
      alertEvidenceRetentionDays: 31
    });
    await historical.service.capture({
      observedAt: historicalBase,
      metrics: { outreach_oldest_event_seconds: 301 }
    });
    let clock = new Date(base);
    const { service, policy } = harness(pool, "retention-v1", () => clock, {
      rollupRetentionDays: 1,
      alertEvidenceRetentionDays: 1,
      pruneBatchSize: 1
    });
    await service.capture({ observedAt: clock, metrics: { outreach_oldest_event_seconds: 301 } });
    clock = new Date(base.getTime() + 60_000);
    await service.capture({ observedAt: clock, metrics: { outreach_oldest_event_seconds: 0 } });
    assert.deepEqual(await policyCounts(pool, policy.digest), {
      snapshots: 2,
      samples: 2,
      rollups: 1,
      evaluations: 2,
      events: 2
    });

    await drainAlertProjection(pool);

    const retentionTime = new Date(base.getTime() + 2 * 86_400_000);
    const partial = await service.prune({ now: retentionTime, maxBatches: 1 });
    assert.equal(partial.completed, false);
    assert.equal(partial.batches, 1);
    const completed = await service.prune({ now: retentionTime, maxBatches: 10 });
    assert.equal(completed.completed, true);
    assert.deepEqual(await policyCounts(pool, policy.digest), {
      snapshots: 0,
      samples: 0,
      rollups: 0,
      evaluations: 0,
      events: 1
    });
    assert.deepEqual(await policyCounts(pool, historical.policy.digest), {
      snapshots: 1,
      samples: 1,
      rollups: 1,
      evaluations: 1,
      events: 1
    });
    const latestState = (await pool.query(
      "SELECT transition,state_after FROM operational_alert_events WHERE policy_digest=$1",
      [policy.digest]
    )).rows[0];
    assert.deepEqual(latestState, { transition: "resolved", state_after: "resolved" });
    const replay = await service.prune({ now: retentionTime, maxBatches: 2 });
    assert.equal(replay.completed, true);
    assert.deepEqual(replay.deleted, { snapshots: 0, rollups: 0, evaluations: 0, events: 0 });
  });
});

function harness(pool, version, clock, overrides = {}) {
  const policy = loadOperationalObservabilityPolicy({
    OUTREACH_OBSERVABILITY_POLICY_JSON: JSON.stringify(policyInput(version, overrides))
  });
  const repository = new OperationalObservabilityRepository({ pool, policy });
  const service = createOperationalObservabilityService({ repository, policy, clock });
  return { service, repository, policy };
}

function policyInput(version, overrides = {}) {
  return {
    schemaVersion: 1,
    policyVersion: version,
    enabled: true,
    approvedPolicyReference: `change-${version}`,
    sampleIntervalSeconds: 60,
    rollupBucketSeconds: 300,
    snapshotRetentionHours: 1,
    rollupRetentionDays: 7,
    alertEvidenceRetentionDays: 30,
    maximumClockSkewSeconds: 30,
    pruneBatchSize: 20,
    maximumSnapshots: 60,
    maximumRollupBucketsPerMetric: 100,
    maximumEvaluationsPerRule: 60,
    maximumEventsPerRule: 20,
    rules: [rule()],
    ...overrides
  };
}

function rule(overrides = {}) {
  return {
    id: "event-lag",
    metric: "outreach_oldest_event_seconds",
    comparator: "greater_than",
    threshold: 300,
    severity: "sev2",
    cooldownSeconds: 300,
    ...overrides
  };
}

async function policyCounts(pool, policyDigest) {
  const result = await pool.query(
    `SELECT
       (SELECT count(*)::int FROM operational_metric_snapshots WHERE policy_digest=$1) AS snapshots,
       (SELECT count(*)::int FROM operational_metric_samples s JOIN operational_metric_snapshots m USING (snapshot_digest) WHERE m.policy_digest=$1) AS samples,
       (SELECT count(*)::int FROM operational_metric_rollups WHERE policy_digest=$1) AS rollups,
       (SELECT count(*)::int FROM operational_alert_evaluations WHERE policy_digest=$1) AS evaluations,
       (SELECT count(*)::int FROM operational_alert_events WHERE policy_digest=$1) AS events`,
    [policyDigest]
  );
  return result.rows[0];
}

async function explain(pool, sql, values) {
  const result = await pool.query(`EXPLAIN (COSTS OFF,FORMAT JSON) ${sql}`, values);
  return JSON.stringify(result.rows[0]["QUERY PLAN"]);
}

async function drainAlertProjection(pool) {
  const repository = new OperationalAlertDeliveryRepository({ pool });
  for (let batch = 0; batch < 100; batch += 1) {
    const result = await repository.projectBatch({ limit: 500, maximumBacklog: 100_000 });
    if (!result.hasMore) return;
  }
  throw new Error("alert delivery projection did not drain its bounded test fixture");
}
