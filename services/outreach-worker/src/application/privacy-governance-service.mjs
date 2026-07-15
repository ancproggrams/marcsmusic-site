import { randomUUID } from "node:crypto";
import {
  assertGovernanceIdentifier,
  normalizePrivacySubject,
  PRIVACY_DATA_CLASSES,
  requireEnabledPrivacyPolicy
} from "../domain/privacy-policy.mjs";

const REQUEST_TYPES = new Set(["lookup", "export", "correction", "erasure"]);
const ESPO_PATCH_ALLOWLIST = Object.freeze({
  MediaContact: Object.freeze({
    correction: new Set(["firstName", "lastName", "name", "emailAddress", "preferredLanguage", "timezone", "role"]),
    erasure_anonymization: new Set([
      "firstName", "lastName", "name", "emailAddress", "preferredLanguage", "timezone", "role",
      "contactSourceUrl", "contactEvidence", "proofUrl", "proofText", "instagramUrl", "showName"
    ])
  }),
  Email: Object.freeze({
    correction: new Set(),
    erasure_anonymization: new Set(["name", "body", "bodyPlain", "from", "to", "cc", "bcc", "replyTo"])
  })
});
const ESPO_ENTITY_TYPES = new Set(Object.keys(ESPO_PATCH_ALLOWLIST));
const DIGEST = /^[0-9a-f]{64}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function createPrivacyGovernanceService({ repository, cryptoBox, policy, now = () => new Date(), uuid = randomUUID }) {
  if (!repository?.createRetentionPlan || !repository?.executeBatch) {
    throw new TypeError("A PrivacyGovernanceRepository is required");
  }
  if (!cryptoBox?.privacyHash) throw new TypeError("A CryptoBox is required");

  async function planRetention({ actorId, snapshotAt = now() }) {
    const enabledPolicy = requireEnabledPrivacyPolicy(policy);
    const actor = assertGovernanceIdentifier(actorId, "actorId");
    return repository.createRetentionPlan({ policy: enabledPolicy, snapshotAt, actorId: actor });
  }

  async function executeRetention({
    planId,
    expectedDigest,
    approvalId,
    changeId,
    recoveryId,
    actorId,
    batchSize,
    maxBatches = 100,
    leaseSeconds = 120,
    afterBatch
  }) {
    const enabledPolicy = requireEnabledPrivacyPolicy(policy);
    const approvedPlanId = assertUuid(planId, "planId");
    const digest = assertDigest(expectedDigest, "expectedDigest");
    const approval = assertGovernanceIdentifier(approvalId, "approvalId");
    const change = assertGovernanceIdentifier(changeId, "changeId");
    const recovery = assertGovernanceIdentifier(recoveryId, "recoveryId");
    const actor = assertGovernanceIdentifier(actorId, "actorId");
    const approvedBatchSize = Math.min(...Object.values(enabledPolicy.dataClasses).map((entry) => entry.batchSize));
    const effectiveBatchSize = batchSize ?? approvedBatchSize;
    assertInteger(effectiveBatchSize, 1, approvedBatchSize, "batchSize");
    assertInteger(maxBatches, 1, 10_000, "maxBatches");
    assertInteger(leaseSeconds, 30, 300, "leaseSeconds");
    const ownerId = `privacy-${process.pid}-${uuid()}`.slice(0, 120);
    const lease = await repository.acquireExecutionLease({ planId: approvedPlanId, ownerId, leaseSeconds });
    try {
      const started = await repository.beginExecution({
        lease,
        expectedDigest: digest,
        policyDigest: enabledPolicy.digest,
        approvalId: approval,
        changeId: change,
        recoveryId: recovery,
        actorId: actor,
        leaseSeconds
      });
      if (started.completed || started.blocked) return started;
      let processed = 0;
      for (let batch = 0; batch < maxBatches; batch += 1) {
        const result = await repository.executeBatch({
          lease,
          batchSize: effectiveBatchSize,
          actorId: actor,
          leaseSeconds
        });
        processed += result.processed;
        if (afterBatch) await afterBatch(Object.freeze({ batch: batch + 1, processed, result }));
        if (result.completed) return Object.freeze({ completed: true, blocked: false, processed, batches: batch + 1 });
      }
      await repository.relinquishExecutionLease?.(lease);
      return Object.freeze({ completed: false, blocked: false, processed, batches: maxBatches, reason: "max_batches_reached" });
    } catch (error) {
      const code = String(error?.code ?? "PRIVACY_EXECUTION_FAILED").slice(0, 120);
      if (new Set([
        "PRIVACY_PLAN_NOT_FOUND",
        "PRIVACY_PLAN_DIGEST_MISMATCH",
        "PRIVACY_EXECUTION_BINDING_MISMATCH",
        "PRIVACY_INDEX_NOT_READY"
      ]).has(code)) {
        await repository.relinquishExecutionLease?.(lease).catch(() => false);
      } else {
        await repository.markExecutionFailed({ lease, errorCode: code, actorId: actor }).catch(() => false);
      }
      if (code === "PRIVACY_LEGAL_HOLD_ACTIVE") {
        return Object.freeze({ completed: false, blocked: true, reason: code });
      }
      throw error;
    }
  }

  async function createLegalHold({ subjectType, subject, scopeDataClass = "*", caseReference, evidence, actorId }) {
    const normalized = normalizePrivacySubject(subjectType, subject);
    if (scopeDataClass !== "*" && !PRIVACY_DATA_CLASSES.includes(scopeDataClass)) {
      throw governanceInputError("PRIVACY_LEGAL_HOLD_SCOPE_INVALID", "scopeDataClass is not supported");
    }
    const caseId = assertGovernanceIdentifier(caseReference, "caseReference");
    const actor = assertGovernanceIdentifier(actorId, "actorId");
    assertBoundedJson(evidence ?? {}, "evidence", 256 * 1_024);
    return repository.createLegalHold({
      subjectType: normalized.type,
      subjectHash: subjectHash(cryptoBox, `${normalized.type}:${normalized.value}`),
      subjectKeys: privacySubjectKeys(normalized, cryptoBox),
      scopeDataClass,
      caseReference: caseId,
      evidence: evidence ?? {},
      actorId: actor
    });
  }

  async function backfillPrivacyRecordIds({ actorId, apply = false, batchSize = 100, maxBatches = 10 }) {
    return repository.backfillPrivacyRecordIds({
      actorId: assertGovernanceIdentifier(actorId, "actorId"),
      apply: apply === true,
      batchSize: assertInteger(batchSize, 1, 500, "batchSize"),
      maxBatches: assertInteger(maxBatches, 1, 10_000, "maxBatches")
    });
  }

  async function preparePrivacyIndex({ actorId, apply = false, batchSize = 100, maxBatches = 10 }) {
    const actor = assertGovernanceIdentifier(actorId, "actorId");
    const shouldApply = apply === true;
    const schema = await repository.ensurePrivacyIndexes({ actorId: actor, apply: shouldApply });
    if (!shouldApply) {
      return Object.freeze({ applied: false, schema, backfill: null, ready: schema.after.ready });
    }
    const backfill = await repository.backfillPrivacyRecordIds({
      actorId: actor,
      apply: true,
      batchSize: assertInteger(batchSize, 1, 500, "batchSize"),
      maxBatches: assertInteger(maxBatches, 1, 10_000, "maxBatches")
    });
    if (Object.values(backfill.after).some((count) => count !== 0)) {
      const state = await repository.inspectPrivacyIndexState();
      return Object.freeze({ applied: true, schema, backfill, recordIdContracts: null, state, ready: false });
    }
    const recordIdContracts = await repository.finalizePrivacyRecordIdContracts({ actorId: actor, apply: true });
    const state = await repository.inspectPrivacyIndexState();
    return Object.freeze({ applied: true, schema, backfill, recordIdContracts, state, ready: state.ready });
  }

  async function releaseLegalHold({ holdId, releaseReference, actorId }) {
    return repository.releaseLegalHold({
      holdId: assertUuid(holdId, "holdId"),
      releaseReference: assertGovernanceIdentifier(releaseReference, "releaseReference"),
      actorId: assertGovernanceIdentifier(actorId, "actorId")
    });
  }

  async function createDsarRequest({
    requestType,
    subjectType,
    subject,
    requestReference,
    evidence,
    requestedCorrection,
    espoMutations = [],
    actorId
  }) {
    const type = String(requestType ?? "").trim().toLowerCase();
    if (!REQUEST_TYPES.has(type)) throw governanceInputError("PRIVACY_DSAR_TYPE_INVALID", "requestType is not supported");
    const normalized = normalizePrivacySubject(subjectType, subject);
    if (!new Set(["contact", "email"]).has(normalized.type)) {
      throw governanceInputError("PRIVACY_DSAR_SUBJECT_TYPE_INVALID", "DSAR subjectType must be contact or email");
    }
    const reference = assertGovernanceIdentifier(requestReference, "requestReference");
    const actor = assertGovernanceIdentifier(actorId, "actorId");
    assertBoundedJson(evidence ?? {}, "evidence", 256 * 1_024);
    if (requestedCorrection !== undefined) assertBoundedJson(requestedCorrection, "requestedCorrection", 256 * 1_024);
    const mutations = validateEspoMutations(espoMutations, type);
    const requestId = uuid();
    return repository.createDsarRequest({
      requestId,
      requestType: type,
      subjectType: normalized.type,
      subjectHash: subjectHash(cryptoBox, `${normalized.type}:${normalized.value}`),
      subjectKeys: privacySubjectKeys(normalized, cryptoBox),
      requestReference: reference,
      payload: Object.freeze({
        schemaVersion: 1,
        subject: normalized,
        evidence: evidence ?? {},
        requestedCorrection: requestedCorrection ?? null,
        espoMutations: mutations
      }),
      actorId: actor
    });
  }

  async function planDsarRequest({ requestId, actorId, maximumRecords = 5_000 }) {
    requireEnabledPrivacyPolicy(policy);
    return repository.planDsarRequest({
      requestId: assertUuid(requestId, "requestId"),
      actorId: assertGovernanceIdentifier(actorId, "actorId"),
      maximumRecords: assertInteger(maximumRecords, 1, 10_000, "maximumRecords")
    });
  }

  async function exportEspoMutationPlan({ planId, actorId }) {
    const exported = await repository.exportEspoMutationPlan({
      planId: assertUuid(planId, "planId"),
      actorId: assertGovernanceIdentifier(actorId, "actorId")
    });
    if (!exported) throw governanceInputError("PRIVACY_ESPO_PLAN_NOT_FOUND", "Espo mutation plan was not found");
    return exported;
  }

  async function exportDsarArtifact({ requestId, artifactId, actorId }) {
    const exported = await repository.exportDsarArtifact({
      requestId: assertUuid(requestId, "requestId"),
      artifactId: assertUuid(artifactId, "artifactId"),
      actorId: assertGovernanceIdentifier(actorId, "actorId")
    });
    if (!exported) throw governanceInputError("PRIVACY_DSAR_ARTIFACT_NOT_FOUND", "DSAR artifact was not found");
    return exported;
  }

  async function closeDsarRequest({ requestId, closureReference, actorId }) {
    return repository.closeDsarRequest({
      requestId: assertUuid(requestId, "requestId"),
      closureReference: assertGovernanceIdentifier(closureReference, "closureReference"),
      actorId: assertGovernanceIdentifier(actorId, "actorId")
    });
  }

  return Object.freeze({
    planRetention,
    executeRetention,
    backfillPrivacyRecordIds,
    preparePrivacyIndex,
    createLegalHold,
    releaseLegalHold,
    createDsarRequest,
    planDsarRequest,
    closeDsarRequest,
    exportDsarArtifact,
    exportEspoMutationPlan
  });
}

