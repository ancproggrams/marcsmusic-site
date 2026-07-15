import { createHash } from "node:crypto";

import { ApplicationError } from "../errors.mjs";

const POLICY_ENVIRONMENT_KEY = "OUTREACH_OBSERVABILITY_POLICY_JSON";
const POLICY_KEYS = Object.freeze([
  "schemaVersion",
  "policyVersion",
  "enabled",
  "approvedPolicyReference",
  "sampleIntervalSeconds",
  "rollupBucketSeconds",
  "snapshotRetentionHours",
  "rollupRetentionDays",
  "alertEvidenceRetentionDays",
  "maximumClockSkewSeconds",
  "pruneBatchSize",
  "maximumSnapshots",
  "maximumRollupBucketsPerMetric",
  "maximumEvaluationsPerRule",
  "maximumEventsPerRule",
  "rules"
]);
const RULE_KEYS = Object.freeze([
  "id",
  "metric",
  "comparator",
  "threshold",
  "severity",
  "cooldownSeconds"
]);
const TOKEN_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{2,127}$/u;
const RULE_ID_PATTERN = /^[a-z][a-z0-9_-]{2,63}$/u;
const COMPARATORS = new Set(["greater_than", "greater_than_or_equal", "less_than", "less_than_or_equal", "equal"]);
const SEVERITIES = new Set(["sev1", "sev2", "sev3"]);
const MAX_SAFE_METRIC_VALUE = Number.MAX_SAFE_INTEGER;

export const OPERATIONAL_METRIC_DEFINITIONS = Object.freeze({
  outreach_health_sent_24h: metricDefinition("count", 0, MAX_SAFE_METRIC_VALUE, true),
  outreach_health_harmful_rate: metricDefinition("ratio", 0, 1),
  outreach_health_failure_rate: metricDefinition("ratio", 0, 1),
  outreach_work_queue_depth: metricDefinition("count", 0, MAX_SAFE_METRIC_VALUE, true),
  outreach_send_queue_depth: metricDefinition("count", 0, MAX_SAFE_METRIC_VALUE, true),
  outreach_response_queue_depth: metricDefinition("count", 0, MAX_SAFE_METRIC_VALUE, true),
  outreach_event_inbox_depth: metricDefinition("count", 0, MAX_SAFE_METRIC_VALUE, true),
  outreach_oldest_work_seconds: metricDefinition("seconds", 0, MAX_SAFE_METRIC_VALUE),
  outreach_oldest_event_seconds: metricDefinition("seconds", 0, MAX_SAFE_METRIC_VALUE),
  outreach_work_dead_letters: metricDefinition("count", 0, MAX_SAFE_METRIC_VALUE, true),
  outreach_send_dead_letters: metricDefinition("count", 0, MAX_SAFE_METRIC_VALUE, true),
  outreach_response_dead_letters: metricDefinition("count", 0, MAX_SAFE_METRIC_VALUE, true),
  outreach_delivery_unknown: metricDefinition("count", 0, MAX_SAFE_METRIC_VALUE, true),
  outreach_full_reconcile_age_seconds: metricDefinition("seconds_or_unknown", -1, MAX_SAFE_METRIC_VALUE),
  outreach_incremental_reconcile_age_seconds: metricDefinition("seconds_or_unknown", -1, MAX_SAFE_METRIC_VALUE),
  outreach_send_circuit_open: metricDefinition("binary", 0, 1, true),
  outreach_technical_state_ready: metricDefinition("binary", 0, 1, true),
  outreach_crm_projection_backlog: metricDefinition("count", 0, MAX_SAFE_METRIC_VALUE, true)
});

export const OPERATIONAL_METRIC_KEYS = Object.freeze(Object.keys(OPERATIONAL_METRIC_DEFINITIONS).sort());

