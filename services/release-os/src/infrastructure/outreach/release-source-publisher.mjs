import { createHash, createHmac, randomUUID } from "node:crypto";
import { audit } from "../storage/json-store.mjs";
import { canonicalizeSourceHttpsUrl } from "./source-url.mjs";

const SOURCE_ID = "marcsmusic-release-os";
const DEFAULT_MAX_ATTEMPTS = 4;
const DEFAULT_MAX_REISSUES = 3;
const DEFAULT_MAX_OPERATOR_RECOVERIES = 3;
const DEFAULT_ENVELOPE_MAX_AGE_MS = 23 * 60 * 60 * 1_000;
const RETRY_BASE_MS = 60_000;
const RETRY_MAX_MS = 3_600_000;
const GENRES = new Map([
  ["ambient", "Ambient"], ["dance", "Dance"], ["electronic", "Electronic"],
  ["hip hop", "Hip Hop"], ["hip-hop", "Hip Hop"], ["indie", "Indie"],
  ["latin", "Latin"], ["pop", "Pop"], ["reggae", "Reggae"], ["rock", "Rock"], ["world", "World"]
]);
const LANGUAGES = new Set(["nl", "en", "de", "fr", "es", "pt", "instrumental", "other"]);
const SUB_GENRES = new Map([
  ["afro", "Afro"], ["caribbean", "Caribbean"], ["club", "Club"], ["downtempo", "Downtempo"],
  ["indie dance", "Indie Dance"], ["indie-dance", "Indie Dance"], ["melodic", "Melodic"],
  ["reggaeton", "Reggaeton"], ["tropical", "Tropical"], ["world fusion", "World Fusion"],
  ["world-fusion", "World Fusion"], ["other", "Other"]
]);

export function loadReleaseSourceConfig(env = process.env) {
  const enabled = env.OUTREACH_SOURCE_PUBLISH_ENABLED === "true";
  const baseUrl = optional(env.OUTREACH_SOURCE_INGESTION_BASE_URL);
  const signingKeyId = optional(env.OUTREACH_SOURCE_SIGNING_KEY_ID);
  const signingKey = optional(env.OUTREACH_SOURCE_SIGNING_KEY);
  if (enabled) {
    if (!isHttps(baseUrl)) throw configError("OUTREACH_SOURCE_INGESTION_BASE_URL must use HTTPS");
    if (!signingKeyId || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/u.test(signingKeyId)) {
      throw configError("OUTREACH_SOURCE_SIGNING_KEY_ID must be a bounded key id");
    }
    if (!signingKey || signingKey.length < 32 || signingKey.length > 512) {
      throw configError("OUTREACH_SOURCE_SIGNING_KEY must contain 32-512 characters");
    }
  }
  return Object.freeze({
    enabled,
    baseUrl: baseUrl?.replace(/\/+$/u, ""),
    signingKeyId,
    signingKey,
    intervalMs: boundedInteger(env.OUTREACH_SOURCE_PUBLISH_INTERVAL_MS, 900_000, 60_000, 86_400_000),
    timeoutMs: boundedInteger(env.OUTREACH_SOURCE_TIMEOUT_MS, 10_000, 1_000, 60_000),
    maxAttempts: boundedInteger(env.OUTREACH_SOURCE_MAX_ATTEMPTS, DEFAULT_MAX_ATTEMPTS, 1, 20),
    maxReissues: boundedInteger(env.OUTREACH_SOURCE_MAX_REISSUES, DEFAULT_MAX_REISSUES, 0, 10),
    maxOperatorRecoveries: boundedInteger(
      env.OUTREACH_SOURCE_MAX_OPERATOR_RECOVERIES,
      DEFAULT_MAX_OPERATOR_RECOVERIES,
      0,
      10
    ),
    envelopeMaxAgeMs: boundedInteger(
      env.OUTREACH_SOURCE_ENVELOPE_MAX_AGE_MS,
      DEFAULT_ENVELOPE_MAX_AGE_MS,
      3_600_000,
      DEFAULT_ENVELOPE_MAX_AGE_MS
    )
  });
}

