import assert from "node:assert/strict";
import test from "node:test";

import { createOperationalObservabilityService } from "../src/application/operational-observability-service.mjs";
import { ConfigurationError, loadConfig } from "../src/config.mjs";
import { createContainer } from "../src/container.mjs";
import {
  canonicalDigest,
  evaluateOperationalAlertCondition,
  loadOperationalObservabilityPolicy,
  normalizeOperationalSnapshot,
  requireEnabledOperationalObservabilityPolicy
} from "../src/domain/operational-observability-policy.mjs";

const NOW = new Date("2026-07-15T12:34:56.000Z");

test("observability configuration is disabled by default and malformed policy fails closed", () => {
  const absent = loadOperationalObservabilityPolicy({});
  assert.deepEqual(absent, { enabled: false, configured: false });
  assert.throws(
    () => requireEnabledOperationalObservabilityPolicy(absent),
    (error) => error.code === "OBSERVABILITY_POLICY_DISABLED"
  );
  assert.throws(
    () => loadOperationalObservabilityPolicy({ OUTREACH_OBSERVABILITY_POLICY_JSON: "{" }),
    (error) => error.code === "OBSERVABILITY_POLICY_JSON_INVALID"
  );
  assert.throws(
    () => loadPolicy({ inventedSetting: true }),
    (error) => error.code === "OBSERVABILITY_POLICY_INVALID"
  );
  assert.throws(
    () => loadPolicy({ rollupBucketSeconds: 61 }),
    (error) => error.code === "OBSERVABILITY_POLICY_INVALID"
  );
  assert.throws(
    () => loadPolicy({ snapshotRetentionHours: 48, alertEvidenceRetentionDays: 1 }),
    (error) => error.code === "OBSERVABILITY_POLICY_INVALID"
  );
  assert.throws(
    () => loadPolicy({ rules: [rule(), { ...rule(), metric: "outreach_send_queue_depth" }] }),
    (error) => error.code === "OBSERVABILITY_POLICY_INVALID"
  );
  assert.throws(
    () => loadPolicy({ rules: [rule({ metric: "recipient_email" })] }),
    (error) => error.code === "OBSERVABILITY_POLICY_INVALID"
  );
  assert.throws(
    () => loadPolicy({ rules: [rule({ metric: "outreach_send_queue_depth", threshold: 0.5 })] }),
    (error) => error.code === "OBSERVABILITY_METRIC_VALUE_INVALID"
  );
});

test("runtime configuration requires explicit approval and capacity headroom", () => {
  const disabled = loadConfig(configurationEnvironment());
  assert.equal(disabled.observability.enabled, false);
  assert.equal(disabled.observability.alertRouter.configured, false);

  const configured = loadConfig(configurationEnvironment({
    OUTREACH_OBSERVABILITY_POLICY_JSON: JSON.stringify(policyInput()),
    OUTREACH_OBSERVABILITY_RUNTIME_APPROVAL_REFERENCE: "change-observability-runtime-001",
    OUTREACH_ALERT_ROUTER_ENABLED: "true",
    OUTREACH_ALERT_ROUTER_URL: "https://router.example.test/secret-path",
    OUTREACH_ALERT_ROUTER_TOKEN: "must-never-enter-runtime-config",
    OUTREACH_DASHBOARD_URL: "https://dashboard.example.test/private-tenant"
  }));
  assert.equal(configured.observability.enabled, true);
  assert.equal(configured.observability.captureIntervalMs, 60_000);
  assert.equal(configured.observability.pruneIntervalMs, 300_000);
  assert.equal(configured.observability.capacityHeadroomSamples, 10);
  assert.equal(configured.observability.alertRouter.reason, "external_alert_router_unconfigured");
  assert.deepEqual(configured.observability.alertRouter, {
    mode: "external",
    configured: false,
    available: false,
    reason: "external_alert_router_unconfigured"
  });
  assert.deepEqual(configured.observability.dashboard, {
    mode: "external",
    configured: false,
    available: false,
    reason: "external_dashboard_unconfigured"
  });
  assert.doesNotMatch(
    JSON.stringify({
      alertRouter: configured.observability.alertRouter,
      dashboard: configured.observability.dashboard
    }),
    /secret-path|must-never|private-tenant/u
  );

  assert.throws(
    () => loadConfig(configurationEnvironment({
      OUTREACH_OBSERVABILITY_POLICY_JSON: JSON.stringify(policyInput())
    })),
    (error) => error instanceof ConfigurationError
      && error.issues.some(({ path }) => path[0] === "OUTREACH_OBSERVABILITY_RUNTIME_APPROVAL_REFERENCE")
  );
  assert.throws(
    () => loadConfig(configurationEnvironment({
      OUTREACH_OBSERVABILITY_POLICY_JSON: JSON.stringify(policyInput({ maximumEventsPerRule: 14 })),
      OUTREACH_OBSERVABILITY_RUNTIME_APPROVAL_REFERENCE: "change-observability-runtime-001"
    })),
    (error) => error instanceof ConfigurationError
      && error.issues.some(({ path }) => path.at(-1) === "maximumEventsPerRule")
  );
  assert.throws(
    () => loadConfig(configurationEnvironment({
      OUTREACH_OBSERVABILITY_POLICY_JSON: JSON.stringify(policyInput()),
      OUTREACH_OBSERVABILITY_RUNTIME_APPROVAL_REFERENCE: "change-observability-runtime-001",
      OUTREACH_OBSERVABILITY_PRUNE_INTERVAL_MS: "310000"
    })),
    (error) => error instanceof ConfigurationError
      && error.issues.some(({ path }) => path[0] === "OUTREACH_OBSERVABILITY_PRUNE_INTERVAL_MS")
  );
});

