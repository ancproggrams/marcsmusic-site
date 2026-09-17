import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import { businessDayUtcRange } from "../src/application/date-utils.mjs";
import { CryptoBox } from "../src/infrastructure/crypto-box.mjs";
import { OutreachRepository } from "../src/infrastructure/outreach-repository.mjs";
import { createPostgresPool, runMigrations } from "../src/infrastructure/postgres.mjs";
import { startPostgresTestCluster } from "./helpers/postgres-test-cluster.mjs";

let cluster;

before(async () => {
  cluster = await startPostgresTestCluster();
});

after(async () => {
  await cluster?.stop();
});

test("daily report slots are immutable, replica-safe and crash-reclaimable", async (t) => {
  const database = await cluster.createDatabase();
  const pool = createPostgresPool({ url: database.url, ssl: false });
  t.after(async () => pool.end());
  await runMigrations(pool);
  const repository = new OutreachRepository({
    pool,
    cryptoBox: new CryptoBox({
      encryptionKey: Buffer.alloc(32, 31),
      keyVersion: "daily-report-test-v1",
      hashKey: "daily-report-test-hash-key"
    })
  });
  const preliminary = {
    reportDate: "2026-07-15",
    scheduleSlot: "preliminary-2330-v1",
    slotRank: 1,
    dedupeKey: "daily-report:2026-07-15:preliminary-2330-v1"
  };
  const final = {
    reportDate: "2026-07-15",
    scheduleSlot: "final-next-day-v1",
    slotRank: 2,
    dedupeKey: "daily-report:2026-07-15:final-next-day-v1"
  };

  await Promise.all(Array.from({ length: 32 }, (_, index) =>
    repository.enqueueDailyReportWork(index % 2 ? preliminary : final)
  ));
  const stored = await pool.query(
    `SELECT dedupe_key,status,payload FROM work_items
      WHERE kind='create_daily_report' AND entity_id='2026-07-15'
      ORDER BY dedupe_key`
  );
  assert.equal(stored.rowCount, 2, "replicas must create at most two immutable rows per date");
  assert.deepEqual(new Set(stored.rows.map(({ dedupe_key }) => dedupe_key)), new Set([
    preliminary.dedupeKey,
    final.dedupeKey
  ]));

  await pool.query(
    "UPDATE work_items SET status='completed',completed_at='2026-07-15T21:31:00Z' WHERE dedupe_key=$1",
    [preliminary.dedupeKey]
  );
  await repository.enqueueDailyReportWork(preliminary);
  assert.deepEqual(
    (await pool.query("SELECT status,completed_at FROM work_items WHERE dedupe_key=$1", [preliminary.dedupeKey])).rows[0],
    { status: "completed", completed_at: new Date("2026-07-15T21:31:00.000Z") }
  );

  let preliminaryEntered = false;
  const superseded = await repository.withDailyReportProjectionFence(preliminary, async () => {
    preliminaryEntered = true;
  });
  assert.equal(superseded.skipped, true);
  assert.equal(preliminaryEntered, false, "a late preliminary must never overwrite an available final slot");

  let active = 0;
  let maximumActive = 0;
  await Promise.all(["replica-a", "replica-b"].map(() =>
    repository.withDailyReportProjectionFence(final, async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await delay(20);
      active -= 1;
      return "projected";
    })
  ));
  assert.equal(maximumActive, 1, "per-date projection must be serialized across replicas");

  const firstLease = await repository.claimWork("report-worker-a", 120, { kinds: ["create_daily_report"] });
  assert.equal(firstLease.dedupe_key, final.dedupeKey);
  await pool.query("UPDATE work_items SET locked_until=now()-interval '1 second' WHERE id=$1", [firstLease.id]);
  const recoveredLease = await repository.claimWork("report-worker-b", 120, { kinds: ["create_daily_report"] });
  assert.equal(recoveredLease.id, firstLease.id, "a process crash must reclaim the same audit row");
  assert.equal(await repository.completeWork(recoveredLease), true);
  await repository.enqueueDailyReportWork(final);
  assert.equal(
    (await pool.query("SELECT status FROM work_items WHERE dedupe_key=$1", [final.dedupeKey])).rows[0].status,
    "completed",
    "scheduler replay must not rearm completed work"
  );

  const dead = {
    reportDate: "2026-07-14",
    scheduleSlot: "final-next-day-v1",
    slotRank: 2,
    dedupeKey: "daily-report:2026-07-14:final-next-day-v1"
  };
  await repository.enqueueDailyReportWork(dead);
  await pool.query("UPDATE work_items SET status='dead_letter',last_error_code='ESPO_DOWN' WHERE dedupe_key=$1", [dead.dedupeKey]);
  await repository.enqueueDailyReportWork(dead);
  assert.deepEqual(
    (await pool.query("SELECT status,last_error_code FROM work_items WHERE dedupe_key=$1", [dead.dedupeKey])).rows[0],
    { status: "dead_letter", last_error_code: "ESPO_DOWN" },
    "dead-letter evidence must remain visible and immutable"
  );
});

