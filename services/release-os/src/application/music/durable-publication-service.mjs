import { createHash, randomUUID } from "node:crypto";
import {
  buildPublicationBatch,
  preparePublication,
  publishRelease as executeStatelessPublication
} from "./publication-service.mjs";
import { audit } from "../../infrastructure/storage/json-store.mjs";

const DEFAULT_LEASE_MS = 60_000;
const DEFAULT_MAX_OUTBOX_RECORDS = 50_000;
const DEFAULT_MAX_ATTEMPT_RECORDS = 5_000;
const TERMINAL_STATUSES = new Set(["succeeded", "completed", "reconciliation_required"]);

export function createDurablePublicationService(options = {}) {
  const store = options.store;
  if (!store?.read || !store?.update) {
    throw new TypeError("durable publication service requires an atomic store");
  }

  const now = options.now ?? Date.now;
  const instanceId = options.instanceId ?? randomUUID();
  const leaseMs = boundedInteger(
    options.leaseMs ?? options.env?.MUSIC_PUBLICATION_LEASE_MS,
    DEFAULT_LEASE_MS,
    1_000,
    15 * 60_000,
    "MUSIC_PUBLICATION_LEASE_MS"
  );
  const maxOutboxRecords = boundedInteger(
    options.maxOutboxRecords ?? options.env?.MUSIC_PUBLICATION_MAX_OUTBOX_RECORDS,
    DEFAULT_MAX_OUTBOX_RECORDS,
    100,
    1_000_000,
    "MUSIC_PUBLICATION_MAX_OUTBOX_RECORDS"
  );
  const maxAttemptRecords = boundedInteger(
    options.maxAttemptRecords ?? options.env?.MUSIC_PUBLICATION_MAX_ATTEMPT_RECORDS,
    DEFAULT_MAX_ATTEMPT_RECORDS,
    100,
    100_000,
    "MUSIC_PUBLICATION_MAX_ATTEMPT_RECORDS"
  );
  const heartbeatEnabled = options.heartbeatEnabled !== false;
  const heartbeatIntervalMs = Math.max(250, Math.floor(leaseMs / 3));
  const actionExecutor = options.actionExecutor ?? executePublicationAction;

  async function publish(input, executionOptions = {}) {
    const prepared = preparePublication(input, executionOptions);
    if (prepared.dryRun) {
      return executeStatelessPublication(input, executionOptions);
    }

    const intents = prepared.plan.actions.map((action) =>
      createIntent(prepared, action, executionOptions.artist, now())
    );
    await stageIntents(intents);

    const ownerId = `${instanceId}:${randomUUID()}`;
    const results = [];
    for (const intent of intents) {
      const claim = await claimIntent(intent.id, ownerId);
      if (claim.kind !== "claimed") {
        results.push(claim.result);
        continue;
      }

      let providerResult;
      const heartbeat = startLeaseHeartbeat(claim);
      try {
        providerResult = await actionExecutor({
          prepared,
          action: intent.action,
          options: executionOptions
        });
        assertExecutorResult(providerResult, intent.action);
        providerResult = cloneForStorage(providerResult);
      } catch (error) {
        providerResult = reconciliationRequiredResult(
          intent.action,
          "Publication execution ended without a provable provider outcome; operator reconciliation is required.",
          error
        );
      } finally {
        await heartbeat.stop();
      }

      results.push(await finalizeClaim(claim, providerResult));
    }

    return buildPublicationBatch(prepared, results);
  }

  async function stageIntents(intents) {
    return store.update((state) => {
      state.publicationOutbox ??= [];
      let staged = 0;
      for (const intent of intents) {
        const existing = state.publicationOutbox.find((record) => record.id === intent.id);
        if (existing && existing.payloadDigest !== intent.payloadDigest) {
          throw publicationError(
            409,
            "A different publication payload already uses this release/platform idempotency key.",
            "PUBLICATION_IDEMPOTENCY_CONFLICT"
          );
        }
        if (existing) {
          existing.lastRequestedAt = intent.lastRequestedAt;
          continue;
        }
        if (state.publicationOutbox.length >= maxOutboxRecords) {
          throw publicationError(
            503,
            "The publication outbox reached its configured safety limit.",
            "PUBLICATION_OUTBOX_CAPACITY_REACHED"
          );
        }
        state.publicationOutbox.push(intent);
        staged += 1;
      }
      if (staged > 0) {
        audit(state, "publication.intent_staged", {
          count: staged,
          publicationIds: intents.map((intent) => intent.id)
        });
      }
      return staged;
    });
  }

  async function claimIntent(publicationId, ownerId) {
    const currentTime = now();
    const timestamp = isoTime(currentTime);
    return store.update((state) => {
      const record = findPublicationOrThrow(state, publicationId);
      if (record.status === "processing") {
        if (isLeaseExpired(record, currentTime)) {
          markReconciliationRequired(
            state,
            record,
            timestamp,
            "The publication worker lease expired before a provider outcome was durably recorded."
          );
        } else {
          return { kind: "existing", result: inProgressResult(record.action) };
        }
      }
      if (TERMINAL_STATUSES.has(record.status)) {
        return { kind: "existing", result: resultForRecord(record) };
      }
      if (!["pending", "retryable"].includes(record.status)) {
        throw publicationError(409, "Publication is not claimable.", "PUBLICATION_NOT_CLAIMABLE");
      }

      const fence = Number.isSafeInteger(record.fence) ? record.fence + 1 : 1;
      const attemptNumber = Number.isSafeInteger(record.attemptCount) ? record.attemptCount + 1 : 1;
      const attemptId = randomUUID();
      if (record.result) {
        record.lastResult = record.result;
        delete record.result;
      }
      record.status = "processing";
      record.fence = fence;
      record.attemptCount = attemptNumber;
      record.updatedAt = timestamp;
      record.lease = {
        ownerId,
        fence,
        attemptId,
        acquiredAt: timestamp,
        expiresAt: isoTime(currentTime + leaseMs)
      };
      appendAttempt(state, {
        id: attemptId,
        publicationId: record.id,
        platformId: record.platformId,
        attemptNumber,
        fence,
        status: "processing",
        startedAt: timestamp
      });
      audit(state, "publication.claimed", {
        publicationId: record.id,
        platformId: record.platformId,
        attemptNumber,
        fence
      });
      return { kind: "claimed", publicationId: record.id, ownerId, fence, attemptId };
    });
  }

  async function finalizeClaim(claim, providerResult) {
    const timestamp = isoTime(now());
    return store.update((state) => {
      const record = findPublicationOrThrow(state, claim.publicationId);
      if (
        record.status !== "processing" ||
        record.lease?.ownerId !== claim.ownerId ||
        record.lease?.fence !== claim.fence ||
        record.lease?.attemptId !== claim.attemptId
      ) {
        return resultForRecord(record);
      }

      const uncertain =
        providerResult.status === "reconciliation_required" ||
        (providerResult.status === "failed" && providerResult.outcomeUncertain === true);
      const storedProviderResult = cloneForStorage(providerResult);
      const finalResult = uncertain
        ? reconciliationRequiredResult(
            record.action,
            "The provider outcome cannot be proven; automatic retry is blocked pending operator reconciliation.",
            providerResult,
            storedProviderResult
          )
        : storedProviderResult;
      record.status = uncertain
        ? "reconciliation_required"
        : providerResult.status === "submitted"
          ? "succeeded"
          : providerResult.status === "blocked"
            ? "retryable"
            : "completed";
      record.result = finalResult;
      if (uncertain) record.lastProviderResult = storedProviderResult;
      record.updatedAt = timestamp;
      delete record.lease;
      completeAttempt(state, claim.attemptId, {
        status: record.status,
        completedAt: timestamp,
        resultStatus: finalResult.status,
        errorCode: finalResult.errorCode
      });
      audit(state, uncertain ? "publication.reconciliation_required" : "publication.completed", {
        publicationId: record.id,
        platformId: record.platformId,
        attemptNumber: record.attemptCount,
        resultStatus: finalResult.status
      });
      return cloneForStorage(finalResult);
    });
  }

  function startLeaseHeartbeat(claim) {
    if (!heartbeatEnabled) return { stop: async () => {} };
    let stopped = false;
    let timer;
    let inFlight;

    const schedule = () => {
      timer = setTimeout(() => {
        inFlight = renewClaimLease(claim)
          .then((owned) => {
            if (!owned) stopped = true;
          })
          .catch(() => {
            stopped = true;
          })
          .finally(() => {
            inFlight = undefined;
            if (!stopped) schedule();
          });
      }, heartbeatIntervalMs);
      timer.unref?.();
    };
    schedule();

    return {
      async stop() {
        stopped = true;
        clearTimeout(timer);
        await inFlight;
      }
    };
  }

  async function renewClaimLease(claim) {
    const currentTime = now();
    return store.update((state) => {
      const record = findPublicationOrThrow(state, claim.publicationId);
      if (
        record.status !== "processing" ||
        record.lease?.ownerId !== claim.ownerId ||
        record.lease?.fence !== claim.fence ||
        record.lease?.attemptId !== claim.attemptId
      ) {
        return false;
      }
      record.lease.lastHeartbeatAt = isoTime(currentTime);
      record.lease.expiresAt = isoTime(currentTime + leaseMs);
      return true;
    });
  }

  async function getPublication(publicationId) {
    await markStaleForReconciliation({ publicationId });
    const state = await store.read();
    return cloneForStorage(findPublicationOrThrow(state, publicationId));
  }

  async function markStaleForReconciliation(markOptions = {}) {
    const currentTime = now();
    const timestamp = isoTime(currentTime);
    return store.update((state) => {
      let marked = 0;
      for (const record of state.publicationOutbox ?? []) {
        if (markOptions.publicationId && record.id !== markOptions.publicationId) continue;
        if (record.status !== "processing" || !isLeaseExpired(record, currentTime)) continue;
        markReconciliationRequired(
          state,
          record,
          timestamp,
          "The publication worker lease expired before a provider outcome was durably recorded."
        );
        marked += 1;
      }
      if (marked > 0) audit(state, "publication.stale_reconciled", { count: marked });
      return Object.freeze({ marked });
    });
  }

  async function reconcile(publicationId, input = {}) {
    const operator = boundedText(input.operator, "operator", 3, 256);
    const reason = boundedText(input.reason, "reason", 12, 500);
    const outcome = normalizeOutcome(input.outcome);
    const timestamp = isoTime(now());

    return store.update((state) => {
      const record = findPublicationOrThrow(state, publicationId);
      if (record.status === "processing") {
        if (!isLeaseExpired(record, now())) {
          throw publicationError(
            409,
            "An active publication worker lease cannot be reconciled.",
            "PUBLICATION_LEASE_ACTIVE"
          );
        }
        markReconciliationRequired(
          state,
          record,
          timestamp,
          "The publication worker lease expired before a provider outcome was durably recorded."
        );
      }
      if (record.status !== "reconciliation_required") {
        throw publicationError(
          409,
          "This publication does not require reconciliation.",
          "PUBLICATION_RECONCILIATION_NOT_REQUIRED"
        );
      }

      const previousResult = record.result;
      record.reconciliationCount = (record.reconciliationCount ?? 0) + 1;
      record.lastReconciliation = { operator, reason, outcome, at: timestamp };
      record.updatedAt = timestamp;
      delete record.lease;

      if (outcome === "not_submitted") {
        record.status = "pending";
        record.lastProviderResult ??= previousResult;
        delete record.result;
      } else if (outcome === "submitted") {
        const externalId = optionalBoundedText(input.externalId, 256);
        const externalUrl = optionalHttpsUrl(input.externalUrl);
        if (!externalId && !externalUrl) {
          throw publicationError(
            400,
            "A submitted reconciliation requires externalId or externalUrl evidence.",
            "PUBLICATION_RECONCILIATION_EVIDENCE_REQUIRED"
          );
        }
        record.status = "succeeded";
        record.result = baseResult(record.action, "submitted", reason, {
          externalId,
          externalUrl,
          reconciled: true
        });
      } else {
        record.status = "completed";
        record.result = baseResult(record.action, "failed", reason, {
          errorCode: "PUBLICATION_OPERATOR_RECONCILED_FAILED",
          reconciled: true
        });
      }

      appendAttempt(state, {
        id: randomUUID(),
        publicationId: record.id,
        platformId: record.platformId,
        attemptNumber: record.attemptCount ?? 0,
        status: "reconciled",
        reconciliationOutcome: outcome,
        operator,
        reason,
        completedAt: timestamp
      });
      audit(state, "publication.reconciled", {
        publicationId: record.id,
        platformId: record.platformId,
        operator,
        outcome
      });
      return cloneForStorage(record);
    });
  }

  function appendAttempt(state, attempt) {
    state.publicationAttempts ??= [];
    state.publicationAttempts.push(attempt);
    if (state.publicationAttempts.length > maxAttemptRecords) {
      state.publicationAttempts = state.publicationAttempts.slice(-maxAttemptRecords);
    }
  }

  return Object.freeze({ publish, getPublication, reconcile, markStaleForReconciliation });
}