function privacySubjectKeys(subject, cryptoBox) {
  const keys = [{ keyType: "canonical", subjectHash: subjectHash(cryptoBox, `${subject.type}:${subject.value}`) }];
  if (subject.type === "email") {
    keys.push(
      { keyType: "email_validation", subjectHash: subjectHash(cryptoBox, subject.value) },
      { keyType: "source_identity", subjectHash: subjectHash(cryptoBox, `source-identity:email:${subject.value}`) }
    );
  }
  if (subject.type === "domain") {
    keys.push({ keyType: "source_identity", subjectHash: subjectHash(cryptoBox, `source-identity:outlet_domain:${subject.value}`) });
  }
  return Object.freeze(keys.map((key) => Object.freeze(key)));
}

function validateEspoMutations(values, requestType) {
  if (!Array.isArray(values) || values.length > 100) {
    throw governanceInputError("PRIVACY_ESPO_PLAN_INVALID", "espoMutations must be an array with at most 100 records");
  }
  if (values.length && !new Set(["correction", "erasure"]).has(requestType)) {
    throw governanceInputError("PRIVACY_ESPO_PLAN_INVALID", "Espo mutation plans are allowed only for correction or erasure requests");
  }
  const identities = new Set();
  return Object.freeze(values.map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw governanceInputError("PRIVACY_ESPO_PLAN_INVALID", "Espo mutation plan must be an object");
    }
    const entityType = String(value.entityType ?? "");
    if (!ESPO_ENTITY_TYPES.has(entityType)) throw governanceInputError("PRIVACY_ESPO_PLAN_INVALID", "Espo entityType is not allowed");
    const entityId = String(value.entityId ?? "").trim();
    if (!entityId || entityId.length > 120 || /[\r\n\u0000]/u.test(entityId)) {
      throw governanceInputError("PRIVACY_ESPO_PLAN_INVALID", "Espo entityId is malformed");
    }
    const expectedVersion = Number(value.expectedVersion);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 0 || expectedVersion > Number.MAX_SAFE_INTEGER) {
      throw governanceInputError("PRIVACY_ESPO_PLAN_INVALID", "Espo expectedVersion must be a non-negative integer");
    }
    const mutationType = value.mutationType ?? (requestType === "correction" ? "correction" : "erasure_anonymization");
    if (!new Set(["correction", "erasure_anonymization"]).has(mutationType)) {
      throw governanceInputError("PRIVACY_ESPO_PLAN_INVALID", "Espo mutationType is not allowed");
    }
    if ((requestType === "correction") !== (mutationType === "correction")) {
      throw governanceInputError("PRIVACY_ESPO_PLAN_INVALID", "Espo mutationType does not match the DSAR request type");
    }
    assertBoundedJson(value.patch, "Espo patch", 256 * 1_024);
    if (!value.patch || typeof value.patch !== "object" || Array.isArray(value.patch) || Object.keys(value.patch).length > 64) {
      throw governanceInputError("PRIVACY_ESPO_PLAN_INVALID", "Espo patch must be an object with at most 64 fields");
    }
    const fields = Object.keys(value.patch);
    const allowedFields = ESPO_PATCH_ALLOWLIST[entityType][mutationType];
    if (!fields.length || fields.some((field) => !allowedFields.has(field))) {
      throw governanceInputError(
        "PRIVACY_ESPO_FIELD_NOT_ALLOWED",
        `Espo ${entityType} ${mutationType} patch contains a field outside the compiled privacy allowlist`
      );
    }
    const patch = Object.freeze(Object.fromEntries(fields.sort().map((field) => {
      const fieldValue = value.patch[field];
      if (mutationType === "erasure_anonymization" && fieldValue !== null && fieldValue !== "[erased]") {
        throw governanceInputError(
          "PRIVACY_ESPO_ERASURE_VALUE_INVALID",
          "Espo erasure fields may only be null or the fixed [erased] marker"
        );
      }
      if (mutationType === "correction"
        && fieldValue !== null
        && (typeof fieldValue !== "string" || fieldValue.length > 500 || /[\r\n\u0000]/u.test(fieldValue))) {
        throw governanceInputError("PRIVACY_ESPO_CORRECTION_VALUE_INVALID", "Espo correction values must be bounded single-line text or null");
      }
      return [field, fieldValue];
    })));
    const identity = `${entityType}:${entityId}:${mutationType}`;
    if (identities.has(identity)) {
      throw governanceInputError("PRIVACY_ESPO_PLAN_DUPLICATE", "Espo mutation plan contains a duplicate entity mutation");
    }
    identities.add(identity);
    return Object.freeze({ entityType, entityId, expectedVersion, mutationType, patch });
  }));
}

