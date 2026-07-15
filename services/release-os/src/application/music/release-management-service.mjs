import { createHash } from "node:crypto";
import { createReleasePlan } from "./release-planner.mjs";
import { MARCSMUSIC_RELEASE_PLATFORM_IDS } from "../../domain/music/platform-capabilities.mjs";
import { normalizeSlug } from "../../domain/artists/artist-model.mjs";
import { audit } from "../../infrastructure/storage/json-store.mjs";

const OUTREACH_SUB_GENRES = new Set([
  "Afro", "Caribbean", "Club", "Downtempo", "Indie Dance", "Melodic", "Reggaeton", "Tropical", "World Fusion", "Other"
]);

export function createReleaseManagementService({ store, assetStorage, artistService, sourceOutboxStager }) {
  if (!store || !assetStorage || !artistService) {
    throw new TypeError("release management service requires store, assetStorage, and artistService");
  }

  return Object.freeze({
    async createRelease({ fields, files }) {
      const title = requireString(fields.title, "title");
      const artistContext = await artistService.resolveReleaseArtists(fields);
      const releaseId = fields.releaseId
        ? normalizeReleaseId(fields.releaseId)
        : createReleaseId(title, artistContext.artistDisplayName);
      const release = normalizeReleaseRecord({
        id: releaseId,
        title,
        artist: artistContext.artistDisplayName,
        primaryArtistId: artistContext.primaryArtist.id,
        artistIds: [artistContext.primaryArtist.id, ...artistContext.featuredArtists.map((artist) => artist.id)],
        featuredArtistIds: artistContext.featuredArtists.map((artist) => artist.id),
        artistDisplayName: artistContext.artistDisplayName,
        description: optionalString(fields.description),
        genre: optionalString(fields.genre),
        subGenres: normalizeControlledList(fields.subGenres, OUTREACH_SUB_GENRES, "subGenres", 20),
        tags: normalizeTags(fields.tags),
        languages: normalizeTags(fields.languages),
        territories: normalizeTerritories(fields.territories),
        releaseDate: optionalString(fields.releaseDate),
        campaignStartDate: optionalString(fields.campaignStartDate),
        campaignEndDate: optionalString(fields.campaignEndDate),
        visibility: normalizeVisibility(fields.visibility),
        primaryReleaseUrl: optionalString(fields.primaryReleaseUrl),
        spotifyUrl: optionalHttpsUrl(fields.spotifyUrl),
        websiteUrl: optionalHttpsUrl(fields.websiteUrl),
        epkUrl: optionalHttpsUrl(fields.epkUrl),
        privateStreamUrl: optionalHttpsUrl(fields.privateStreamUrl),
        downloadUrl: optionalHttpsUrl(fields.downloadUrl),
        artworkUrl: optionalHttpsUrl(fields.artworkUrl),
        radioEditUrl: optionalHttpsUrl(fields.radioEditUrl),
        isrc: normalizeIsrc(fields.isrc),
        priority: boundedInteger(fields.priority, 50, 0, 100),
        dailySendLimit: boundedInteger(fields.dailySendLimit, 20, 1, 1_000),
        sourceUrl: optionalHttpsUrl(fields.sourceUrl),
        sourceEvidence: optionalString(fields.sourceEvidence),
        sourceCapturedAt: optionalIsoDateTime(fields.sourceCapturedAt),
        labelName: optionalString(fields.labelName),
        copyrightLine: optionalString(fields.copyrightLine),
        publisherLine: optionalString(fields.publisherLine)
      });
      const savedAssets = [];

      try {
        for (const file of files) {
          if (["audio", "mp3", "wav", "artwork"].includes(file.name)) {
            savedAssets.push(await assetStorage.saveAsset({ releaseId, file, kind: file.name }));
          }
        }

        if (!savedAssets.some((asset) => asset.kind.startsWith("audio"))) {
          throw Object.assign(new Error("At least one MP3 or WAV audio file is required"), {
            statusCode: 400,
            code: "AUDIO_REQUIRED"
          });
        }

        const releaseWithAssets = attachAssetIds(release, savedAssets);

        await store.update((state) => {
          state.releases.push(releaseWithAssets);
          state.assets.push(...savedAssets);
          sourceOutboxStager?.(state, new Date(releaseWithAssets.updatedAt));
          audit(state, "release.created", { releaseId, assetCount: savedAssets.length });
        });

        return Object.freeze({
          release: releaseWithAssets,
          assets: Object.freeze(savedAssets)
        });
      } catch (error) {
        const cleanupResults = await Promise.allSettled(
          [...savedAssets].reverse().map((asset) => assetStorage.deleteAsset(asset))
        );
        const cleanupFailures = cleanupResults
          .filter((result) => result.status === "rejected")
          .map((result) => result.reason);
        if (cleanupFailures.length > 0) {
          Object.defineProperty(error, "assetCleanupFailures", {
            configurable: true,
            enumerable: false,
            value: Object.freeze(cleanupFailures)
          });
        }
        throw error;
      }
    },

    async getRelease(releaseId) {
      const state = await store.read();
      const release = findReleaseOrThrow(state, releaseId);
      return Object.freeze({
        release,
        assets: Object.freeze(state.assets.filter((asset) => asset.releaseId === release.id))
      });
    },

    async planRelease(releaseId, input = {}) {
      const { release, assets } = await this.getRelease(releaseId);
      return createReleasePlan(toPublicationInput(release, assets, input));
    },

    async toPublicationInput(releaseId, input = {}) {
      const { release, assets } = await this.getRelease(releaseId);
      return toPublicationInput(release, assets, input);
    },

    async cleanupOrphanAssets(options = {}) {
      const state = await store.read();
      const { operator, ...cleanupOptions } = options;
      const result = await assetStorage.cleanupOrphans(state.assets, cleanupOptions);
      await store.update((nextState) => {
        audit(nextState, "assets.orphans_cleaned", {
          ...result,
          ...(typeof operator === "string" ? { operator } : {})
        });
      });
      return result;
    }
  });
}