export function loadOperationalObservabilityPolicy(environment = {}) {
  const serialized = environment[POLICY_ENVIRONMENT_KEY];
  if (typeof serialized !== "string" || serialized.trim() === "") {
    return Object.freeze({ enabled: false, configured: false });
  }

  let input;
  try {
    input = JSON.parse(serialized);
  } catch (cause) {
    throw policyError("OBSERVABILITY_POLICY_JSON_INVALID", "Observability policy JSON is invalid", cause);
  }
  if (!isPlainObject(input)) throw policyError("OBSERVABILITY_POLICY_INVALID", "Observability policy must be a JSON object");
  assertExactKeys(input, POLICY_KEYS, "observability policy");
  if (input.schemaVersion !== 1) throw policyError("OBSERVABILITY_POLICY_INVALID", "Unsupported observability policy schemaVersion");
  if (typeof input.enabled !== "boolean") throw policyError("OBSERVABILITY_POLICY_INVALID", "Observability policy enabled must be boolean");
  if (!input.enabled) {
    return Object.freeze({
      enabled: false,
      configured: true,
      schemaVersion: 1,
      policyVersion: assertToken(input.policyVersion, "policyVersion"),
      approvedPolicyReference: assertToken(input.approvedPolicyReference, "approvedPolicyReference")
    });
  }

  const policyVersion = assertToken(input.policyVersion, "policyVersion");
  const approvedPolicyReference = assertToken(input.approvedPolicyReference, "approvedPolicyReference");
  const sampleIntervalSeconds = assertInteger(input.sampleIntervalSeconds, 30, 3_600, "sampleIntervalSeconds");
  const rollupBucketSeconds = assertInteger(input.rollupBucketSeconds, 60, 86_400, "rollupBucketSeconds");
  if (rollupBucketSeconds % sampleIntervalSeconds !== 0) {
    throw policyError("OBSERVABILITY_POLICY_INVALID", "rollupBucketSeconds must be a multiple of sampleIntervalSeconds");
  }
  const snapshotRetentionHours = assertInteger(input.snapshotRetentionHours, 1, 744, "snapshotRetentionHours");
  const rollupRetentionDays = assertInteger(input.rollupRetentionDays, 1, 730, "rollupRetentionDays");
  const alertEvidenceRetentionDays = assertInteger(input.alertEvidenceRetentionDays, 1, 2_555, "alertEvidenceRetentionDays");
  if (alertEvidenceRetentionDays * 24 < snapshotRetentionHours) {
    throw policyError(
      "OBSERVABILITY_POLICY_INVALID",
      "alertEvidenceRetentionDays must cover the complete accepted snapshot window for stale-evidence fencing"
    );
  }
  const maximumClockSkewSeconds = assertInteger(input.maximumClockSkewSeconds, 0, 900, "maximumClockSkewSeconds");
  const pruneBatchSize = assertInteger(input.pruneBatchSize, 1, 5_000, "pruneBatchSize");
  const maximumSnapshots = assertInteger(input.maximumSnapshots, 2, 500_000, "maximumSnapshots");
  const maximumRollupBucketsPerMetric = assertInteger(
    input.maximumRollupBucketsPerMetric,
    2,
    500_000,
    "maximumRollupBucketsPerMetric"
  );
  const maximumEvaluationsPerRule = assertInteger(input.maximumEvaluationsPerRule, 2, 500_000, "maximumEvaluationsPerRule");
  const maximumEventsPerRule = assertInteger(input.maximumEventsPerRule, 2, 100_000, "maximumEventsPerRule");
  if (!Array.isArray(input.rules) || input.rules.length < 1 || input.rules.length > 16) {
    throw policyError("OBSERVABILITY_POLICY_INVALID", "Enabled observability policy requires between 1 and 16 rules");
  }
  const identifiers = new Set();
  const rules = input.rules.map((rule) => normalizeRule(rule, identifiers)).sort((left, right) => left.id.localeCompare(right.id));
  const canonicalPolicy = {
    schemaVersion: 1,
    policyVersion,
    enabled: true,
    approvedPolicyReference,
    sampleIntervalSeconds,
    rollupBucketSeconds,
    snapshotRetentionHours,
    rollupRetentionDays,
    alertEvidenceRetentionDays,
    maximumClockSkewSeconds,
    pruneBatchSize,
    maximumSnapshots,
    maximumRollupBucketsPerMetric,
    maximumEvaluationsPerRule,
    maximumEventsPerRule,
    rules
  };
  return deepFreeze({
    ...canonicalPolicy,
    configured: true,
    digest: canonicalDigest(canonicalPolicy)
  });
}

