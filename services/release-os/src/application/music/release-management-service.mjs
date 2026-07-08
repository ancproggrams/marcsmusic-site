import { createHash } from "node:crypto";
import { createReleasePlan } from "./release-planner.mjs";
import { MARCSMUSIC_RELEASE_PLATFORM_IDS } from "../../domain/music/platform-capabilities.mjs";
import { normalizeSlug } from "../../domain/artists/artist-model.mjs";
import { audit } from "../../infrastructure/storage/json-store.mjs";

export function createReleaseManagementService({ store, assetStorage, artistService }) {
  if (!store || !assetStorage || !artistService) {
    throw new TypeError("release management service requires store, assetStorage, and artistService");
  }

  return Object.freeze({
    async createRelease({ fields, files }) {
      const title = requireString(fields.title, "title");
      const artistContext = await artistService.resolveReleaseArtists(fields);
      const releaseId = optionalString(fields.releaseId) ?? createReleaseId(title, artistContext.artistDisplayName);
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
        tags: normalizeTags(fields.tags),
        releaseDate: optionalString(fields.releaseDate),
        visibility: normalizeVisibility(fields.visibility),
        primaryReleaseUrl: optionalString(fields.primaryReleaseUrl),
        labelName: optionalString(fields.labelName),
        copyrightLine: optionalString(fields.copyrightLine),
        publisherLine: optionalString(fields.publisherLine)
      });
      const savedAssets = [];

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
        audit(state, "release.created", { releaseId, assetCount: savedAssets.length });
      });

      return Object.freeze({
        release: releaseWithAssets,
        assets: Object.freeze(savedAssets)
      });
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
    tags: Object.freeze(input.tags),
    releaseDate: input.releaseDate,
    visibility: input.visibility,
    primaryReleaseUrl: input.primaryReleaseUrl,
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