export function createReleaseSourcePublisher({
  store,
  config,
  fetch = globalThis.fetch,
  now = () => new Date(),
  nonce = randomUUID,
  leaseOwner = () => randomUUID()
}) {
  if (!store?.update) throw new TypeError("Release source publisher requires a JsonStore-like store");
  const policy = sourcePolicy(config);

  async function publishPending() {
    if (!config.enabled) return Object.freeze({ published: false, reason: "disabled" });
    const current = now();
    const claim = await store.update((state) => prepareAndClaim(state, current, policy, leaseOwner()));
    if (!claim.outbox) {
      return Object.freeze({ published: false, reason: claim.reason, held: claim.held, artifactId: claim.artifactId });
    }

    let response;
    try {
      response = await postOnce(claim.outbox.rawBody, { config, fetch, now, nonce });
    } catch (error) {
      const failure = normalizePublishError(error);
      const transition = await store.update((state) => failClaim(state, claim.outbox, failure, now(), policy));
      if (transition === "lease_lost") throw publishError("OUTREACH_SOURCE_LEASE_LOST", true, error);
      throw failure;
    }

    const completed = await store.update((state) => completeClaim(state, claim.outbox, response, now()));
    if (!completed) throw publishError("OUTREACH_SOURCE_LEASE_LOST", true);
    return Object.freeze({
      published: true,
      artifactId: claim.outbox.artifact.artifactId,
      records: claim.outbox.artifact.records.length,
      replayed: response.replayed
    });
  }

  return Object.freeze({ publishPending });
}

export function startReleaseSourcePublisherLoop({ publisher, intervalMs, signal, logger = console }) {
  let running = false;
  let timer;
  const execute = async () => {
    if (running || signal?.aborted) return;
    running = true;
    try {
      const result = await publisher.publishPending();
      logger.info?.({ published: result.published, reason: result.reason, records: result.records, held: result.held }, "release_source_publish_completed");
    } catch (error) {
      logger.error?.({ code: error.code ?? "RELEASE_SOURCE_PUBLISH_FAILED" }, "release_source_publish_failed");
    } finally {
      running = false;
    }
  };
  if (!signal?.aborted) {
    timer = setInterval(execute, intervalMs);
    timer.unref?.();
    queueMicrotask(execute);
  }
  signal?.addEventListener("abort", () => clearInterval(timer), { once: true });
  return Object.freeze({ runNow: execute, stop: () => clearInterval(timer) });
}

export function stageReleaseSourceOutbox(state, generatedAt = new Date(), options = {}) {
  const policy = sourcePolicy(options);
  if (state.outreachSourceOutbox) {
    normalizeOutbox(state.outreachSourceOutbox, policy);
    return { outbox: state.outreachSourceOutbox, held: 0 };
  }
  const records = [];
  let held = 0;
  for (const release of state.releases ?? []) {
    const record = toSourceRecord(release);
    if (record) records.push(record);
    else held += 1;
  }
  if (!records.length) return { reason: "no_exportable_releases", held };
  const semanticDigest = semanticDigestFor(records);
  if ((state.outreachSourceCheckpoint?.semanticDigest ?? state.outreachSourceCheckpoint?.contentDigest) === semanticDigest) {
    return { reason: "unchanged", held };
  }
  const timestamp = generatedAt.toISOString();
  const artifact = createArtifact(records, timestamp, semanticDigest, 1);
  state.outreachSourceOutbox = {
    semanticDigest,
    contentDigest: semanticDigest,
    artifact,
    rawBody: JSON.stringify(artifact),
    status: "pending",
    attemptCount: 0,
    totalAttemptCount: 0,
    maxAttempts: policy.maxAttempts,
    reissueCount: 0,
    maxReissues: policy.maxReissues,
    operatorRecoveryCount: 0,
    maxOperatorRecoveries: policy.maxOperatorRecoveries,
    envelopeVersion: 1,
    nextAttemptAt: timestamp,
    stagedAt: timestamp,
    lockedBy: null,
    lockedUntil: null,
    leaseVersion: 0,
    lastErrorCode: null
  };
  audit(state, "outreach.source.envelope_staged", {
    sourceId: SOURCE_ID,
    artifactId: artifact.artifactId,
    semanticDigest,
    envelopeVersion: 1
  });
  return { outbox: state.outreachSourceOutbox, held };
}