export function requireEnabledOperationalObservabilityPolicy(policy) {
  if (policy?.enabled === true && typeof policy.digest === "string") return policy;
  throw policyError("OBSERVABILITY_POLICY_DISABLED", "Durable operational observability is disabled until an approved policy is configured");
}

export function normalizeOperationalSnapshot({ policy, observedAt, metrics, now = new Date() }) {
  const enabledPolicy = requireEnabledOperationalObservabilityPolicy(policy);
  const currentTime = validDate(now, "now");
  const observed = validDate(observedAt ?? currentTime, "observedAt");
  const latestAllowed = currentTime.getTime() + enabledPolicy.maximumClockSkewSeconds * 1_000;
  const earliestAllowed = currentTime.getTime() - enabledPolicy.snapshotRetentionHours * 3_600_000;
  if (observed.getTime() > latestAllowed || observed.getTime() < earliestAllowed) {
    throw policyError("OBSERVABILITY_SNAPSHOT_OUTSIDE_RETENTION", "Metric snapshot timestamp is outside the approved collection window");
  }
  if (!isPlainObject(metrics)) throw policyError("OBSERVABILITY_METRICS_INVALID", "metrics must be a plain object");
  const entries = Object.entries(metrics);
  if (entries.length < 1 || entries.length > OPERATIONAL_METRIC_KEYS.length) {
    throw policyError("OBSERVABILITY_METRICS_INVALID", "Metric snapshot must contain a bounded non-empty metric set");
  }
  const normalizedMetrics = {};
  for (const [metricKey, rawValue] of entries.sort(([left], [right]) => left.localeCompare(right))) {
    normalizedMetrics[metricKey] = normalizeMetricValue(metricKey, rawValue);
  }
  for (const rule of enabledPolicy.rules) {
    if (!Object.hasOwn(normalizedMetrics, rule.metric)) {
      throw policyError("OBSERVABILITY_ALERT_METRIC_MISSING", `Required alert metric is absent: ${rule.metric}`);
    }
  }
  const bucketMilliseconds = enabledPolicy.sampleIntervalSeconds * 1_000;
  const bucketAt = new Date(Math.floor(observed.getTime() / bucketMilliseconds) * bucketMilliseconds);
  const rollupMilliseconds = enabledPolicy.rollupBucketSeconds * 1_000;
  const rollupBucketAt = new Date(Math.floor(bucketAt.getTime() / rollupMilliseconds) * rollupMilliseconds);
  const digestInput = {
    schemaVersion: 1,
    policyDigest: enabledPolicy.digest,
    observedAt: bucketAt.toISOString(),
    metrics: normalizedMetrics
  };
  return deepFreeze({
    snapshotDigest: canonicalDigest(digestInput),
    policyDigest: enabledPolicy.digest,
    policyVersion: enabledPolicy.policyVersion,
    observedAt: bucketAt,
    rollupBucketAt,
    metrics: normalizedMetrics
  });
}

export function evaluateOperationalAlertCondition(comparator, observedValue, threshold) {
  if (!COMPARATORS.has(comparator)) throw policyError("OBSERVABILITY_RULE_INVALID", "Unsupported alert comparator");
  if (!Number.isFinite(observedValue) || !Number.isFinite(threshold)) {
    throw policyError("OBSERVABILITY_RULE_INVALID", "Alert comparison requires finite numeric values");
  }
  if (comparator === "greater_than") return observedValue > threshold;
  if (comparator === "greater_than_or_equal") return observedValue >= threshold;
  if (comparator === "less_than") return observedValue < threshold;
  if (comparator === "less_than_or_equal") return observedValue <= threshold;
  return observedValue === threshold;
}

