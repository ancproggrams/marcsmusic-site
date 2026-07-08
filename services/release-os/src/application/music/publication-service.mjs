import { createReleasePlan } from "./release-planner.mjs";
import { MARCSMUSIC_RELEASE_PLATFORM_IDS } from "../../domain/music/platform-capabilities.mjs";
import { defaultPlatformRegistry } from "../../domain/music/platform-registry.mjs";

const DEFAULT_VISIBILITY = "private";

export async function publishRelease(input, options = {}) {
  if (!input || typeof input !== "object") {
    throw new TypeError("release input is required");
  }

  const targetPlatforms = input.targetPlatforms ?? MARCSMUSIC_RELEASE_PLATFORM_IDS;
  const dryRun = normalizeDryRun(input, options);
  const plan = createReleasePlan({ ...input, targetPlatforms }, { observedOnly: false });
  const release = normalizePublicationRelease(input, plan);
  const registry = options.platformRegistry ?? defaultPlatformRegistry;
  const artist = options.artist;
  const platformAccounts = options.platformAccounts ?? {};
  const results = [];

  for (const action of plan.actions) {
    try {
      const adapter = registry.requireAdapter(action.platformId);
      results.push(
        await adapter.publish({
          release,
          artist,
          platformAccount: platformAccounts[action.platformId],
          action,
          dryRun,
          env: options.env,
          fetch: options.fetch
        })
      );
    } catch (error) {
      results.push(createExecutionFailure(action, dryRun, error));
    }
  }

  const summary = summarizeResults(results);

  return Object.freeze({
    releaseId: release.releaseId,
    title: release.title,
    artist: release.artist,
    dryRun,
    status: createBatchStatus(summary),
    targetPlatforms: Object.freeze(plan.actions.map((action) => action.platformId)),
    summary,
    plan,
    results: Object.freeze(results)
  });
}

function normalizePublicationRelease(input, plan) {
  return Object.freeze({
    releaseId: plan.releaseId,
    title: plan.title,
    artist: plan.artist,
    audioSource: plan.audioSource,
    coverArtSource: plan.coverArtSource,
    videoSource: optionalString(input.videoSource ?? input.videoFile ?? input.videoUrl),
    description: optionalString(input.description),
    genre: optionalString(input.genre),
    tags: Object.freeze(normalizeTags(input.tags)),
    releaseDate: plan.releaseDate,
    visibility: normalizeVisibility(input.visibility),
    primaryReleaseUrl: optionalString(input.primaryReleaseUrl)
  });
}

function normalizeDryRun(input, options) {
  if (typeof options.dryRun === "boolean") {
    return options.dryRun;
  }

  if (typeof input.dryRun === "boolean") {
    return input.dryRun;
  }

  return true;
}

function summarizeResults(results) {
  const summary = {
    total: results.length,
    dryRun: 0,
    submitted: 0,
    manualTask: 0,
    blocked: 0,
    failed: 0
  };

  for (const result of results) {
    if (result.status === "dry_run") {
      summary.dryRun += 1;
    } else if (result.status === "submitted") {
      summary.submitted += 1;
    } else if (result.status === "manual_task") {
      summary.manualTask += 1;
    } else if (result.status === "blocked") {
      summary.blocked += 1;
    } else if (result.status === "failed") {
      summary.failed += 1;
    }
  }

  return Object.freeze(summary);
}

function createBatchStatus(summary) {
  if (summary.failed > 0) {
    return "failed";
  }

  if (summary.blocked > 0 && summary.submitted > 0) {
    return "partially_submitted_with_blocks";
  }

  if (summary.blocked > 0) {
    return "blocked";
  }

  if (summary.submitted > 0) {
    return "submitted";
  }

  return "planned";
}

function createExecutionFailure(action, dryRun, error) {
  return Object.freeze({
    platformId: action.platformId,
    platformName: action.platformName,
    idempotencyKey: action.idempotencyKey,
    mode: action.mode,
    operation: action.operation,
    status: "failed",
    dryRun,
    message: error.message,
    requiredCredentialEnv: action.requiredCredentialEnv,
    requirements: action.requirements
  });
}

function normalizeTags(value) {
  if (value === undefined || value === null) {
    return [];
  }

  if (Array.isArray(value)) {
    return [...new Set(value.map(optionalString).filter(Boolean))];
  }

  if (typeof value === "string") {
    return [
      ...new Set(
        value
          .split(/[,\n]/u)
          .map(optionalString)
          .filter(Boolean)
      )
    ];
  }

  throw new TypeError("tags must be an array or comma-separated string when provided");
}

function normalizeVisibility(value) {
  const normalized = optionalString(value);

  if (!normalized) {
    return DEFAULT_VISIBILITY;
  }

  if (!["private", "public", "unlisted"].includes(normalized)) {
    throw new TypeError("visibility must be private, public, or unlisted");
  }

  return normalized;
}

function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
