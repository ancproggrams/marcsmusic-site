import { createHash } from "node:crypto";
import { z } from "zod";

export const PRIVACY_POLICY_SCHEMA_VERSION = 1;
export const PRIVACY_DATA_CLASSES = Object.freeze([
  "inbound_event_evidence",
  "generated_copy_evidence",
  "automatic_response_evidence",
  "human_review_evidence",
  "queue_routing_metadata",
  "delivery_attempt_metadata",
  "outcome_metadata",
  "source_traceability_metadata",
  "email_validation_metadata"
]);

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{7,119}$/u;
const TECHNICAL_RETENTION_DAYS_MAXIMUM = 36_500;
const policyClassSchema = z.object({
  retentionDays: z.number().int().min(1).max(TECHNICAL_RETENTION_DAYS_MAXIMUM),
  minimumRetentionDays: z.number().int().min(1).max(TECHNICAL_RETENTION_DAYS_MAXIMUM),
  maximumRetentionDays: z.number().int().min(1).max(TECHNICAL_RETENTION_DAYS_MAXIMUM),
  batchSize: z.number().int().min(1).max(500),
  maximumRecordsPerPlan: z.number().int().min(1).max(100_000)
}).strict().superRefine((value, context) => {
  if (value.minimumRetentionDays > value.maximumRetentionDays) {
    context.addIssue({ code: "custom", message: "minimumRetentionDays must not exceed maximumRetentionDays" });
  }
  if (value.retentionDays < value.minimumRetentionDays || value.retentionDays > value.maximumRetentionDays) {
    context.addIssue({ code: "custom", message: "retentionDays must be inside the explicitly approved minimum/maximum range" });
  }
});

const policySchema = z.object({
  schemaVersion: z.literal(PRIVACY_POLICY_SCHEMA_VERSION),
  policyVersion: z.string().regex(IDENTIFIER),
  enabled: z.boolean(),
  approvedPolicyReference: z.string().regex(IDENTIFIER),
  dataClasses: z.partialRecord(z.enum(PRIVACY_DATA_CLASSES), policyClassSchema)
}).strict().superRefine((value, context) => {
  const classes = Object.keys(value.dataClasses);
  if (value.enabled && (classes.length !== PRIVACY_DATA_CLASSES.length
    || PRIVACY_DATA_CLASSES.some((dataClass) => !Object.hasOwn(value.dataClasses, dataClass)))) {
    context.addIssue({ code: "custom", path: ["dataClasses"], message: "An enabled policy requires an explicit policy for every compiled privacy data class" });
  }
  if (!value.enabled && classes.length !== 0) {
    context.addIssue({ code: "custom", path: ["dataClasses"], message: "A disabled policy must not carry executable data-class policies" });
  }
});

export function loadPrivacyPolicy(env = process.env) {
  const raw = String(env.OUTREACH_RETENTION_POLICY_JSON ?? "").trim();
  if (!raw) {
    return Object.freeze({
      configured: false,
      enabled: false,
      schemaVersion: PRIVACY_POLICY_SCHEMA_VERSION,
      reason: "retention_policy_not_configured"
    });
  }
  if (Buffer.byteLength(raw, "utf8") > 64 * 1_024) {
    throw privacyPolicyError("PRIVACY_POLICY_TOO_LARGE", "OUTREACH_RETENTION_POLICY_JSON exceeds 64 KiB");
  }
  let input;
  try {
    input = JSON.parse(raw);
  } catch (cause) {
    throw privacyPolicyError("PRIVACY_POLICY_JSON_INVALID", "OUTREACH_RETENTION_POLICY_JSON is not valid JSON", cause);
  }
  const parsed = policySchema.safeParse(input);
  if (!parsed.success) {
    throw privacyPolicyError("PRIVACY_POLICY_INVALID", "OUTREACH_RETENTION_POLICY_JSON does not satisfy the strict versioned contract", parsed.error);
  }
  const normalized = Object.freeze({
    ...parsed.data,
    configured: true,
    dataClasses: Object.freeze(Object.fromEntries(
      Object.entries(parsed.data.dataClasses)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, value]) => [name, Object.freeze({ ...value })])
    ))
  });
  return Object.freeze({ ...normalized, digest: canonicalDigest(policyDigestInput(normalized)) });
}

export function requireEnabledPrivacyPolicy(policy) {
  if (!policy?.configured || policy.enabled !== true || !policy.digest) {
    throw privacyPolicyError("PRIVACY_POLICY_DISABLED", "Privacy governance is disabled until an explicit approved policy is configured");
  }
  return policy;
}

export function canonicalDigest(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
}

export function assertGovernanceIdentifier(value, name) {
  const normalized = String(value ?? "").trim();
  if (!IDENTIFIER.test(normalized)) {
    throw privacyPolicyError("PRIVACY_IDENTIFIER_INVALID", `${name} must contain 8-120 safe identifier characters`);
  }
  return normalized;
}

export function normalizePrivacySubject(subjectType, value) {
  const type = String(subjectType ?? "").trim().toLowerCase();
  if (!new Set(["contact", "email", "outlet", "domain", "global"]).has(type)) {
    throw privacyPolicyError("PRIVACY_SUBJECT_TYPE_INVALID", "Privacy subject type is not supported");
  }
  let normalized = String(value ?? "").trim();
  if (type === "email" || type === "domain") normalized = normalized.toLowerCase();
  if (type === "global") normalized = "global";
  if (!normalized || normalized.length > 500 || /[\r\n\u0000]/u.test(normalized)) {
    throw privacyPolicyError("PRIVACY_SUBJECT_INVALID", "Privacy subject is empty, oversized, or malformed");
  }
  if (type === "email" && !/^[^\s@]+@[^\s@]+$/u.test(normalized)) {
    throw privacyPolicyError("PRIVACY_SUBJECT_INVALID", "Email privacy subject is malformed");
  }
  return Object.freeze({ type, value: normalized });
}

function policyDigestInput(policy) {
  return {
    schemaVersion: policy.schemaVersion,
    policyVersion: policy.policyVersion,
    enabled: policy.enabled,
    approvedPolicyReference: policy.approvedPolicyReference,
    dataClasses: policy.dataClasses
  };
}

function canonicalValue(value) {
  if (value === null || typeof value !== "object") return value;
  if (Buffer.isBuffer(value)) return value.toString("base64");
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalValue);
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])])
  );
}

function privacyPolicyError(code, message, cause) {
  return Object.assign(new Error(message, cause ? { cause } : undefined), {
    code,
    retryable: false
  });
}