export function recoverReleaseSourceDeadLetter(state, {
  operator,
  reason,
  now = new Date(),
  maxAttempts,
  maxReissues,
  maxOperatorRecoveries
} = {}) {
  const actor = validatedOperator(operator);
  const recoveryReason = validatedReason(reason);
  const outbox = state.outreachSourceOutbox;
  if (!outbox) throw publishError("OUTREACH_SOURCE_OUTBOX_EMPTY", false);
  const policy = sourcePolicy({ maxAttempts, maxReissues, maxOperatorRecoveries });
  normalizeOutbox(outbox, policy);
  if (outbox.status !== "dead_letter") throw publishError("OUTREACH_SOURCE_NOT_DEAD_LETTER", false);
  if (outbox.operatorRecoveryCount >= policy.maxOperatorRecoveries) {
    throw publishError("OUTREACH_SOURCE_OPERATOR_RECOVERY_EXHAUSTED", false);
  }
  assertEnvelopeIntegrity(outbox);
  const oldArtifactId = outbox.artifact.artifactId;
  outbox.operatorRecoveryCount += 1;
  outbox.reissueCount = 0;
  outbox.maxAttempts = policy.maxAttempts;
  outbox.maxReissues = policy.maxReissues;
  outbox.maxOperatorRecoveries = policy.maxOperatorRecoveries;
  replaceEnvelope(outbox, now, "OUTREACH_SOURCE_OPERATOR_RECOVERY");
  audit(state, "outreach.source.dead_letter_recovered", {
    sourceId: SOURCE_ID,
    operator: actor,
    reason: recoveryReason,
    oldArtifactId,
    artifactId: outbox.artifact.artifactId,
    semanticDigest: outbox.semanticDigest,
    envelopeVersion: outbox.envelopeVersion,
    operatorRecoveryCount: outbox.operatorRecoveryCount
  });
  return Object.freeze({ artifactId: outbox.artifact.artifactId, semanticDigest: outbox.semanticDigest });
}

function prepareAndClaim(state, current, policy, owner) {
  const staged = stageReleaseSourceOutbox(state, current, policy);
  const outbox = staged.outbox;
  if (!outbox) return staged;
  normalizeOutbox(outbox, policy);

  if (outbox.status === "publishing") {
    const lockedUntil = Date.parse(outbox.lockedUntil ?? "");
    if (Number.isFinite(lockedUntil) && lockedUntil > current.getTime()) {
      return { reason: "in_progress", artifactId: outbox.artifact.artifactId, held: staged.held };
    }
    transitionAfterUnknownDelivery(state, outbox, current);
  }

  if (["pending", "retrying"].includes(outbox.status) && envelopeIsStale(outbox, current, policy.envelopeMaxAgeMs)) {
    if (!automaticReissue(state, outbox, current, "OUTREACH_SOURCE_ENVELOPE_EXPIRED")) {
      return { reason: "dead_letter", artifactId: outbox.artifact.artifactId, held: staged.held };
    }
  }
  if (outbox.status === "dead_letter") {
    return { reason: "dead_letter", artifactId: outbox.artifact.artifactId, held: staged.held };
  }
  if (outbox.status === "publishing") {
    return { reason: "in_progress", artifactId: outbox.artifact.artifactId, held: staged.held };
  }
  if (Date.parse(outbox.nextAttemptAt) > current.getTime()) {
    return { reason: "not_due", artifactId: outbox.artifact.artifactId, held: staged.held };
  }
  try {
    assertEnvelopeIntegrity(outbox);
  } catch (error) {
    deadLetter(state, outbox, error.code ?? "OUTREACH_SOURCE_OUTBOX_CORRUPT", current);
    return { reason: "dead_letter", artifactId: outbox.artifact.artifactId, held: staged.held };
  }
  if (outbox.attemptCount >= outbox.maxAttempts) {
    deadLetter(state, outbox, "OUTREACH_SOURCE_ATTEMPTS_EXHAUSTED", current);
    return { reason: "dead_letter", artifactId: outbox.artifact.artifactId, held: staged.held };
  }
  outbox.status = "publishing";
  outbox.attemptCount += 1;
  outbox.totalAttemptCount += 1;
  outbox.lockedBy = owner;
  outbox.leaseVersion += 1;
  outbox.lockedUntil = new Date(current.getTime() + Math.max(60_000, policy.timeoutMs * 2)).toISOString();
  return { outbox: structuredClone(outbox), held: staged.held };
}