test("container wires the approved policy into collector, durable repository and service", async () => {
  const container = createContainer({
    env: configurationEnvironment({
      OUTREACH_OBSERVABILITY_POLICY_JSON: JSON.stringify(policyInput()),
      OUTREACH_OBSERVABILITY_RUNTIME_APPROVAL_REFERENCE: "change-observability-runtime-001"
    })
  });
  try {
    assert.equal(container.config.observability.enabled, true);
    assert.equal(typeof container.operationalMetricCollector.collect, "function");
    assert.equal(typeof container.operationalObservabilityRepository.tryRunRuntimeExclusive, "function");
    assert.equal(typeof container.operationalObservabilityService.capture, "function");
    assert.equal(typeof container.operationalAlertDeliveryRepository.projectBatch, "function");
  } finally {
    await container.pool.end();
  }
});

test("policy digest and ordered rules are canonical", () => {
  const first = loadPolicy({
    rules: [
      rule({ id: "work-lag", metric: "outreach_oldest_work_seconds" }),
      rule({ id: "event-lag", metric: "outreach_oldest_event_seconds" })
    ]
  });
  const secondInput = policyInput({
    rules: [
      rule({ id: "event-lag", metric: "outreach_oldest_event_seconds" }),
      rule({ id: "work-lag", metric: "outreach_oldest_work_seconds" })
    ]
  });
  const reordered = {
    rules: secondInput.rules,
    maximumEventsPerRule: secondInput.maximumEventsPerRule,
    maximumEvaluationsPerRule: secondInput.maximumEvaluationsPerRule,
    maximumRollupBucketsPerMetric: secondInput.maximumRollupBucketsPerMetric,
    maximumSnapshots: secondInput.maximumSnapshots,
    pruneBatchSize: secondInput.pruneBatchSize,
    maximumClockSkewSeconds: secondInput.maximumClockSkewSeconds,
    alertEvidenceRetentionDays: secondInput.alertEvidenceRetentionDays,
    rollupRetentionDays: secondInput.rollupRetentionDays,
    snapshotRetentionHours: secondInput.snapshotRetentionHours,
    rollupBucketSeconds: secondInput.rollupBucketSeconds,
    sampleIntervalSeconds: secondInput.sampleIntervalSeconds,
    approvedPolicyReference: secondInput.approvedPolicyReference,
    enabled: secondInput.enabled,
    policyVersion: secondInput.policyVersion,
    schemaVersion: secondInput.schemaVersion
  };
  const second = loadOperationalObservabilityPolicy({
    OUTREACH_OBSERVABILITY_POLICY_JSON: JSON.stringify(reordered)
  });
  assert.equal(first.digest, second.digest);
  assert.deepEqual(first.rules.map(({ id }) => id), ["event-lag", "work-lag"]);
  assert.equal(canonicalDigest({ b: 2, a: 1 }), canonicalDigest({ a: 1, b: 2 }));
});