export function toPublicationInput(release, assets, overrides = {}) {
  const audioAsset =
    assets.find((asset) => asset.id === release.mp3AssetId) ??
    assets.find((asset) => asset.id === release.wavAssetId) ??
    assets.find((asset) => asset.kind.startsWith("audio"));
  const artworkAsset = assets.find((asset) => asset.id === release.artworkAssetId);

  return {
    releaseId: release.id,
    title: release.title,
    artist: release.artistDisplayName,
    audioSource: audioAsset?.storagePath,
    coverArtSource: artworkAsset?.storagePath,
    description: release.description,
    genre: release.genre,
    tags: release.tags,
    releaseDate: release.releaseDate,
    visibility: release.visibility,
    primaryReleaseUrl: release.primaryReleaseUrl,
    targetPlatforms: overrides.targetPlatforms ?? MARCSMUSIC_RELEASE_PLATFORM_IDS,
    dryRun: overrides.dryRun
  };
}

function normalizeReleaseRecord(input) {
  const now = new Date().toISOString();
  return Object.freeze({
    id: input.id,
    slug: normalizeSlug(`${input.artistDisplayName}-${input.title}`),
    title: input.title,
    artist: input.artist,
    primaryArtistId: input.primaryArtistId,
    artistIds: Object.freeze([...new Set(input.artistIds)]),
    featuredArtistIds: Object.freeze([...new Set(input.featuredArtistIds)]),
    artistDisplayName: input.artistDisplayName,
    description: input.description,
    genre: input.genre,
    subGenres: Object.freeze(input.subGenres),
    tags: Object.freeze(input.tags),
    languages: Object.freeze(input.languages),
    territories: Object.freeze(input.territories),
    releaseDate: input.releaseDate,
    campaignStartDate: input.campaignStartDate,
    campaignEndDate: input.campaignEndDate,
    visibility: input.visibility,
    primaryReleaseUrl: input.primaryReleaseUrl,
    spotifyUrl: input.spotifyUrl,
    websiteUrl: input.websiteUrl,
    epkUrl: input.epkUrl,
    privateStreamUrl: input.privateStreamUrl,
    downloadUrl: input.downloadUrl,
    artworkUrl: input.artworkUrl,
    radioEditUrl: input.radioEditUrl,
    isrc: input.isrc,
    priority: input.priority,
    dailySendLimit: input.dailySendLimit,
    sourceUrl: input.sourceUrl,
    sourceEvidence: input.sourceEvidence,
    sourceCapturedAt: input.sourceCapturedAt,
    labelName: input.labelName,
    copyrightLine: input.copyrightLine,
    publisherLine: input.publisherLine,
    status: "created",
    createdAt: now,
    updatedAt: now
  });
}