function transitionAfterUnknownDelivery(state, outbox, current) {
  clearLease(outbox);
  if (outbox.attemptCount >= outbox.maxAttempts) {
    deadLetter(state, outbox, "OUTREACH_SOURCE_STALE_PUBLISH_LEASE", current);
    return;
  }
  outbox.status = "retrying";
  outbox.lastErrorCode = "OUTREACH_SOURCE_STALE_PUBLISH_LEASE";
  outbox.nextAttemptAt = current.toISOString();
  audit(state, "outreach.source.unknown_delivery_requeued", {
    sourceId: SOURCE_ID,
    artifactId: outbox.artifact.artifactId,
    semanticDigest: outbox.semanticDigest,
    attemptCount: outbox.attemptCount
  });
}

function failClaim(state, claim, error, current, policy) {
  const outbox = state.outreachSourceOutbox;
  if (!claimMatches(outbox, claim)) return "lease_lost";
  clearLease(outbox);
  outbox.lastErrorCode = error.code;
  if (error.code === "SOURCE_ARTIFACT_STALE") {
    if (!automaticReissue(state, outbox, current, error.code)) return "dead_letter";
    outbox.nextAttemptAt = new Date(current.getTime() + RETRY_BASE_MS).toISOString();
    return "reissued";
  }
  if (error.retryable && outbox.attemptCount < outbox.maxAttempts) {
    outbox.status = "retrying";
    outbox.nextAttemptAt = new Date(
      current.getTime() + Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.max(0, outbox.attemptCount - 1))
    ).toISOString();
    audit(state, "outreach.source.retry_scheduled", {
      sourceId: SOURCE_ID,
      artifactId: outbox.artifact.artifactId,
      semanticDigest: outbox.semanticDigest,
      errorCode: error.code,
      attemptCount: outbox.attemptCount,
      nextAttemptAt: outbox.nextAttemptAt
    });
    return "retrying";
  }
  deadLetter(state, outbox, error.code, current);
  return "dead_letter";
}

function completeClaim(state, claim, response, current) {
  const outbox = state.outreachSourceOutbox;
  if (!claimMatches(outbox, claim)) return false;
  state.outreachSourceCheckpoint = {
    semanticDigest: outbox.semanticDigest,
    contentDigest: outbox.semanticDigest,
    artifactId: outbox.artifact.artifactId,
    publishedAt: current.toISOString(),
    replayed: response.replayed
  };
  audit(state, "outreach.source.envelope_published", {
    sourceId: SOURCE_ID,
    artifactId: outbox.artifact.artifactId,
    semanticDigest: outbox.semanticDigest,
    envelopeVersion: outbox.envelopeVersion,
    attemptCount: outbox.attemptCount,
    totalAttemptCount: outbox.totalAttemptCount,
    replayed: response.replayed
  });
  state.outreachSourceOutbox = null;
  return true;
}

function automaticReissue(state, outbox, current, reason) {
  try {
    assertEnvelopeIntegrity(outbox);
  } catch (error) {
    deadLetter(state, outbox, error.code ?? "OUTREACH_SOURCE_OUTBOX_CORRUPT", current);
    return false;
  }
  if (outbox.reissueCount >= outbox.maxReissues) {
    deadLetter(state, outbox, "OUTREACH_SOURCE_REISSUES_EXHAUSTED", current);
    return false;
  }
  const oldArtifactId = outbox.artifact.artifactId;
  outbox.reissueCount += 1;
  replaceEnvelope(outbox, current, reason);
  audit(state, "outreach.source.envelope_reissued", {
    sourceId: SOURCE_ID,
    oldArtifactId,
    artifactId: outbox.artifact.artifactId,
    semanticDigest: outbox.semanticDigest,
    envelopeVersion: outbox.envelopeVersion,
    reissueCount: outbox.reissueCount,
    reason
  });
  return true;
}

function replaceEnvelope(outbox, generatedAt, reason) {
  const previousTimestamp = Date.parse(outbox.artifact.generatedAt);
  const nextTimestamp = Number.isFinite(previousTimestamp)
    ? Math.max(generatedAt.getTime(), previousTimestamp + 1)
    : generatedAt.getTime();
  const timestamp = new Date(nextTimestamp).toISOString();
  outbox.envelopeVersion += 1;
  outbox.artifact = createArtifact(outbox.artifact.records, timestamp, outbox.semanticDigest, outbox.envelopeVersion);
  outbox.rawBody = JSON.stringify(outbox.artifact);
  outbox.status = "pending";
  outbox.attemptCount = 0;
  outbox.nextAttemptAt = timestamp;
  outbox.lastErrorCode = reason;
  clearLease(outbox);
}

