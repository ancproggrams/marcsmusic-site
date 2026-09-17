import { ApplicationError } from "../errors.mjs";
import {
  OPERATIONAL_METRIC_DEFINITIONS,
  evaluateOperationalAlertCondition,
  operationalEvidenceKey,
  requireEnabledOperationalObservabilityPolicy
} from "../domain/operational-observability-policy.mjs";
import { acquireTransactionAdvisoryLock, databaseLimits, withTransaction } from "./postgres.mjs";

export class OperationalObservabilityRepository {
  constructor({ pool, policy, database = {} }) {
    if (!pool?.query || !pool?.connect) throw new TypeError("A PostgreSQL pool is required");
    this.pool = pool;
    this.policy = requireEnabledOperationalObservabilityPolicy(policy);
    this.databaseLimits = databaseLimits({ ...(pool.options ?? {}), ...database });
  }

  async tryRunRuntimeExclusive(work) {
    if (typeof work !== "function") throw new TypeError("work must be a function");
    const client = await this.pool.connect();
    const lockName = `operational-observability-runtime:${this.policy.digest}`;
    let acquired = false;
    try {
      const result = await client.query(
        "SELECT pg_try_advisory_lock(hashtext($1)) AS acquired",
        [lockName]
      );
      acquired = result.rows[0]?.acquired === true;
      if (!acquired) return Object.freeze({ acquired: false });
      return Object.freeze({ acquired: true, value: await work() });
    } finally {
      if (acquired) {
        await client.query("SELECT pg_advisory_unlock(hashtext($1))", [lockName]).catch(() => {});
      }
      client.release();
    }
  }

  async recordSnapshot(snapshot) {
    assertSnapshotContract(snapshot, this.policy);
    const metricRows = Object.entries(snapshot.metrics).map(([metricKey, metricValue]) => ({
      metric_key: metricKey,
      metric_value: metricValue
    }));
    return withTransaction(this.pool, async (client) => {
      const inserted = await client.query(
        `INSERT INTO operational_metric_snapshots
          (snapshot_digest,policy_digest,policy_version,observed_at,rollup_bucket_at,metric_count)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT DO NOTHING
         RETURNING snapshot_digest,observed_at,rollup_bucket_at,metric_count,created_at`,
        [
          snapshot.snapshotDigest,
          this.policy.digest,
          this.policy.policyVersion,
          snapshot.observedAt,
          snapshot.rollupBucketAt,
          metricRows.length
        ]
      );
      if (!inserted.rowCount) {
        const existing = await client.query(
          `SELECT snapshot_digest,observed_at,rollup_bucket_at,metric_count,created_at
             FROM operational_metric_snapshots
            WHERE policy_digest=$1 AND observed_at=$2`,
          [this.policy.digest, snapshot.observedAt]
        );
        if (existing.rows[0]?.snapshot_digest !== snapshot.snapshotDigest) {
          throw observabilityError(
            "OBSERVABILITY_SNAPSHOT_BUCKET_COLLISION",
            "Metric collection bucket is already bound to different evidence"
          );
        }
        return snapshotResult(existing.rows[0], true);
      }

      const snapshotUsage = await client.query(
        "SELECT snapshot_count FROM operational_observability_policy_usage WHERE policy_digest=$1",
        [this.policy.digest]
      );
      if (Number(snapshotUsage.rows[0]?.snapshot_count) > this.policy.maximumSnapshots) {
        throw observabilityError(
          "OBSERVABILITY_METRIC_CAPACITY_BACKPRESSURE",
          "Snapshot capacity is exhausted; run bounded observability retention before collecting again",
          true
        );
      }

      await client.query(
        `INSERT INTO operational_metric_samples (snapshot_digest,metric_key,metric_value)
         SELECT $1,x.metric_key,x.metric_value
           FROM jsonb_to_recordset($2::jsonb) AS x(metric_key text,metric_value double precision)`,
        [snapshot.snapshotDigest, JSON.stringify(metricRows)]
      );
      await client.query(
        `INSERT INTO operational_metric_rollups
          (policy_digest,policy_version,bucket_at,metric_key,sample_count,value_sum,value_min,value_max,
           value_last,first_observed_at,last_observed_at)
         SELECT $1,$2,$3,x.metric_key,1,x.metric_value,x.metric_value,x.metric_value,
                x.metric_value,$4,$4
           FROM jsonb_to_recordset($5::jsonb) AS x(metric_key text,metric_value double precision)
         ON CONFLICT (policy_digest,bucket_at,metric_key) DO UPDATE SET
           sample_count=operational_metric_rollups.sample_count+1,
           value_sum=operational_metric_rollups.value_sum+EXCLUDED.value_sum,
           value_min=least(operational_metric_rollups.value_min,EXCLUDED.value_min),
           value_max=greatest(operational_metric_rollups.value_max,EXCLUDED.value_max),
           value_last=CASE
             WHEN EXCLUDED.last_observed_at >= operational_metric_rollups.last_observed_at THEN EXCLUDED.value_last
             ELSE operational_metric_rollups.value_last
           END,
           first_observed_at=least(operational_metric_rollups.first_observed_at,EXCLUDED.first_observed_at),
           last_observed_at=greatest(operational_metric_rollups.last_observed_at,EXCLUDED.last_observed_at),
           updated_at=now()`,
        [this.policy.digest, this.policy.policyVersion, snapshot.rollupBucketAt, snapshot.observedAt, JSON.stringify(metricRows)]
      );

      const rollupCapacity = await client.query(
        `SELECT metric_key,rollup_bucket_count
           FROM operational_observability_metric_usage
          WHERE policy_digest=$1 AND metric_key=ANY($2::text[]) AND rollup_bucket_count>$3
          LIMIT 1`,
        [this.policy.digest, metricRows.map(({ metric_key: metricKey }) => metricKey), this.policy.maximumRollupBucketsPerMetric]
      );
      if (rollupCapacity.rowCount) {
        throw observabilityError(
          "OBSERVABILITY_METRIC_CAPACITY_BACKPRESSURE",
          `Rollup capacity is exhausted for ${rollupCapacity.rows[0].metric_key}; run bounded observability retention`,
          true
        );
      }
      return snapshotResult(inserted.rows[0], false);
    });
  }