export function operationalEvidenceKey(value) {
  return canonicalDigest(value);
}

export function canonicalDigest(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function normalizeRule(rule, identifiers) {
  if (!isPlainObject(rule)) throw policyError("OBSERVABILITY_POLICY_INVALID", "Each observability rule must be an object");
  assertExactKeys(rule, RULE_KEYS, "observability rule");
  if (typeof rule.id !== "string" || !RULE_ID_PATTERN.test(rule.id)) {
    throw policyError("OBSERVABILITY_POLICY_INVALID", "Observability rule id is invalid");
  }
  if (identifiers.has(rule.id)) throw policyError("OBSERVABILITY_POLICY_INVALID", `Duplicate observability rule id: ${rule.id}`);
  identifiers.add(rule.id);
  const definition = OPERATIONAL_METRIC_DEFINITIONS[rule.metric];
  if (!definition) throw policyError("OBSERVABILITY_POLICY_INVALID", `Unknown or unbounded metric: ${rule.metric}`);
  if (!COMPARATORS.has(rule.comparator)) throw policyError("OBSERVABILITY_POLICY_INVALID", "Observability comparator is invalid");
  if (!SEVERITIES.has(rule.severity)) throw policyError("OBSERVABILITY_POLICY_INVALID", "Observability severity is invalid");
  const threshold = normalizeMetricValue(rule.metric, rule.threshold);
  return Object.freeze({
    id: rule.id,
    metric: rule.metric,
    comparator: rule.comparator,
    threshold,
    severity: rule.severity,
    cooldownSeconds: assertInteger(rule.cooldownSeconds, 60, 86_400, "cooldownSeconds")
  });
}

function normalizeMetricValue(metricKey, rawValue) {
  const definition = OPERATIONAL_METRIC_DEFINITIONS[metricKey];
  if (!definition) throw policyError("OBSERVABILITY_METRIC_NOT_ALLOWED", `Metric is not in the finite operational registry: ${metricKey}`);
  if (typeof rawValue !== "number") {
    throw policyError("OBSERVABILITY_METRIC_VALUE_INVALID", `Metric requires a JSON number: ${metricKey}`);
  }
  const value = rawValue;
  if (!Number.isFinite(value) || value < definition.minimum || value > definition.maximum) {
    throw policyError("OBSERVABILITY_METRIC_VALUE_INVALID", `Metric value is outside its approved range: ${metricKey}`);
  }
  if (definition.integer && !Number.isInteger(value)) {
    throw policyError("OBSERVABILITY_METRIC_VALUE_INVALID", `Metric requires an integer value: ${metricKey}`);
  }
  return Object.is(value, -0) ? 0 : value;
}

function metricDefinition(unit, minimum, maximum, integer = false) {
  return Object.freeze({ unit, minimum, maximum, integer });
}

function assertExactKeys(value, allowedKeys, label) {
  const allowed = new Set(allowedKeys);
  const extra = Object.keys(value).filter((key) => !allowed.has(key));
  const missing = allowedKeys.filter((key) => !Object.hasOwn(value, key));
  if (extra.length || missing.length) {
    throw policyError(
      "OBSERVABILITY_POLICY_INVALID",
      `${label} keys do not match the versioned contract${extra.length ? `; extra=${extra.join(",")}` : ""}${missing.length ? `; missing=${missing.join(",")}` : ""}`
    );
  }
}

function assertToken(value, label) {
  if (typeof value !== "string" || !TOKEN_PATTERN.test(value)) {
    throw policyError("OBSERVABILITY_POLICY_INVALID", `${label} must be a bounded non-PII operational reference`);
  }
  return value;
}

function assertInteger(value, minimum, maximum, label) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw policyError("OBSERVABILITY_POLICY_INVALID", `${label} must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
}

function validDate(value, label) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) throw policyError("OBSERVABILITY_TIMESTAMP_INVALID", `${label} must be a valid timestamp`);
  return date;
}

function policyError(code, message, cause) {
  return new ApplicationError(message, { code, statusCode: 503, retryable: false, cause });
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}