function deadLetter(state, outbox, code, current) {
  outbox.status = "dead_letter";
  outbox.lastErrorCode = String(code).slice(0, 120);
  outbox.nextAttemptAt = current.toISOString();
  clearLease(outbox);
  audit(state, "outreach.source.dead_lettered", {
    sourceId: SOURCE_ID,
    artifactId: outbox.artifact.artifactId,
    semanticDigest: outbox.semanticDigest,
    errorCode: outbox.lastErrorCode,
    attemptCount: outbox.attemptCount,
    totalAttemptCount: outbox.totalAttemptCount,
    reissueCount: outbox.reissueCount
  });
}

function clearLease(outbox) {
  outbox.lockedBy = null;
  outbox.lockedUntil = null;
}

function claimMatches(outbox, claim) {
  return Boolean(
    outbox &&
    outbox.status === "publishing" &&
    outbox.artifact?.artifactId === claim.artifact.artifactId &&
    outbox.lockedBy === claim.lockedBy &&
    outbox.leaseVersion === claim.leaseVersion
  );
}

function normalizeOutbox(outbox, policy) {
  outbox.semanticDigest ??= outbox.contentDigest;
  outbox.contentDigest ??= outbox.semanticDigest;
  outbox.rawBody ??= JSON.stringify(outbox.artifact);
  outbox.status ??= "pending";
  outbox.attemptCount = safeInteger(outbox.attemptCount, 0, 0, 1_000_000);
  outbox.totalAttemptCount = safeInteger(outbox.totalAttemptCount, outbox.attemptCount, 0, 1_000_000);
  outbox.maxAttempts = safeInteger(outbox.maxAttempts, policy.maxAttempts, 1, 20);
  outbox.reissueCount = safeInteger(outbox.reissueCount, 0, 0, 10_000);
  outbox.maxReissues = safeInteger(outbox.maxReissues, policy.maxReissues, 0, 10);
  outbox.operatorRecoveryCount = safeInteger(outbox.operatorRecoveryCount, 0, 0, 10_000);
  outbox.maxOperatorRecoveries = safeInteger(
    outbox.maxOperatorRecoveries,
    policy.maxOperatorRecoveries,
    0,
    10
  );
  outbox.envelopeVersion = safeInteger(outbox.envelopeVersion, 1, 1, 1_000_000);
  outbox.nextAttemptAt ??= outbox.stagedAt ?? outbox.artifact?.generatedAt;
  outbox.stagedAt ??= outbox.artifact?.generatedAt;
  outbox.lockedBy ??= null;
  outbox.lockedUntil ??= null;
  outbox.leaseVersion = safeInteger(outbox.leaseVersion, 0, 0, 1_000_000);
  outbox.lastErrorCode ??= null;
}

function assertEnvelopeIntegrity(outbox) {
  if (!outbox.artifact || outbox.artifact.sourceId !== SOURCE_ID || !Array.isArray(outbox.artifact.records)) {
    throw publishError("OUTREACH_SOURCE_OUTBOX_CORRUPT", false);
  }
  if (semanticDigestFor(outbox.artifact.records) !== outbox.semanticDigest) {
    throw publishError("OUTREACH_SOURCE_SEMANTIC_DIGEST_MISMATCH", false);
  }
  if (JSON.stringify(outbox.artifact) !== outbox.rawBody) {
    throw publishError("OUTREACH_SOURCE_ENVELOPE_BYTES_MISMATCH", false);
  }
}

function envelopeIsStale(outbox, current, maximumAgeMs) {
  const generatedAt = Date.parse(outbox.artifact?.generatedAt ?? "");
  return !Number.isFinite(generatedAt) || generatedAt < current.getTime() - maximumAgeMs;
}

function createArtifact(records, timestamp, semanticDigest, envelopeVersion) {
  return {
    schemaVersion: "1.0",
    sourceId: SOURCE_ID,
    artifactId: `snapshot-${timestamp.replace(/[^0-9]/gu, "").slice(0, 14)}-e${envelopeVersion}-${semanticDigest.slice(0, 24)}`,
    generatedAt: timestamp,
    records
  };
}