async function executePublicationAction({ prepared, action, options }) {
  const batch = await executeStatelessPublication(
    {
      ...prepared.release,
      targetPlatforms: [action.platformId],
      dryRun: false
    },
    { ...options, dryRun: false }
  );
  return batch.results[0];
}

function createIntent(prepared, action, artist, currentTime) {
  const releaseSnapshot = cloneForStorage(prepared.release);
  const actionSnapshot = cloneForStorage(action);
  const artistIdentity = artist
    ? { id: optionalBoundedText(artist.id, 256), slug: optionalBoundedText(artist.slug, 256) }
    : undefined;
  const payloadSnapshot = cloneForStorage({ release: releaseSnapshot, action: actionSnapshot, artist: artistIdentity });
  const timestamp = isoTime(currentTime);
  return {
    id: action.idempotencyKey,
    idempotencyKey: action.idempotencyKey,
    releaseId: prepared.release.releaseId,
    platformId: action.platformId,
    payloadDigest: createHash("sha256").update(canonicalJson(payloadSnapshot)).digest("hex"),
    payload: payloadSnapshot,
    action: actionSnapshot,
    status: "pending",
    fence: 0,
    attemptCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastRequestedAt: timestamp
  };
}

function findPublicationOrThrow(state, publicationId) {
  const normalized = typeof publicationId === "string" ? publicationId.trim() : "";
  const record = (state.publicationOutbox ?? []).find((entry) => entry.id === normalized);
  if (!record) {
    throw publicationError(404, "Publication record not found.", "PUBLICATION_NOT_FOUND");
  }
  return record;
}