test("daily report queries stay index-bounded at production-like table sizes", { timeout: 60_000 }, async (t) => {
  const database = await cluster.createDatabase();
  const pool = createPostgresPool({
    url: database.url,
    ssl: false,
    statementTimeoutMs: 30_000,
    queryTimeoutMs: 35_000
  });
  t.after(async () => pool.end());
  await runMigrations(pool);
  const repository = new OutreachRepository({
    pool,
    cryptoBox: new CryptoBox({
      encryptionKey: Buffer.alloc(32, 32),
      keyVersion: "daily-report-scale-v1",
      hashKey: "daily-report-scale-hash-key"
    })
  });

  await pool.query(
    `INSERT INTO outcome_events (event_type,provider_event_id,occurred_at)
     SELECT
       (ARRAY['replied','positive_reply','hard_bounce','soft_bounce',
              'unsubscribed','placement_confirmed','delivered','opened'])[(i % 8) + 1],
       'daily-report-scale-event-' || i,
       timestamptz '2026-01-01 00:00:00+00'
         + ((i - 1) / 1000) * interval '1 day'
         + ((i - 1) % 1000) * interval '1 minute'
     FROM generate_series(1,180000) AS generated(i)`
  );
  await pool.query(
    `INSERT INTO work_items
       (kind,entity_type,entity_id,dedupe_key,status,created_at)
     SELECT
       'scale_probe',
       'ScaleProbe',
       i::text,
       'daily-report-scale-work-' || i,
       (ARRAY['pending','processing','completed','failed','dead_letter'])[(i % 5) + 1],
       timestamptz '2026-01-01 00:00:00+00'
         + ((i - 1) / 500) * interval '1 day'
         + ((i - 1) % 500) * interval '1 minute'
     FROM generate_series(1,90000) AS generated(i)`
  );
  await pool.query("VACUUM (ANALYZE) outcome_events");
  await pool.query("VACUUM (ANALYZE) work_items");

  const { start, end } = businessDayUtcRange("2026-04-11");
  const outcomePlan = (await pool.query(
    `EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON)
     SELECT
       count(*) FILTER (WHERE oe.event_type='sent' AND sq.sequence_step=0)::int,
       count(*) FILTER (WHERE oe.event_type='sent' AND sq.sequence_step>0)::int,
       count(*) FILTER (WHERE oe.event_type='replied')::int,
       count(*) FILTER (WHERE oe.event_type='positive_reply')::int,
       count(*) FILTER (WHERE oe.event_type='hard_bounce')::int,
       count(*) FILTER (WHERE oe.event_type='soft_bounce')::int,
       count(*) FILTER (WHERE oe.event_type='unsubscribed')::int,
       count(*) FILTER (WHERE oe.event_type='placement_confirmed')::int
     FROM outcome_events oe
     LEFT JOIN send_queue sq ON sq.id=oe.send_queue_id
     WHERE oe.occurred_at >= $1 AND oe.occurred_at < $2`,
    [start, end]
  )).rows[0]["QUERY PLAN"][0];
  const workPlan = (await pool.query(
    `EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON)
     SELECT
       count(*) FILTER (WHERE status='completed')::int,
       count(*) FILTER (WHERE status='dead_letter')::int
     FROM work_items WHERE created_at >= $1 AND created_at < $2`,
    [start, end]
  )).rows[0]["QUERY PLAN"][0];

  assert.ok(planIndexNames(outcomePlan).has("outcome_events_report_window_idx"), JSON.stringify(outcomePlan));
  assert.ok(planIndexNames(workPlan).has("work_items_report_window_idx"), JSON.stringify(workPlan));
  assert.equal(hasPlanNode(outcomePlan, "Seq Scan", "outcome_events"), false, "outcome history must not be fully scanned");
  assert.equal(hasPlanNode(workPlan, "Seq Scan", "work_items"), false, "work history must not be fully scanned");

  const outcomes = await repository.summaryForDate({ businessDate: "2026-04-11", start, end });
  const jobs = await repository.jobSummaryForDate({ businessDate: "2026-04-11", start, end });
  assert.deepEqual(outcomes, {
    initial_emails_sent: 0,
    follow_ups_sent: 0,
    replies_received: 125,
    positive_replies: 125,
    hard_bounces: 125,
    soft_bounces: 125,
    opt_outs: 125,
    placements: 125
  });
  assert.deepEqual(jobs, { completed_jobs: 100, failed_jobs: 100 });
});

function planIndexNames(plan) {
  const names = new Set();
  visitPlan(plan.Plan, (node) => {
    if (node["Index Name"]) names.add(node["Index Name"]);
  });
  return names;
}

function hasPlanNode(plan, nodeType, relationName) {
  let found = false;
  visitPlan(plan.Plan, (node) => {
    if (node["Node Type"] === nodeType && node["Relation Name"] === relationName) found = true;
  });
  return found;
}

function visitPlan(node, visitor) {
  if (!node) return;
  visitor(node);
  for (const child of node.Plans ?? []) visitPlan(child, visitor);
}