function semanticDigestFor(records) {
  return sha256(JSON.stringify(records));
}

function sourcePolicy(value = {}) {
  return Object.freeze({
    timeoutMs: safeInteger(value.timeoutMs, 10_000, 1_000, 60_000),
    maxAttempts: safeInteger(value.maxAttempts, DEFAULT_MAX_ATTEMPTS, 1, 20),
    maxReissues: safeInteger(value.maxReissues, DEFAULT_MAX_REISSUES, 0, 10),
    maxOperatorRecoveries: safeInteger(
      value.maxOperatorRecoveries,
      DEFAULT_MAX_OPERATOR_RECOVERIES,
      0,
      10
    ),
    envelopeMaxAgeMs: safeInteger(
      value.envelopeMaxAgeMs,
      DEFAULT_ENVELOPE_MAX_AGE_MS,
      3_600_000,
      DEFAULT_ENVELOPE_MAX_AGE_MS
    )
  });
}

function safeInteger(value, fallback, minimum, maximum) {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum ? value : fallback;
}

function toSourceRecord(release) {
  const isrc = optional(release.isrc)?.replaceAll("-", "").toUpperCase();
  const sourceUrl = httpsUrl(release.sourceUrl);
  const capturedAt = isoDate(release.sourceCapturedAt ?? release.updatedAt);
  const epkUrl = httpsUrl(release.epkUrl);
  const privateStreamUrl = httpsUrl(release.privateStreamUrl);
  if (!release.id || !release.title || !release.artistDisplayName || !/^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/u.test(isrc ?? "")) return undefined;
  if (!sourceUrl || !capturedAt || !optional(release.sourceEvidence) || (!epkUrl && !privateStreamUrl)) return undefined;
  const record = {
    kind: "musicRelease",
    externalId: `release-${sha256(String(release.id)).slice(0, 24)}`,
    isrc,
    name: String(release.title).trim().slice(0, 180),
    artistName: String(release.artistDisplayName).trim().slice(0, 180),
    ...(optional(release.description) ? { description: optional(release.description).slice(0, 8_000) } : {}),
    ...(isoDateOnly(release.releaseDate) ? { releaseDate: isoDateOnly(release.releaseDate) } : {}),
    ...(isoDateOnly(release.campaignStartDate) ? { campaignStartDate: isoDateOnly(release.campaignStartDate) } : {}),
    ...(isoDateOnly(release.campaignEndDate) ? { campaignEndDate: isoDateOnly(release.campaignEndDate) } : {}),
    genres: mapGenres(release.genre ?? release.genres),
    subGenres: mapSubGenres(release.subGenres),
    languages: mapLanguages(release.languages),
    territories: mapTerritories(release.territories),
    ...urlField("spotifyUrl", release.spotifyUrl ?? release.primaryReleaseUrl),
    ...urlField("websiteUrl", release.websiteUrl),
    ...(epkUrl ? { epkUrl } : {}),
    ...(privateStreamUrl ? { privateStreamUrl } : {}),
    ...urlField("downloadUrl", release.downloadUrl),
    ...urlField("artworkUrl", release.artworkUrl),
    ...urlField("radioEditUrl", release.radioEditUrl),
    priority: boundedValue(release.priority, 50, 0, 100),
    dailySendLimit: boundedValue(release.dailySendLimit, 20, 1, 1_000),
    evidence: {
      url: sourceUrl,
      text: optional(release.sourceEvidence).slice(0, 2_000),
      capturedAt
    }
  };
  return Object.freeze(record);
}