function markReconciliationRequired(state, record, timestamp, message) {
  const attemptId = record.lease?.attemptId;
  record.status = "reconciliation_required";
  record.result = reconciliationRequiredResult(record.action, message);
  record.updatedAt = timestamp;
  delete record.lease;
  if (attemptId) {
    completeAttempt(state, attemptId, {
      status: "reconciliation_required",
      completedAt: timestamp,
      resultStatus: "reconciliation_required",
      errorCode: "PUBLICATION_OUTCOME_UNCERTAIN"
    });
  }
  audit(state, "publication.reconciliation_required", {
    publicationId: record.id,
    platformId: record.platformId,
    reason: message
  });
}

function completeAttempt(state, attemptId, update) {
  const attempt = (state.publicationAttempts ?? []).find((entry) => entry.id === attemptId);
  if (attempt) Object.assign(attempt, update);
}

function resultForRecord(record) {
  if (record.status === "processing") return inProgressResult(record.action);
  if (record.result) return cloneForStorage(record.result);
  if (record.status === "pending") {
    return reconciliationRequiredResult(
      record.action,
      "This caller lost its publication fence; inspect the current durable record before any retry."
    );
  }
  if (record.status === "reconciliation_required") {
    return reconciliationRequiredResult(
      record.action,
      "The provider outcome cannot be proven; operator reconciliation is required."
    );
  }
  throw publicationError(500, "Publication record has no durable result.", "PUBLICATION_RESULT_MISSING");
}