test("snapshot normalization buckets evidence and rejects free labels, unknown metrics and missing alert inputs", () => {
  const policy = loadPolicy();
  const snapshot = normalizeOperationalSnapshot({
    policy,
    observedAt: "2026-07-15T12:34:59.999Z",
    metrics: { outreach_oldest_event_seconds: 301 },
    now: NOW
  });
  assert.equal(snapshot.observedAt.toISOString(), "2026-07-15T12:34:00.000Z");
  assert.equal(snapshot.rollupBucketAt.toISOString(), "2026-07-15T12:30:00.000Z");
  assert.match(snapshot.snapshotDigest, /^[0-9a-f]{64}$/u);
  assert.throws(
    () => normalizeOperationalSnapshot({
      policy,
      observedAt: NOW,
      metrics: { outreach_oldest_event_seconds: 1, contact_id: 42 },
      now: NOW
    }),
    (error) => error.code === "OBSERVABILITY_METRIC_NOT_ALLOWED"
  );
  assert.throws(
    () => normalizeOperationalSnapshot({ policy, observedAt: NOW, metrics: {}, now: NOW }),
    (error) => error.code === "OBSERVABILITY_METRICS_INVALID"
  );
  assert.throws(
    () => normalizeOperationalSnapshot({
      policy,
      observedAt: NOW,
      metrics: { outreach_oldest_event_seconds: "301" },
      now: NOW
    }),
    (error) => error.code === "OBSERVABILITY_METRIC_VALUE_INVALID"
  );
  assert.throws(
    () => normalizeOperationalSnapshot({
      policy,
      observedAt: new Date(NOW.getTime() - 3_600_001),
      metrics: { outreach_oldest_event_seconds: 0 },
      now: NOW
    }),
    (error) => error.code === "OBSERVABILITY_SNAPSHOT_OUTSIDE_RETENTION"
  );
});

test("alert comparison boundaries are deterministic", () => {
  assert.equal(evaluateOperationalAlertCondition("greater_than", 300, 300), false);
  assert.equal(evaluateOperationalAlertCondition("greater_than", 301, 300), true);
  assert.equal(evaluateOperationalAlertCondition("greater_than_or_equal", 300, 300), true);
  assert.equal(evaluateOperationalAlertCondition("less_than", -1, 0), true);
  assert.equal(evaluateOperationalAlertCondition("less_than_or_equal", 0, 0), true);
  assert.equal(evaluateOperationalAlertCondition("equal", 1, 1), true);
});

test("service passes only normalized PII-free evidence to the durable repository", async () => {
  const policy = loadPolicy();
  const calls = [];
  const repository = {
    async recordSnapshot(snapshot, options) {
      calls.push(["snapshot", snapshot, options]);
      return { snapshotDigest: snapshot.snapshotDigest, replayed: false };
    },
    async evaluateRule(input) {
      calls.push(["rule", input]);
      return { ruleId: input.rule.id, decision: "healthy", replayed: false };
    },
    async pruneRetention(input) {
      calls.push(["prune", input]);
      return { completed: true };
    }
  };
  const service = createOperationalObservabilityService({ repository, policy, clock: () => NOW });
  const result = await service.capture({
    observedAt: "2026-07-15T12:34:22Z",
    metrics: { outreach_oldest_event_seconds: 10 }
  });
  assert.equal(result.snapshot.replayed, false);
  assert.equal(result.evaluations[0].ruleId, "event-lag");
  assert.deepEqual(Object.keys(calls[0][1].metrics), ["outreach_oldest_event_seconds"]);
  assert.equal(JSON.stringify(calls).includes("@"), false);
  await assert.rejects(
    () => service.capture({
      observedAt: NOW,
      metrics: { outreach_oldest_event_seconds: 10 },
      labels: { contact: "person@example.com" }
    }),
    (error) => error.code === "OBSERVABILITY_UNBOUNDED_DIMENSION_REJECTED"
  );
  await service.prune({ maxBatches: 2 });
  assert.equal(calls.at(-1)[0], "prune");
});

function loadPolicy(overrides = {}) {
  return loadOperationalObservabilityPolicy({
    OUTREACH_OBSERVABILITY_POLICY_JSON: JSON.stringify(policyInput(overrides))
  });
}

function policyInput(overrides = {}) {
  return {
    schemaVersion: 1,
    policyVersion: "observability-policy-v1",
    enabled: true,
    approvedPolicyReference: "change-observability-001",
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

function configurationEnvironment(overrides = {}) {
  return {
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://user:password@localhost:5432/outreach",
    ESPOCRM_BASE_URL: "https://crm.example.test",
    ESPOCRM_API_KEY: "espo-api-key-for-tests",
    MAILGUN_API_KEY: "mailgun-test-key",
    MAILGUN_DOMAIN: "mail.example.test",
    MAILGUN_FROM: "MarcsMusic <music@example.test>",
    MAILGUN_REPLY_TO: "music@example.test",
    MAILGUN_WEBHOOK_SIGNING_KEY: "mailgun-signing-key-for-tests",
    OUTREACH_PUBLIC_BASE_URL: "https://outreach.example.test",
    OUTREACH_DATA_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64"),
    OUTREACH_HASH_KEY: "observability-hash-key-for-tests-at-least-32-chars",
    OUTREACH_UNSUBSCRIBE_KEYRING_JSON: JSON.stringify({
      schemaVersion: 2,
      active: { kid: "unsub-observability", key: "u".repeat(48) },
      verifyOnly: []
    }),
    METRICS_TOKEN: "metrics-token-for-tests-at-least-24",
    ...overrides
  };
}