  async evaluateRule({ snapshotDigest, rule }) {
    const configuredRule = assertConfiguredRule(rule, this.policy);
    const evaluationKey = operationalEvidenceKey({
      schemaVersion: 1,
      policyDigest: this.policy.digest,
      ruleId: configuredRule.id,
      snapshotDigest
    });
    return withTransaction(this.pool, async (client) => {
      await acquireTransactionAdvisoryLock(
        client,
        `operational-alert:${this.policy.digest}:${configuredRule.id}`,
        this.databaseLimits
      );
      const replay = await client.query(
        "SELECT * FROM operational_alert_evaluations WHERE evaluation_key=$1",
        [evaluationKey]
      );
      if (replay.rowCount) return evaluationResult(replay.rows[0], true);

      const evidence = await client.query(
        `SELECT s.snapshot_digest,s.observed_at,m.metric_value
           FROM operational_metric_snapshots s
           JOIN operational_metric_samples m ON m.snapshot_digest=s.snapshot_digest
          WHERE s.snapshot_digest=$1 AND s.policy_digest=$2 AND m.metric_key=$3`,
        [snapshotDigest, this.policy.digest, configuredRule.metric]
      );
      if (!evidence.rowCount) {
        throw observabilityError(
          "OBSERVABILITY_SNAPSHOT_EVIDENCE_MISSING",
          "Alert evaluation requires a retained snapshot and its configured metric"
        );
      }
      const observedAt = new Date(evidence.rows[0].observed_at);
      const observedValue = Number(evidence.rows[0].metric_value);
      const breached = evaluateOperationalAlertCondition(
        configuredRule.comparator,
        observedValue,
        configuredRule.threshold
      );
      const lastEvaluation = await client.query(
        `SELECT observed_at
           FROM operational_alert_evaluations
          WHERE policy_digest=$1 AND rule_id=$2
          ORDER BY observed_at DESC,evaluation_key DESC
          LIMIT 1`,
        [this.policy.digest, configuredRule.id]
      );
      const lastEvent = await client.query(
        `SELECT *
           FROM operational_alert_events
          WHERE policy_digest=$1 AND rule_id=$2
          ORDER BY occurred_at DESC,sequence_id DESC
          LIMIT 1`,
        [this.policy.digest, configuredRule.id]
      );
      const decision = decideAlertTransition({
        evaluationKey,
        observedAt,
        breached,
        rule: configuredRule,
        lastEvaluation: lastEvaluation.rows[0],
        lastEvent: lastEvent.rows[0]
      });
      const eventKey = decision.transition
        ? operationalEvidenceKey({
          schemaVersion: 1,
          evaluationKey,
          incidentKey: decision.incidentKey,
          transition: decision.transition
        })
        : null;
      await client.query(
        `INSERT INTO operational_alert_evaluations
          (evaluation_key,policy_digest,policy_version,rule_id,snapshot_digest,metric_key,comparator,
           threshold,observed_value,breached,decision,incident_key,event_key,next_notification_at,observed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          evaluationKey,
          this.policy.digest,
          this.policy.policyVersion,
          configuredRule.id,
          snapshotDigest,
          configuredRule.metric,
          configuredRule.comparator,
          configuredRule.threshold,
          observedValue,
          breached,
          decision.decision,
          decision.incidentKey,
          eventKey,
          decision.nextNotificationAt,
          observedAt
        ]
      );
      if (decision.transition) {
        const stateAfter = decision.transition === "resolved" ? "resolved" : "open";
        const evidenceDigest = operationalEvidenceKey({
          schemaVersion: 1,
          eventKey,
          evaluationKey,
          incidentKey: decision.incidentKey,
          policyDigest: this.policy.digest,
          policyVersion: this.policy.policyVersion,
          ruleId: configuredRule.id,
          transition: decision.transition,
          stateAfter,
          severity: configuredRule.severity,
          metric: configuredRule.metric,
          comparator: configuredRule.comparator,
          threshold: configuredRule.threshold,
          observedValue,
          snapshotDigest,
          observedAt: observedAt.toISOString()
        });
        await client.query(
          `INSERT INTO operational_alert_events
            (event_key,evaluation_key,incident_key,evidence_digest,policy_digest,policy_version,rule_id,
             transition,state_after,severity,metric_key,comparator,threshold,observed_value,
             snapshot_digest,observed_at,occurred_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16)`,
          [
            eventKey,
            evaluationKey,
            decision.incidentKey,
            evidenceDigest,
            this.policy.digest,
            this.policy.policyVersion,
            configuredRule.id,
            decision.transition,
            stateAfter,
            configuredRule.severity,
            configuredRule.metric,
            configuredRule.comparator,
            configuredRule.threshold,
            observedValue,
            snapshotDigest,
            observedAt
          ]
        );
      }
      const usage = await client.query(
        `SELECT evaluation_count,event_count
           FROM operational_observability_alert_usage
          WHERE policy_digest=$1 AND rule_id=$2`,
        [this.policy.digest, configuredRule.id]
      );
      if (Number(usage.rows[0]?.evaluation_count) > this.policy.maximumEvaluationsPerRule
        || Number(usage.rows[0]?.event_count) > this.policy.maximumEventsPerRule) {
        throw observabilityError(
          "OBSERVABILITY_ALERT_CAPACITY_BACKPRESSURE",
          "Alert evidence capacity is exhausted; run bounded observability retention before evaluating again",
          true
        );
      }
      const stored = await client.query(
        "SELECT * FROM operational_alert_evaluations WHERE evaluation_key=$1",
        [evaluationKey]
      );
      return evaluationResult(stored.rows[0], false);
    });
  }

  async pruneRetention({ now = new Date(), maxBatches = 10 } = {}) {
    const referenceTime = validDate(now, "now");
    assertInteger(maxBatches, 1, 1_000, "maxBatches");
    const deleted = { snapshots: 0, rollups: 0, evaluations: 0, events: 0 };
    let batches = 0;
    let completed = false;
    while (batches < maxBatches) {
      const batch = await withTransaction(this.pool, async (client) => {
        await acquireTransactionAdvisoryLock(
          client,
          `operational-observability-prune:${this.policy.digest}`,
          this.databaseLimits
        );
        const metrics = await pruneMetricRows(client, this.policy, referenceTime, this.policy.pruneBatchSize);
        const alerts = { evaluations: 0, events: 0 };
        for (const rule of this.policy.rules) {
          const pruned = await pruneAlertRows(
            client,
            this.policy,
            referenceTime,
            rule.id,
            this.policy.pruneBatchSize
          );
          alerts.evaluations += pruned.evaluations;
          alerts.events += pruned.events;
        }
        await pruneEmptyUsageRows(client, this.policy.digest, this.policy.pruneBatchSize);
        return { ...metrics, ...alerts };
      });
      batches += 1;
      for (const key of Object.keys(deleted)) deleted[key] += batch[key];
      if (Object.values(batch).every((count) => count === 0)) {
        completed = true;
        break;
      }
    }
    return Object.freeze({
      completed,
      batches,
      deleted: Object.freeze(deleted)
    });
  }

  async listAlertEvents({ afterSequenceId = 0, limit = 100 } = {}) {
    assertInteger(afterSequenceId, 0, Number.MAX_SAFE_INTEGER, "afterSequenceId");
    assertInteger(limit, 1, 500, "limit");
    const result = await this.pool.query(
      `SELECT sequence_id,event_key,evaluation_key,incident_key,evidence_digest,policy_digest,policy_version,
              rule_id,transition,state_after,severity,metric_key,comparator,threshold,observed_value,
              snapshot_digest,observed_at,occurred_at,created_at
         FROM operational_alert_events
        WHERE policy_digest=$1 AND sequence_id>$2
        ORDER BY sequence_id
        LIMIT $3`,
      [this.policy.digest, afterSequenceId, limit]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ ...row })));
  }

  async readRollups({ metricKey, from, to, limit = 1_000 }) {
    if (!OPERATIONAL_METRIC_DEFINITIONS[metricKey]) {
      throw observabilityError("OBSERVABILITY_METRIC_NOT_ALLOWED", "Rollup query metric is not in the finite registry");
    }
    const start = validDate(from, "from");
    const end = validDate(to, "to");
    if (end <= start) throw observabilityError("OBSERVABILITY_TIME_RANGE_INVALID", "Rollup query requires to after from");
    assertInteger(limit, 1, 1_000, "limit");
    const result = await this.pool.query(
      `SELECT bucket_at,metric_key,sample_count,value_sum,value_min,value_max,value_last,
              first_observed_at,last_observed_at
         FROM operational_metric_rollups
        WHERE policy_digest=$1 AND metric_key=$2 AND bucket_at>=$3 AND bucket_at<$4
        ORDER BY bucket_at
        LIMIT $5`,
      [this.policy.digest, metricKey, start, end, limit]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ ...row })));
  }
}

function decideAlertTransition({ evaluationKey, observedAt, breached, rule, lastEvaluation, lastEvent }) {
  const previousObservedAt = lastEvaluation?.observed_at ? new Date(lastEvaluation.observed_at) : null;
  if (previousObservedAt && observedAt < previousObservedAt) {
    return Object.freeze({
      decision: "stale",
      transition: null,
      incidentKey: lastEvent?.state_after === "open" ? lastEvent.incident_key : null,
      nextNotificationAt: null
    });
  }
  const isOpen = lastEvent?.state_after === "open";
  if (!breached) {
    if (!isOpen) return Object.freeze({ decision: "healthy", transition: null, incidentKey: null, nextNotificationAt: null });
    return Object.freeze({
      decision: "resolved",
      transition: "resolved",
      incidentKey: lastEvent.incident_key,
      nextNotificationAt: null
    });
  }
  if (!isOpen) {
    return Object.freeze({
      decision: "opened",
      transition: "opened",
      incidentKey: evaluationKey,
      nextNotificationAt: new Date(observedAt.getTime() + rule.cooldownSeconds * 1_000)
    });
  }
  const nextNotificationAt = new Date(new Date(lastEvent.occurred_at).getTime() + rule.cooldownSeconds * 1_000);
  if (observedAt >= nextNotificationAt) {
    return Object.freeze({
      decision: "reminder",
      transition: "reminder",
      incidentKey: lastEvent.incident_key,
      nextNotificationAt: new Date(observedAt.getTime() + rule.cooldownSeconds * 1_000)
    });
  }
  return Object.freeze({
    decision: "deduplicated",
    transition: null,
    incidentKey: lastEvent.incident_key,
    nextNotificationAt
  });
}

async function pruneMetricRows(client, policy, referenceTime, batchSize) {
  const snapshotCutoff = new Date(referenceTime.getTime() - policy.snapshotRetentionHours * 3_600_000);
  const expiredSnapshots = await client.query(
    `WITH candidates AS (
       SELECT snapshot_digest
         FROM operational_metric_snapshots
        WHERE policy_digest=$1 AND observed_at<$2
        ORDER BY observed_at,snapshot_digest
        LIMIT $3
     )
     DELETE FROM operational_metric_snapshots s
      USING candidates c
      WHERE s.snapshot_digest=c.snapshot_digest`,
    [policy.digest, snapshotCutoff, batchSize]
  );
  let snapshotCount = expiredSnapshots.rowCount;
  const snapshotCapacity = await client.query(
    "SELECT snapshot_count FROM operational_observability_policy_usage WHERE policy_digest=$1",
    [policy.digest]
  );
  const snapshotCapacityPrune = capacityPruneCount(
    Number(snapshotCapacity.rows[0]?.snapshot_count ?? 0),
    policy.maximumSnapshots,
    batchSize - snapshotCount
  );
  if (snapshotCapacityPrune > 0) {
    const excessiveSnapshots = await client.query(
      `WITH candidates AS (
         SELECT snapshot_digest
           FROM operational_metric_snapshots
          WHERE policy_digest=$1
          ORDER BY observed_at,snapshot_digest
          LIMIT $2
       )
       DELETE FROM operational_metric_snapshots s
        USING candidates c
        WHERE s.snapshot_digest=c.snapshot_digest`,
      [policy.digest, snapshotCapacityPrune]
    );
    snapshotCount += excessiveSnapshots.rowCount;
  }

  const rollupCutoff = new Date(referenceTime.getTime() - policy.rollupRetentionDays * 86_400_000);
  const expiredRollups = await client.query(
    `WITH candidates AS (
       SELECT policy_digest,bucket_at,metric_key
         FROM operational_metric_rollups
        WHERE policy_digest=$1 AND bucket_at<$2
        ORDER BY bucket_at,metric_key
        LIMIT $3
     )
     DELETE FROM operational_metric_rollups r
      USING candidates c
      WHERE r.policy_digest=c.policy_digest AND r.bucket_at=c.bucket_at AND r.metric_key=c.metric_key`,
    [policy.digest, rollupCutoff, batchSize]
  );
  let rollupCount = expiredRollups.rowCount;
  if (rollupCount < batchSize) {
    const excessiveMetrics = await client.query(
      `SELECT metric_key,rollup_bucket_count
         FROM operational_observability_metric_usage
        WHERE policy_digest=$1 AND rollup_bucket_count>=$2
        ORDER BY metric_key`,
      [policy.digest, policy.maximumRollupBucketsPerMetric]
    );
    for (const usage of excessiveMetrics.rows) {
      if (rollupCount >= batchSize) break;
      const capacityPrune = capacityPruneCount(
        Number(usage.rollup_bucket_count),
        policy.maximumRollupBucketsPerMetric,
        batchSize - rollupCount
      );
      const excessiveRollups = await client.query(
        `WITH candidates AS (
           SELECT policy_digest,bucket_at,metric_key
             FROM operational_metric_rollups
            WHERE policy_digest=$1 AND metric_key=$2
            ORDER BY bucket_at
            LIMIT $3
         )
         DELETE FROM operational_metric_rollups r
          USING candidates c
          WHERE r.policy_digest=c.policy_digest AND r.bucket_at=c.bucket_at AND r.metric_key=c.metric_key`,
        [policy.digest, usage.metric_key, capacityPrune]
      );
      rollupCount += excessiveRollups.rowCount;
    }
  }
  return Object.freeze({ snapshots: snapshotCount, rollups: rollupCount });
}

async function pruneAlertRows(client, policy, referenceTime, ruleId, batchSize) {
  const cutoff = new Date(referenceTime.getTime() - policy.alertEvidenceRetentionDays * 86_400_000);
  const expiredEvaluations = await client.query(
    `WITH candidates AS (
       SELECT evaluation_key
         FROM operational_alert_evaluations
        WHERE policy_digest=$1 AND rule_id=$2 AND observed_at<$3
        ORDER BY observed_at,evaluation_key
        LIMIT $4
     )
     DELETE FROM operational_alert_evaluations e
      USING candidates c
      WHERE e.evaluation_key=c.evaluation_key`,
    [policy.digest, ruleId, cutoff, batchSize]
  );
  let evaluationCount = expiredEvaluations.rowCount;
  const usage = await client.query(
    `SELECT evaluation_count,event_count
       FROM operational_observability_alert_usage
      WHERE policy_digest=$1 AND rule_id=$2`,
    [policy.digest, ruleId]
  );
  const evaluationCapacityPrune = capacityPruneCount(
    Number(usage.rows[0]?.evaluation_count ?? 0),
    policy.maximumEvaluationsPerRule,
    batchSize - evaluationCount
  );
  if (evaluationCapacityPrune > 0) {
    const excessiveEvaluations = await client.query(
      `WITH candidates AS (
         SELECT evaluation_key
           FROM operational_alert_evaluations
          WHERE policy_digest=$1 AND rule_id=$2
          ORDER BY observed_at,evaluation_key
          LIMIT $3
       )
       DELETE FROM operational_alert_evaluations e
        USING candidates c
        WHERE e.evaluation_key=c.evaluation_key`,
      [policy.digest, ruleId, evaluationCapacityPrune]
    );
    evaluationCount += excessiveEvaluations.rowCount;
  }

  const expiredEvents = await client.query(
    `WITH candidates AS (
       SELECT sequence_id
         FROM operational_alert_events candidate
        WHERE candidate.policy_digest=$1
          AND candidate.rule_id=$2
          AND candidate.occurred_at<$3
          AND candidate.sequence_id <= COALESCE((
            SELECT last_sequence_id
              FROM operational_alert_delivery_projection
             WHERE projector_key='external-alert-router-v1'
          ),0)
          AND EXISTS (
            SELECT 1
              FROM operational_alert_events newer
             WHERE newer.policy_digest=candidate.policy_digest
               AND newer.rule_id=candidate.rule_id
               AND (newer.occurred_at,newer.sequence_id)>(candidate.occurred_at,candidate.sequence_id)
          )
        ORDER BY occurred_at,sequence_id
        LIMIT $4
     )
     DELETE FROM operational_alert_events e
      USING candidates c
      WHERE e.sequence_id=c.sequence_id`,
    [policy.digest, ruleId, cutoff, batchSize]
  );
  let eventCount = expiredEvents.rowCount;
  const refreshedUsage = await client.query(
    `SELECT event_count
       FROM operational_observability_alert_usage
      WHERE policy_digest=$1 AND rule_id=$2`,
    [policy.digest, ruleId]
  );
  const eventCapacityPrune = capacityPruneCount(
    Number(refreshedUsage.rows[0]?.event_count ?? 0),
    policy.maximumEventsPerRule,
    batchSize - eventCount
  );
  if (eventCapacityPrune > 0) {
    const excessiveEvents = await client.query(
      `WITH candidates AS (
         SELECT sequence_id
           FROM operational_alert_events candidate
          WHERE candidate.policy_digest=$1
            AND candidate.rule_id=$2
            AND candidate.sequence_id <= COALESCE((
              SELECT last_sequence_id
                FROM operational_alert_delivery_projection
               WHERE projector_key='external-alert-router-v1'
            ),0)
            AND EXISTS (
              SELECT 1
                FROM operational_alert_events newer
               WHERE newer.policy_digest=candidate.policy_digest
                 AND newer.rule_id=candidate.rule_id
                 AND (newer.occurred_at,newer.sequence_id)>(candidate.occurred_at,candidate.sequence_id)
            )
          ORDER BY candidate.occurred_at,candidate.sequence_id
          LIMIT $3
       )
       DELETE FROM operational_alert_events e
        USING candidates c
        WHERE e.sequence_id=c.sequence_id`,
      [policy.digest, ruleId, eventCapacityPrune]
    );
    eventCount += excessiveEvents.rowCount;
  }
  return Object.freeze({ evaluations: evaluationCount, events: eventCount });
}

async function pruneEmptyUsageRows(client, activePolicyDigest, batchSize) {
  await client.query(
    `WITH candidates AS (
       SELECT policy_digest,metric_key
         FROM operational_observability_metric_usage
        WHERE policy_digest<>$1 AND rollup_bucket_count=0
        ORDER BY updated_at,policy_digest,metric_key
        LIMIT $2
     )
     DELETE FROM operational_observability_metric_usage u
      USING candidates c
      WHERE u.policy_digest=c.policy_digest AND u.metric_key=c.metric_key`,
    [activePolicyDigest, batchSize]
  );
  await client.query(
    `WITH candidates AS (
       SELECT policy_digest,rule_id
         FROM operational_observability_alert_usage
        WHERE policy_digest<>$1 AND evaluation_count=0 AND event_count=0
        ORDER BY updated_at,policy_digest,rule_id
        LIMIT $2
     )
     DELETE FROM operational_observability_alert_usage u
      USING candidates c
      WHERE u.policy_digest=c.policy_digest AND u.rule_id=c.rule_id`,
    [activePolicyDigest, batchSize]
  );
  await client.query(
    `WITH candidates AS (
       SELECT policy_digest
         FROM operational_observability_policy_usage
        WHERE policy_digest<>$1 AND snapshot_count=0
        ORDER BY updated_at,policy_digest
        LIMIT $2
     )
     DELETE FROM operational_observability_policy_usage u
      USING candidates c
      WHERE u.policy_digest=c.policy_digest`,
    [activePolicyDigest, batchSize]
  );
}

function assertSnapshotContract(snapshot, policy) {
  if (!snapshot || snapshot.policyDigest !== policy.digest || snapshot.policyVersion !== policy.policyVersion) {
    throw observabilityError("OBSERVABILITY_POLICY_BINDING_MISMATCH", "Snapshot is not bound to the active observability policy");
  }
  if (!/^[0-9a-f]{64}$/u.test(snapshot.snapshotDigest ?? "")) {
    throw observabilityError("OBSERVABILITY_SNAPSHOT_INVALID", "Snapshot digest is invalid");
  }
  validDate(snapshot.observedAt, "observedAt");
  validDate(snapshot.rollupBucketAt, "rollupBucketAt");
  if (!snapshot.metrics || typeof snapshot.metrics !== "object" || Array.isArray(snapshot.metrics)) {
    throw observabilityError("OBSERVABILITY_SNAPSHOT_INVALID", "Snapshot metrics are invalid");
  }
  for (const [metricKey, metricValue] of Object.entries(snapshot.metrics)) {
    const definition = OPERATIONAL_METRIC_DEFINITIONS[metricKey];
    if (!definition || !Number.isFinite(metricValue)
      || metricValue < definition.minimum || metricValue > definition.maximum
      || (definition.integer && !Number.isInteger(metricValue))) {
      throw observabilityError("OBSERVABILITY_SNAPSHOT_INVALID", "Snapshot contains unsupported metric evidence");
    }
  }
}

function assertConfiguredRule(rule, policy) {
  const configured = policy.rules.find(({ id }) => id === rule?.id);
  if (!configured || operationalEvidenceKey(configured) !== operationalEvidenceKey(rule)) {
    throw observabilityError("OBSERVABILITY_RULE_BINDING_MISMATCH", "Alert rule is not bound to the active policy");
  }
  return configured;
}

function snapshotResult(row, replayed) {
  return Object.freeze({
    snapshotDigest: row.snapshot_digest,
    observedAt: new Date(row.observed_at),
    rollupBucketAt: new Date(row.rollup_bucket_at),
    metricCount: Number(row.metric_count),
    createdAt: new Date(row.created_at),
    replayed
  });
}

function evaluationResult(row, replayed) {
  return Object.freeze({
    evaluationKey: row.evaluation_key,
    ruleId: row.rule_id,
    snapshotDigest: row.snapshot_digest,
    metric: row.metric_key,
    observedValue: Number(row.observed_value),
    threshold: Number(row.threshold),
    breached: row.breached,
    decision: row.decision,
    incidentKey: row.incident_key,
    eventKey: row.event_key,
    nextNotificationAt: row.next_notification_at ? new Date(row.next_notification_at) : null,
    observedAt: new Date(row.observed_at),
    evaluatedAt: new Date(row.evaluated_at),
    replayed
  });
}

function capacityPruneCount(currentCount, maximumCount, remainingBatchCapacity) {
  if (remainingBatchCapacity < 1 || currentCount < maximumCount) return 0;
  const headroom = Math.min(remainingBatchCapacity, maximumCount - 1);
  return Math.min(remainingBatchCapacity, currentCount - (maximumCount - headroom));
}

function validDate(value, label) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) throw observabilityError("OBSERVABILITY_TIMESTAMP_INVALID", `${label} must be a valid timestamp`);
  return date;
}

function assertInteger(value, minimum, maximum, label) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw observabilityError("OBSERVABILITY_ARGUMENT_INVALID", `${label} must be an integer between ${minimum} and ${maximum}`);
  }
}

function observabilityError(code, message, retryable = false) {
  return new ApplicationError(message, { code, statusCode: 503, retryable });
}