function inProgressResult(action) {
  return baseResult(action, "in_progress", "Another worker owns the active publication lease.");
}

function reconciliationRequiredResult(action, message, error, providerResult) {
  return baseResult(action, "reconciliation_required", message, {
    errorCode:
      typeof error?.errorCode === "string"
        ? error.errorCode
        : typeof error?.code === "string"
          ? error.code
          : "PUBLICATION_OUTCOME_UNCERTAIN",
    retryable: false,
    outcomeUncertain: true,
    providerResult
  });
}

function baseResult(action, status, message, extra = {}) {
  return {
    platformId: action.platformId,
    platformName: action.platformName,
    idempotencyKey: action.idempotencyKey,
    mode: action.mode,
    operation: action.operation,
    status,
    dryRun: false,
    message,
    requiredCredentialEnv: cloneForStorage(action.requiredCredentialEnv ?? []),
    requirements: cloneForStorage(action.requirements ?? []),
    ...extra
  };
}

function assertExecutorResult(result, action) {
  const allowedStatuses = new Set(["submitted", "manual_task", "blocked", "failed"]);
  if (
    !result ||
    typeof result !== "object" ||
    result.platformId !== action.platformId ||
    result.idempotencyKey !== action.idempotencyKey ||
    !allowedStatuses.has(result.status)
  ) {
    throw Object.assign(new Error("Publication adapter returned an invalid or mismatched result."), {
      code: "PUBLICATION_ADAPTER_RESULT_INVALID",
      outcomeUncertain: true
    });
  }
}

