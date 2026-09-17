import { createHash } from "node:crypto";
import {
  listPlatformCapabilities,
  requirePlatformCapability,
  normalizePlatformId
} from "../../domain/music/platform-capabilities.mjs";

const DEFAULT_RETRY_POLICY = Object.freeze({
  maxAttempts: 3,
  backoff: "exponential_with_jitter"
});

export function createReleasePlan(input, options = {}) {
  const release = normalizeReleaseInput(input);
  const targetPlatformIds = normalizeTargetPlatforms(input.targetPlatforms, options);
  const actions = targetPlatformIds.map((platformId) => createPlatformAction(release, platformId));
  const summary = summarizeActions(actions);

  return Object.freeze({
    releaseId: release.releaseId,
    title: release.title,
    artist: release.artist,
    audioSource: release.audioSource,
    coverArtSource: release.coverArtSource,
    releaseDate: release.releaseDate,
    status: summary.apiUploadReady > 0 ? "planning_complete" : "manual_or_distribution_required",
    summary,
    actions: Object.freeze(actions)
  });
}

function createPlatformAction(release, platformId) {
  const platform = requirePlatformCapability(platformId);
  const idempotencyKey = createIdempotencyKey(release.releaseId, platform.id);
  const common = {
    platformId: platform.id,
    platformName: platform.name,
    idempotencyKey,
    officialApiStatus: platform.officialApiStatus,
    uploadSupport: platform.uploadSupport,
    requiredCredentialEnv: platform.requiredCredentialEnv,
    requirements: platform.requirements,
    retryPolicy: DEFAULT_RETRY_POLICY,
    apiUrl: platform.apiUrl
  };

  if (platform.canAutoPost) {
    return Object.freeze({
      ...common,
      mode: "api_upload",
      supportLevel: "adapter_ready",
      operation: chooseUploadOperation(platform, release),
      status: "needs_adapter_credentials",
      reason: "Official upload API exists; wire a platform adapter and OAuth/token storage before execution."
    });
  }

  if (platform.officialApiStatus === "distribution_only") {
    return Object.freeze({
      ...common,
      mode: "distributor_delivery",
      supportLevel: "distribution_required",
      operation: "prepare_distributor_package",
      status: "manual_delivery_required",
      reason: "This platform receives releases through distributors or delivery partners, not direct public upload APIs."
    });
  }

  if (platform.officialApiStatus === "possible_write_api") {
    return Object.freeze({
      ...common,
      mode: "research_required",
      supportLevel: "contract_or_docs_check_required",
      operation: "verify_write_access",
      status: "blocked_until_api_access_confirmed",
      reason: "A write-capable API plan exists, but current upload semantics and rights terms must be confirmed first."
    });
  }

  return Object.freeze({
    ...common,
    mode: "manual_upload",
    supportLevel: "manual",
    operation: "create_manual_task",
    status: "manual_upload_required",
    reason: "No reliable official public upload API was confirmed for this platform."
  });
}

function chooseUploadOperation(platform, release) {
  if (platform.uploadSupport === "video_upload") {
    return release.videoSource ? "upload_video" : "prepare_video_upload";
  }

  if (platform.uploadSupport === "episode_upload") {
    return "upload_episode";
  }

  if (platform.uploadSupport === "show_upload") {
    return "upload_show";
  }

  return "upload_track";
}

function normalizeReleaseInput(input) {
  if (!input || typeof input !== "object") {
    throw new TypeError("release input is required");
  }

  const title = requireString(input.title, "title");
  const artist = requireString(input.artist, "artist");
  const audioSource = requireString(input.audioSource ?? input.audioFile ?? input.audioUrl, "audioSource");
  const releaseId = optionalString(input.releaseId) ?? createReleaseId(title, artist, audioSource);

  return Object.freeze({
    releaseId,
    title,
    artist,
    audioSource,
    coverArtSource: optionalString(input.coverArtSource ?? input.coverArtFile ?? input.coverArtUrl),
    videoSource: optionalString(input.videoSource ?? input.videoFile ?? input.videoUrl),
    description: optionalString(input.description),
    releaseDate: normalizeReleaseDate(input.releaseDate)
  });
}

function normalizeTargetPlatforms(targetPlatforms, options) {
  if (targetPlatforms === undefined || targetPlatforms === null) {
    return listPlatformCapabilities({ observedOnly: options.observedOnly ?? true }).map(
      (platform) => platform.id
    );
  }

  if (!Array.isArray(targetPlatforms)) {
    throw new TypeError("targetPlatforms must be an array when provided");
  }

  const normalized = targetPlatforms.map(normalizePlatformId);

  if (normalized.length === 0) {
    throw new TypeError("targetPlatforms must contain at least one platform");
  }

  return [...new Set(normalized)];
}

function summarizeActions(actions) {
  const summary = {
    total: actions.length,
    apiUploadReady: 0,
    manualUploadRequired: 0,
    distributorDeliveryRequired: 0,
    researchRequired: 0
  };

  for (const action of actions) {
    if (action.mode === "api_upload") {
      summary.apiUploadReady += 1;
    } else if (action.mode === "manual_upload") {
      summary.manualUploadRequired += 1;
    } else if (action.mode === "distributor_delivery") {
      summary.distributorDeliveryRequired += 1;
    } else if (action.mode === "research_required") {
      summary.researchRequired += 1;
    }
  }

  return Object.freeze(summary);
}

function normalizeReleaseDate(value) {
  const date = optionalString(value);

  if (!date) {
    return undefined;
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    throw new TypeError("releaseDate must be a valid date string");
  }

  return parsed.toISOString();
}

function requireString(value, fieldName) {
  const normalized = optionalString(value);

  if (!normalized) {
    throw new TypeError(`${fieldName} is required`);
  }

  return normalized;
}

function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function createReleaseId(title, artist, audioSource) {
  return `rel_${createHash("sha256")
    .update(`${artist}\n${title}\n${audioSource}`)
    .digest("hex")
    .slice(0, 16)}`;
}

function createIdempotencyKey(releaseId, platformId) {
  return createHash("sha256").update(`${releaseId}:${platformId}`).digest("hex").slice(0, 32);
}