function attachAssetIds(release, assets) {
  const mp3 = assets.find((asset) => asset.kind === "audio_mp3");
  const wav = assets.find((asset) => asset.kind === "audio_wav");
  const artwork = assets.find((asset) => asset.kind === "artwork");

  return Object.freeze({
    ...release,
    audioAssetId: mp3?.id ?? wav?.id,
    mp3AssetId: mp3?.id,
    wavAssetId: wav?.id,
    artworkAssetId: artwork?.id
  });
}

function findReleaseOrThrow(state, releaseId) {
  const release = state.releases.find((entry) => entry.id === releaseId || entry.slug === releaseId);

  if (!release) {
    throw Object.assign(new Error(`Release not found: ${releaseId}`), {
      statusCode: 404,
      code: "RELEASE_NOT_FOUND"
    });
  }

  return release;
}

function createReleaseId(title, artist) {
  return `rel_${createHash("sha256")
    .update(`${artist}\n${title}\n${Date.now()}`)
    .digest("hex")
    .slice(0, 16)}`;
}

function normalizeReleaseId(value) {
  const releaseId = optionalString(value);
  if (!releaseId || !/^[A-Za-z0-9](?:[A-Za-z0-9_-]{0,62}[A-Za-z0-9])?$/u.test(releaseId)) {
    throw Object.assign(new Error("releaseId must be a 1-64 character identifier containing only letters, numbers, '_' or '-'"), {
      statusCode: 400,
      code: "INVALID_RELEASE_ID"
    });
  }
  return releaseId;
}

function requireString(value, fieldName) {
  const normalized = optionalString(value);

  if (!normalized) {
    throw Object.assign(new Error(`${fieldName} is required`), {
      statusCode: 400,
      code: "VALIDATION_ERROR"
    });
  }

  return normalized;
}

function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeTags(value) {
  if (!value) {
    return [];
  }

  const values = Array.isArray(value) ? value : String(value).split(/[,\n]/u);
  return [...new Set(values.map(optionalString).filter(Boolean))];
}

function normalizeControlledList(value, allowed, fieldName, maximum) {
  const values = normalizeTags(value);
  if (values.length > maximum || values.some((item) => !allowed.has(item))) {
    throw validationError(`${fieldName} must contain at most ${maximum} controlled values`);
  }
  return values;
}

function normalizeTerritories(value) {
  const values = [...new Set(normalizeTags(value).map((item) => item.toUpperCase()))];
  if (values.length > 64 || values.some((item) => !/^[A-Z]{2}$/u.test(item))) {
    throw validationError("territories must contain at most 64 ISO alpha-2 country codes");
  }
  return values;
}

function validationError(message) {
  return Object.assign(new Error(message), { statusCode: 400, code: "VALIDATION_ERROR" });
}

function normalizeVisibility(value) {
  const normalized = optionalString(value);

  if (!normalized) {
    return "private";
  }

  if (!["private", "public", "unlisted"].includes(normalized)) {
    throw Object.assign(new Error("visibility must be private, public, or unlisted"), {
      statusCode: 400,
      code: "VALIDATION_ERROR"
    });
  }

  return normalized;
}

function normalizeIsrc(value) {
  const normalized = optionalString(value)?.replaceAll("-", "").toUpperCase();
  if (!normalized) return undefined;
  if (!/^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/u.test(normalized)) {
    throw Object.assign(new Error("isrc must be a valid 12-character ISRC"), {
      statusCode: 400,
      code: "VALIDATION_ERROR"
    });
  }
  return normalized;
}

function optionalHttpsUrl(value) {
  const normalized = optionalString(value);
  if (!normalized) return undefined;
  try {
    const url = new URL(normalized);
    if (url.protocol !== "https:") throw new Error();
    return url.toString();
  } catch {
    throw Object.assign(new Error("source and outreach URLs must use valid HTTPS"), {
      statusCode: 400,
      code: "VALIDATION_ERROR"
    });
  }
}

function optionalIsoDateTime(value) {
  const normalized = optionalString(value);
  if (!normalized) return undefined;
  const timestamp = Date.parse(normalized);
  if (!Number.isFinite(timestamp)) {
    throw Object.assign(new Error("sourceCapturedAt must be an ISO timestamp"), {
      statusCode: 400,
      code: "VALIDATION_ERROR"
    });
  }
  return new Date(timestamp).toISOString();
}

function boundedInteger(value, fallback, minimum, maximum) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw Object.assign(new Error(`numeric field must be between ${minimum} and ${maximum}`), {
      statusCode: 400,
      code: "VALIDATION_ERROR"
    });
  }
  return parsed;
}