async function postOnce(rawBody, { config, fetch, now, nonce }) {
  const endpoint = `${config.baseUrl}/api/v1/source-ingestion/${SOURCE_ID}`;
  const timestamp = String(Math.floor(now().getTime() / 1_000));
  const requestNonce = nonce();
  const signature = createHmac("sha256", config.signingKey)
    .update(`v2\n${SOURCE_ID}\n${config.signingKeyId}\n${timestamp}\n${requestNonce}\n${sha256(rawBody)}`)
    .digest("hex");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-source-key-id": config.signingKeyId,
        "x-source-timestamp": timestamp,
        "x-source-nonce": requestNonce,
        "x-source-signature": `v2=${signature}`
      },
      body: rawBody,
      redirect: "error",
      signal: controller.signal
    });
    const body = await boundedResponse(response);
    if (response.ok) return { replayed: Boolean(body?.result?.replayed) };
    const code = body?.error?.code ?? `OUTREACH_SOURCE_HTTP_${response.status}`;
    throw publishError(
      code,
      response.status === 429 || response.status >= 500 || code === "SOURCE_ARTIFACT_IN_PROGRESS"
    );
  } catch (error) {
    if (isPublishError(error)) throw error;
    throw publishError(
      error?.name === "AbortError" ? "OUTREACH_SOURCE_TIMEOUT" : "OUTREACH_SOURCE_NETWORK_ERROR",
      true,
      error
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function boundedResponse(response) {
  const declared = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declared) && declared > 64_000) {
    throw publishError("OUTREACH_SOURCE_RESPONSE_TOO_LARGE", false);
  }
  const bytes = await readBoundedBody(response, 64_000);
  if (!bytes.length) return {};
  try { return JSON.parse(bytes.toString("utf8")); } catch { return {}; }
}

async function readBoundedBody(response, maximumBytes) {
  if (!response.body?.getReader) {
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > maximumBytes) throw publishError("OUTREACH_SOURCE_RESPONSE_TOO_LARGE", false);
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw publishError("OUTREACH_SOURCE_RESPONSE_TOO_LARGE", false);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock?.();
  }
  return Buffer.concat(chunks, total);
}

function mapGenres(value) {
  const values = Array.isArray(value) ? value : String(value ?? "").split(/[|,;]/u);
  return [...new Set(values.map((item) => GENRES.get(String(item).trim().toLowerCase()) ?? "Other"))].slice(0, 20);
}

function mapLanguages(value) {
  const values = Array.isArray(value) ? value : String(value ?? "").split(/[|,;]/u);
  return [...new Set(values.map((item) => String(item).trim().toLowerCase()).filter((item) => LANGUAGES.has(item)))].slice(0, 8);
}

function mapSubGenres(value) {
  const values = Array.isArray(value) ? value : String(value ?? "").split(/[|,;]/u);
  return [...new Set(values.map((item) => SUB_GENRES.get(String(item).trim().toLowerCase())).filter(Boolean))].slice(0, 20);
}

function mapTerritories(value) {
  const values = Array.isArray(value) ? value : String(value ?? "").split(/[|,;]/u);
  return [...new Set(values.map((item) => String(item).trim().toUpperCase()).filter((item) => /^[A-Z]{2}$/u.test(item)))].slice(0, 64);
}

function urlField(name, value) {
  const url = httpsUrl(value);
  return url ? { [name]: url } : {};
}

function httpsUrl(value) {
  if (typeof value !== "string" || !value) return undefined;
  try {
    return canonicalizeSourceHttpsUrl(value);
  } catch { return undefined; }
}

function isoDate(value) {
  const parsed = Date.parse(optional(value) ?? "");
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

function isoDateOnly(value) {
  const normalized = optional(value);
  return normalized && /^\d{4}-\d{2}-\d{2}$/u.test(normalized) ? normalized : undefined;
}

function boundedValue(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function boundedInteger(value, fallback, minimum, maximum) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) throw configError("numeric source publisher configuration is outside its bound");
  return parsed;
}

function isHttps(value) {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

function optional(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function validatedOperator(value) {
  const normalized = optional(value);
  if (!normalized || normalized.length > 80 || !/^[A-Za-z0-9][A-Za-z0-9@._-]*$/u.test(normalized)) {
    throw publishError("OUTREACH_SOURCE_RECOVERY_OPERATOR_INVALID", false);
  }
  return normalized;
}

function validatedReason(value) {
  const normalized = optional(value);
  if (!normalized || normalized.length < 12 || normalized.length > 240) {
    throw publishError("OUTREACH_SOURCE_RECOVERY_REASON_INVALID", false);
  }
  return normalized;
}

function configError(message) {
  return Object.assign(new Error(message), { code: "OUTREACH_SOURCE_CONFIG_INVALID" });
}

function publishError(code, retryable, cause) {
  return Object.assign(new Error("Release source artifact could not be published", { cause }), { code, retryable });
}

function normalizePublishError(error) {
  return isPublishError(error) ? error : publishError("OUTREACH_SOURCE_UNEXPECTED", true, error);
}

function isPublishError(error) {
  return typeof error?.code === "string" && typeof error?.retryable === "boolean";
}