function isLeaseExpired(record, currentTime) {
  const expiry = Date.parse(record.lease?.expiresAt ?? "");
  return !Number.isFinite(expiry) || expiry <= currentTime;
}

function normalizeOutcome(value) {
  if (!["submitted", "not_submitted", "failed"].includes(value)) {
    throw publicationError(
      400,
      "outcome must be submitted, not_submitted, or failed.",
      "PUBLICATION_RECONCILIATION_OUTCOME_INVALID"
    );
  }
  return value;
}

function boundedText(value, name, minimum, maximum) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (normalized.length < minimum || normalized.length > maximum) {
    throw publicationError(
      400,
      `${name} must contain between ${minimum} and ${maximum} characters.`,
      "PUBLICATION_RECONCILIATION_INPUT_INVALID"
    );
  }
  return normalized;
}

function optionalBoundedText(value, maximum) {
  if (value === undefined || value === null || value === "") return undefined;
  const normalized = String(value).trim();
  if (!normalized || normalized.length > maximum) {
    throw publicationError(400, "Reconciliation evidence is invalid.", "PUBLICATION_RECONCILIATION_INPUT_INVALID");
  }
  return normalized;
}

function optionalHttpsUrl(value) {
  const normalized = optionalBoundedText(value, 2_048);
  if (!normalized) return undefined;
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error();
    return parsed.toString();
  } catch {
    throw publicationError(
      400,
      "externalUrl must be an HTTPS URL without embedded credentials.",
      "PUBLICATION_RECONCILIATION_INPUT_INVALID"
    );
  }
}

function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map((entry) => canonicalValue(entry));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .filter((key) => value[key] !== undefined)
        .sort()
        .map((key) => [key, canonicalValue(value[key])])
    );
  }
  return value;
}

function cloneForStorage(value) {
  return JSON.parse(JSON.stringify(value));
}

function isoTime(value) {
  return new Date(value).toISOString();
}

function boundedInteger(value, fallback, minimum, maximum, name) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw publicationError(
      503,
      `${name} is outside its configured safety bound.`,
      "PUBLICATION_CONFIG_INVALID"
    );
  }
  return parsed;
}

function publicationError(statusCode, message, code) {
  return Object.assign(new Error(message), { statusCode, code });
}
