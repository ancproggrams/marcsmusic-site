import { ApplicationError, errorCode } from "../errors.mjs";
import {
  canonicalManifestDigest,
  compareEpkToMusicRelease,
  epkAssetChecks,
  parseEpkHtmlUrl,
  parseEpkResponse
} from "../domain/epk-verification.mjs";
import { createAbortScope } from "../infrastructure/abort-signal.mjs";

const ELIGIBLE_STATUSES = new Set(["Draft", "Paused"]);
const RUN_ID_PATTERN = /^[A-Za-z0-9._:-]{1,120}$/u;

export class EpkVerificationService {
  constructor({ crm, epkClient, approvedOrigins, totalTimeoutMs, now = () => new Date() }) {
    this.crm = crm;
    this.epkClient = epkClient;
    this.approvedOrigins = approvedOrigins;
    this.totalTimeoutMs = totalTimeoutMs;
    this.now = now;
  }

  async verifyRelease(releaseId, { runId, signal } = {}) {
    assertRunId(runId);
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const record = await this.crm.getRelease(releaseId);
      assertEligibleRecord(record, releaseId);
      const outcome = await this.#evaluate(record, { runId, signal });
      try {
        await this.crm.updateAttestation(record.id, outcome.payload, record.versionNumber);
      } catch (error) {
        if (isVersionConflict(error) && attempt === 1) continue;
        if (outcome.error) {
          throw new ApplicationError("EPK failure attestation could not be persisted", {
            code: "EPK_ATTESTATION_WRITE_FAILED",
            statusCode: 503,
            retryable: true,
            cause: error
          });
        }
        throw error;
      }
      if (outcome.error) throw outcome.error;
      return Object.freeze({
        releaseId: record.id,
        state: "Verified",
        manifestSha256: outcome.payload.epkManifestSha256,
        verifiedAt: outcome.payload.epkVerifiedAt,
        assetsChecked: outcome.assetsChecked
      });
    }
    throw new ApplicationError("EPK verification lost repeated optimistic concurrency races", {
      code: "EPK_VERSION_CONFLICT",
      statusCode: 409,
      retryable: true
    });
  }

  async verifyBatch(limit, { runId, signal } = {}) {
    assertRunId(runId);
    if (!Number.isInteger(limit) || limit < 1 || limit > 25) throw contractError("EPK_BATCH_LIMIT_INVALID");
    const releaseIds = await this.crm.listCandidateIds(limit);
    const results = [];
    for (const releaseId of releaseIds) {
      try {
        results.push(await this.verifyRelease(releaseId, { runId, signal }));
      } catch (error) {
        results.push(Object.freeze({
          releaseId,
          state: "Failed",
          code: errorCode(error),
          retryable: Boolean(error?.retryable)
        }));
      }
    }
    return Object.freeze({
      selected: releaseIds.length,
      verified: results.filter((result) => result.state === "Verified").length,
      failed: results.filter((result) => result.state === "Failed").length,
      results: Object.freeze(results)
    });
  }

  async #evaluate(record, { runId, signal }) {
    const abortScope = createAbortScope({ signals: [signal], timeoutMs: this.totalTimeoutMs });
    try {
      const routes = parseEpkHtmlUrl(record.epkUrl, this.approvedOrigins);
      await this.epkClient.fetchHealth(routes.healthUrl, { signal: abortScope.signal });
      const rawManifest = await this.epkClient.fetchManifest(routes.jsonUrl, `/api/epk/${routes.slug}`, {
        signal: abortScope.signal
      });
      const remote = parseEpkResponse(rawManifest, {
        expectedSlug: routes.slug,
        siteOrigin: routes.origin,
        approvedOrigins: this.approvedOrigins,
        now: this.now()
      });
      const html = await this.epkClient.fetchHtml(routes.htmlUrl, `/epk/${routes.slug}`, { signal: abortScope.signal });
      assertHtmlContract(html, routes, remote);
      const assets = epkAssetChecks(remote);
      await this.epkClient.probeAssets(assets, { signal: abortScope.signal });
      const confirmationRaw = await this.epkClient.fetchManifest(routes.jsonUrl, `/api/epk/${routes.slug}`, {
        signal: abortScope.signal
      });
      const confirmation = parseEpkResponse(confirmationRaw, {
        expectedSlug: routes.slug,
        siteOrigin: routes.origin,
        approvedOrigins: this.approvedOrigins,
        now: this.now()
      });
      const manifestSha256 = canonicalManifestDigest(remote);
      if (canonicalManifestDigest(confirmation) !== manifestSha256) {
        throw new ApplicationError("EPK manifest changed during verification", {
          code: "EPK_MANIFEST_CHANGED_DURING_VERIFICATION",
          statusCode: 409,
          retryable: true
        });
      }
      await this.epkClient.fetchHealth(routes.healthUrl, { signal: abortScope.signal });
      compareEpkToMusicRelease(record, remote, { htmlUrl: routes.htmlUrl });
      const verifiedAt = toEspoDateTime(this.now());
      return Object.freeze({
        payload: Object.freeze({
          epkAttestationState: "Verified",
          epkEvidenceReference: evidenceReference(runId, "verified"),
          epkManifestSha256: manifestSha256,
          epkVerifiedAt: verifiedAt
        }),
        assetsChecked: assets.length
      });
    } catch (caught) {
      const error = abortScope.timedOut
        ? new ApplicationError("EPK verification exceeded its total time bound", {
          code: "EPK_VERIFICATION_TIMEOUT",
          statusCode: 503,
          retryable: true,
          cause: caught
        })
        : normalizeError(caught);
      return Object.freeze({
        error,
        payload: Object.freeze({
          epkAttestationState: "Failed",
          epkEvidenceReference: evidenceReference(runId, `failed:${errorCode(error)}`),
          epkManifestSha256: null,
          epkVerifiedAt: null
        }),
        assetsChecked: 0
      });
    } finally {
      abortScope.cleanup();
    }
  }
}

