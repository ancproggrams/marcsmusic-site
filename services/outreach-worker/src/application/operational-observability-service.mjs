import { ApplicationError } from "../errors.mjs";
import {
  normalizeOperationalSnapshot,
  requireEnabledOperationalObservabilityPolicy
} from "../domain/operational-observability-policy.mjs";

const CAPTURE_KEYS = new Set(["observedAt", "metrics"]);

export function createOperationalObservabilityService({ repository, policy, clock = () => new Date() }) {
  const enabledPolicy = requireEnabledOperationalObservabilityPolicy(policy);
  if (!repository?.recordSnapshot || !repository?.evaluateRule || !repository?.pruneRetention) {
    throw new TypeError("A durable operational observability repository is required");
  }
  if (typeof clock !== "function") throw new TypeError("clock must be a function");

  async function capture(input = {}) {
    assertExactCaptureInput(input);
    const now = validDate(clock(), "clock");
    const snapshot = normalizeOperationalSnapshot({
      policy: enabledPolicy,
      observedAt: input.observedAt ?? now,
      metrics: input.metrics,
      now
    });
    const receipt = await repository.recordSnapshot(snapshot);
    const evaluations = [];
    for (const rule of enabledPolicy.rules) {
      evaluations.push(await repository.evaluateRule({
        snapshotDigest: snapshot.snapshotDigest,
        rule
      }));
    }
    return Object.freeze({
      snapshot: receipt,
      evaluations: Object.freeze(evaluations)
    });
  }

  async function prune({ now = clock(), maxBatches = 10 } = {}) {
    return repository.pruneRetention({ now: validDate(now, "now"), maxBatches });
  }

  return Object.freeze({
    capture,
    prune,
    policy: Object.freeze({
      schemaVersion: enabledPolicy.schemaVersion,
      policyVersion: enabledPolicy.policyVersion,
      policyDigest: enabledPolicy.digest,
      approvedPolicyReference: enabledPolicy.approvedPolicyReference,
      ruleCount: enabledPolicy.rules.length
    })
  });
}

function assertExactCaptureInput(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw serviceError("OBSERVABILITY_CAPTURE_INVALID", "Capture input must be a plain object");
  }
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) {
    throw serviceError("OBSERVABILITY_CAPTURE_INVALID", "Capture input must be a plain object");
  }
  const extra = Object.keys(input).filter((key) => !CAPTURE_KEYS.has(key));
  if (extra.length) {
    throw serviceError(
      "OBSERVABILITY_UNBOUNDED_DIMENSION_REJECTED",
      `Capture input contains unsupported dimensions: ${extra.join(",")}`
    );
  }
}

function validDate(value, label) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) throw serviceError("OBSERVABILITY_TIMESTAMP_INVALID", `${label} must be a valid timestamp`);
  return date;
}

function serviceError(code, message) {
  return new ApplicationError(message, { code, statusCode: 503, retryable: false });
}