function subjectHash(cryptoBox, value) {
  return (cryptoBox.subjectHash ?? cryptoBox.privacyHash).call(cryptoBox, value);
}

function assertBoundedJson(value, name, maximumBytes) {
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch (cause) {
    throw governanceInputError("PRIVACY_INPUT_INVALID", `${name} must be JSON-serializable`, cause);
  }
  if (serialized === undefined || Buffer.byteLength(serialized, "utf8") > maximumBytes) {
    throw governanceInputError("PRIVACY_INPUT_TOO_LARGE", `${name} exceeds its encrypted byte bound`);
  }
}

function assertUuid(value, name) {
  const normalized = String(value ?? "").trim();
  if (!UUID.test(normalized)) throw governanceInputError("PRIVACY_IDENTIFIER_INVALID", `${name} must be a UUID`);
  return normalized;
}

function assertDigest(value, name) {
  const normalized = String(value ?? "").trim();
  if (!DIGEST.test(normalized)) throw governanceInputError("PRIVACY_DIGEST_INVALID", `${name} must be a lowercase SHA-256 digest`);
  return normalized;
}

function assertInteger(value, minimum, maximum, name) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw governanceInputError("PRIVACY_INTEGER_INVALID", `${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
}

function governanceInputError(code, message, cause) {
  return Object.assign(new Error(message, cause ? { cause } : undefined), { code, retryable: false });
}