function assertEligibleRecord(record, releaseId) {
  if (!record || record.id !== releaseId || !Number.isInteger(record.versionNumber) || record.versionNumber < 0) {
    throw contractError("EPK_RELEASE_RECORD_INVALID");
  }
  if (!ELIGIBLE_STATUSES.has(record.status)) {
    throw new ApplicationError("Only Draft or Paused releases can be EPK-verified", {
      code: "EPK_RELEASE_STATUS_INELIGIBLE",
      statusCode: 409,
      retryable: false,
      details: { allowedStatuses: [...ELIGIBLE_STATUSES] }
    });
  }
}

function assertHtmlContract(html, routes, remote) {
  const expected = [
    "<!doctype html>",
    `href="${escapeHtml(routes.htmlUrl)}"`,
    `href="${escapeHtml(routes.jsonUrl)}"`,
    `>${escapeHtml(remote.release.isrc)}<`,
    escapeHtml(remote.release.artist),
    escapeHtml(remote.release.title)
  ];
  if (/<script\b/iu.test(html) || expected.some((fragment) => !html.includes(fragment))) {
    throw new ApplicationError("EPK HTML does not match the verified public release", {
      code: "EPK_HTML_CONTRACT_MISMATCH",
      statusCode: 422,
      retryable: false
    });
  }
}

function evidenceReference(runId, outcome) {
  const value = `epk-verifier:${runId}:${outcome}`;
  if (value.length > 512) throw contractError("EPK_EVIDENCE_REFERENCE_TOO_LONG");
  return value;
}

function toEspoDateTime(value) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) throw contractError("EPK_VERIFIED_AT_INVALID");
  return parsed.toISOString().slice(0, 19).replace("T", " ");
}

function assertRunId(value) {
  if (typeof value !== "string" || !RUN_ID_PATTERN.test(value)) throw contractError("EPK_RUN_ID_INVALID");
}

function isVersionConflict(error) {
  return error?.statusCode === 409 || error?.code === "ESPOCRM_VERSION_CONFLICT";
}

function normalizeError(error) {
  if (error instanceof ApplicationError) return error;
  return new ApplicationError("EPK verification failed unexpectedly", {
    code: "EPK_VERIFICATION_FAILED",
    statusCode: 500,
    retryable: false,
    cause: error
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function contractError(code) {
  return new ApplicationError("EPK verifier contract failed", {
    code,
    statusCode: 500,
    retryable: false
  });
}
