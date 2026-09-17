import assert from "node:assert/strict";
import test from "node:test";

import pg from "pg";

import { createOperationalObservabilityService } from "../src/application/operational-observability-service.mjs";
import { loadOperationalObservabilityPolicy } from "../src/domain/operational-observability-policy.mjs";
import { OperationalAlertDeliveryRepository } from "../src/infrastructure/operational-alert-delivery-repository.mjs";
import { OperationalObservabilityRepository } from "../src/infrastructure/operational-observability-repository.mjs";
import { runMigrations } from "../src/infrastructure/postgres.mjs";
import { startPostgresTestCluster } from "./helpers/postgres-test-cluster.mjs";

const { Pool } = pg;

test("alert event cursor projects a bounded idempotent external-delivery outbox", async (t) => {
  const cluster = await startPostgresTestCluster();
  const database = await cluster.createDatabase();
  const pool = new Pool({ connectionString: database.url, max: 12 });
  t.after(async () => {
    await pool.end();
    await cluster.stop();
  });
  await runMigrations(pool);

  const base = new Date("2026-07-15T08:00:00.000Z");
  let clock = new Date(base);
  const policy = loadPolicy();
  const observabilityRepository = new OperationalObservabilityRepository({ pool, policy });
  const service = createOperationalObservabilityService({
    repository: observabilityRepository,
    policy,
    clock: () => clock
  });
  const capture = async (offsetSeconds, value) => {
    clock = new Date(base.getTime() + offsetSeconds * 1_000);
    return service.capture({
      observedAt: clock,
      metrics: { outreach_oldest_event_seconds: value }
    });
  };
  await capture(0, 301);
  await capture(300, 301);
  await capture(360, 0);

  const delivery = new OperationalAlertDeliveryRepository({ pool });
  await pool.query(`CREATE FUNCTION delay_alert_projection_insert()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      PERFORM pg_sleep(0.05);
      RETURN NEW;
    END;
  $$`);
  await pool.query(`CREATE TRIGGER delay_alert_projection_insert
    BEFORE INSERT ON operational_alert_delivery_outbox
    FOR EACH ROW EXECUTE FUNCTION delay_alert_projection_insert()`);
  const concurrent = await Promise.all(Array.from({ length: 8 }, () => delivery.projectBatch({
    limit: 2,
    maximumBacklog: 10
  })));
  await pool.query("DROP TRIGGER delay_alert_projection_insert ON operational_alert_delivery_outbox");
  await pool.query("DROP FUNCTION delay_alert_projection_insert()");
  assert.equal(concurrent.some(({ contended }) => contended), true);
  while ((await delivery.projectBatch({ limit: 2, maximumBacklog: 10 })).hasMore) {
    // Bounded batches intentionally drain the finite three-row fixture.
  }
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM operational_alert_delivery_outbox")).rows[0].count, 3);
  assert.equal((await pool.query(
    "SELECT bool_and(delivery_key=event_key) AS idempotent FROM operational_alert_delivery_outbox"
  )).rows[0].idempotent, true);

  const cursorBeforeReplay = Number((await delivery.status()).last_sequence_id);
  await pool.query(
    "UPDATE operational_alert_delivery_projection SET last_sequence_id=0 WHERE projector_key='external-alert-router-v1'"
  );
  const replay = await delivery.projectBatch({ limit: 10, maximumBacklog: 10 });
  assert.equal(replay.scanned, 3);
  assert.equal(replay.projected, 0);
  assert.equal(replay.cursor, cursorBeforeReplay);
  assert.equal(replay.backlog, 3);

  await capture(420, 301);
  await pool.query(`CREATE FUNCTION fail_alert_projection_cursor_update()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.last_sequence_id > OLD.last_sequence_id THEN
        RAISE EXCEPTION 'simulated projection crash';
      END IF;
      RETURN NEW;
    END;
  $$`);
  await pool.query(`CREATE TRIGGER fail_alert_projection_cursor_update
    BEFORE UPDATE ON operational_alert_delivery_projection
    FOR EACH ROW EXECUTE FUNCTION fail_alert_projection_cursor_update()`);
  await assert.rejects(
    () => delivery.projectBatch({ limit: 10, maximumBacklog: 10 }),
    /simulated projection crash/u
  );
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM operational_alert_delivery_outbox")).rows[0].count, 3);
  assert.equal(Number((await delivery.status()).last_sequence_id), cursorBeforeReplay);
  await pool.query("DROP TRIGGER fail_alert_projection_cursor_update ON operational_alert_delivery_projection");
  await pool.query("DROP FUNCTION fail_alert_projection_cursor_update()");
  assert.equal((await delivery.projectBatch({ limit: 10, maximumBacklog: 10 })).projected, 1);

  await assert.rejects(
    () => pool.query("UPDATE operational_alert_delivery_outbox SET severity='sev1'"),
    (error) => error.code === "55000"
  );

  await capture(480, 0);
  const bounded = await delivery.projectBatch({ limit: 10, maximumBacklog: 4 });
  assert.equal(bounded.backpressured, true);
  assert.equal(bounded.projected, 0);
  assert.equal(bounded.backlog, 4);

  const attemptAt = new Date(Date.now() + 1_000);
  const claimed = await delivery.claimDelivery({
    workerId: "external-router:test:1",
    now: attemptAt,
    leaseSeconds: 30
  });
  assert.equal(claimed.attempt_count, 1);
  assert.equal(claimed.status, "leased");
  const failed = await delivery.recordDeliveryFailure({
    deliveryKey: claimed.delivery_key,
    workerId: "external-router:test:1",
    errorCode: "ROUTER_TIMEOUT",
    now: new Date(attemptAt.getTime() + 1_000),
    retryAt: new Date(attemptAt.getTime() + 2_000),
    maximumAttempts: 1
  });
  assert.equal(failed.deadLetter, true);
  assert.equal(Number((await delivery.status()).dead_letter_count), 1);
  await delivery.requeueDeadLetter({
    deliveryKey: claimed.delivery_key,
    availableAt: new Date(attemptAt.getTime() + 2_000)
  });
  const reclaimed = await delivery.claimDelivery({
    workerId: "external-router:test:2",
    now: new Date(attemptAt.getTime() + 3_000),
    leaseSeconds: 30
  });
  assert.equal(reclaimed.delivery_key, claimed.delivery_key);
  const acknowledged = await delivery.acknowledgeDelivery({
    deliveryKey: reclaimed.delivery_key,
    workerId: "external-router:test:2",
    now: new Date(attemptAt.getTime() + 4_000)
  });
  assert.equal(acknowledged.acknowledged, true);
  assert.equal(Number(acknowledged.outstanding_count), 3);
  assert.equal(Number(acknowledged.delivered_count), 1);

  const resumed = await delivery.projectBatch({ limit: 10, maximumBacklog: 4 });
  assert.equal(resumed.projected, 1);
  assert.equal(resumed.backlog, 4);
  await capture(540, 301);
  const stoppedAtCap = await delivery.projectBatch({ limit: 10, maximumBacklog: 4 });
  assert.equal(stoppedAtCap.backpressured, true);
  assert.equal(stoppedAtCap.projected, 0);

  let releaseExclusive;
  let announceExclusive;
  const exclusiveStarted = new Promise((resolve) => { announceExclusive = resolve; });
  const exclusiveRelease = new Promise((resolve) => { releaseExclusive = resolve; });
  const holder = observabilityRepository.tryRunRuntimeExclusive(async () => {
    announceExclusive();
    await exclusiveRelease;
    return "completed";
  });
  await exclusiveStarted;
  const competingRepository = new OperationalObservabilityRepository({ pool, policy });
  assert.deepEqual(await competingRepository.tryRunRuntimeExclusive(async () => "must-not-run"), { acquired: false });
  releaseExclusive();
  assert.deepEqual(await holder, { acquired: true, value: "completed" });
});

function loadPolicy() {
  return loadOperationalObservabilityPolicy({
    OUTREACH_OBSERVABILITY_POLICY_JSON: JSON.stringify({
      schemaVersion: 1,
      policyVersion: "alert-delivery-integration-v1",
      enabled: true,
      approvedPolicyReference: "change-alert-delivery-integration",
      sampleIntervalSeconds: 60,
      rollupBucketSeconds: 300,
      snapshotRetentionHours: 1,
      rollupRetentionDays: 7,
      alertEvidenceRetentionDays: 30,
      maximumClockSkewSeconds: 30,
      pruneBatchSize: 20,
      maximumSnapshots: 100,
      maximumRollupBucketsPerMetric: 100,
      maximumEvaluationsPerRule: 100,
      maximumEventsPerRule: 100,
      rules: [{
        id: "event-lag",
        metric: "outreach_oldest_event_seconds",
        comparator: "greater_than",
        threshold: 300,
        severity: "sev2",
        cooldownSeconds: 300
      }]
    })
  });
}
