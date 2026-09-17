import { createHash, randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { lstat, mkdir, open, readdir, realpath, unlink } from "node:fs/promises";
import { basename, extname, join, resolve, sep } from "node:path";

const DEFAULT_AUDIO_TYPES = Object.freeze(["audio/mpeg", "audio/wav", "audio/x-wav"]);
const DEFAULT_ARTWORK_TYPES = Object.freeze(["image/jpeg", "image/png", "image/webp"]);
const AUDIO_EXTENSIONS = new Set([".mp3", ".wav"]);
const ARTWORK_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const DEFAULT_ORPHAN_GRACE_MS = 60 * 60 * 1_000;
const DEFAULT_CLEANUP_MAX_FILES = 100;
const DEFAULT_CLEANUP_MAX_SCAN = 2_000;

export class ReleaseAssetStorage {
  constructor(options = {}) {
    this.rootDir = resolve(options.rootDir ?? process.env.MUSIC_UPLOAD_DIR ?? join(process.cwd(), "data", "uploads"));
    this.maxAudioBytes = options.maxAudioBytes ?? parseBytes(process.env.MUSIC_MAX_AUDIO_BYTES, 80 * 1024 * 1024);
    this.maxArtworkBytes =
      options.maxArtworkBytes ?? parseBytes(process.env.MUSIC_MAX_ARTWORK_BYTES, 15 * 1024 * 1024);
    this.allowedAudioTypes = new Set(options.allowedAudioTypes ?? DEFAULT_AUDIO_TYPES);
    this.allowedArtworkTypes = new Set(options.allowedArtworkTypes ?? DEFAULT_ARTWORK_TYPES);
  }

  async saveAsset({ releaseId, file, kind }) {
    const safeReleaseId = normalizeReleaseId(releaseId);
    const normalizedKind = normalizeKind(kind, file);
    validateFile(file, normalizedKind, this);
    const extension = extname(file.filename).toLowerCase();
    const checksumSha256 = createHash("sha256").update(file.data).digest("hex");
    const safeBaseName = sanitizeFilename(file.filename)
      .replace(new RegExp(`${escapeRegExp(extension)}$`, "iu"), "")
      .slice(0, 64) || "asset";
    const storageName = `${safeReleaseId}-${normalizedKind}-${safeBaseName}-${checksumSha256.slice(0, 10)}-${randomUUID().slice(0, 12)}${extension}`;
    const subdir = normalizedKind.startsWith("audio") ? "audio" : "artwork";
    const configuredDirectory = resolve(this.rootDir, subdir);
    if (!isWithin(this.rootDir, configuredDirectory)) throw storageBoundaryError();
    await mkdir(configuredDirectory, { recursive: true, mode: 0o700 });
    const rootRealPath = await realpath(this.rootDir);
    const directoryRealPath = await realpath(configuredDirectory);
    if (!isWithin(rootRealPath, directoryRealPath)) throw storageBoundaryError();
    const storagePath = resolve(directoryRealPath, storageName);
    if (!isWithin(rootRealPath, storagePath)) throw storageBoundaryError();

    let handle;
    let created = false;
    try {
      handle = await open(
        storagePath,
        fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | (fsConstants.O_NOFOLLOW ?? 0),
        0o600
      );
      created = true;
      await handle.writeFile(file.data);
      await handle.sync();
      await handle.close();
      handle = undefined;
    } catch (error) {
      await handle?.close().catch(() => {});
      if (created) await unlink(storagePath).catch(() => {});
      throw error;
    }

    return Object.freeze({
      id: `asset_${randomUUID()}`,
      releaseId: safeReleaseId,
      kind: normalizedKind,
      originalFilename: file.filename,
      storageFilename: storageName,
      storagePath,
      mimeType: file.contentType,
      sizeBytes: file.data.byteLength,
      checksumSha256,
      createdAt: new Date().toISOString()
    });
  }

  async deleteAsset(asset) {
    const candidate = await this.resolveStoredAsset(asset).catch((error) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    });
    if (!candidate) return false;
    await unlink(candidate);
    return true;
  }

  async cleanupOrphans(referencedAssets, options = {}) {
    const graceMs = boundedInteger(
      options.graceMs,
      DEFAULT_ORPHAN_GRACE_MS,
      DEFAULT_ORPHAN_GRACE_MS,
      30 * 24 * 60 * 60 * 1_000
    );
    const maximumDeletes = boundedInteger(options.maxDeletes, DEFAULT_CLEANUP_MAX_FILES, 1, 1_000);
    const maximumScan = boundedInteger(options.maxScan, DEFAULT_CLEANUP_MAX_SCAN, maximumDeletes, 10_000);
    const cutoff = (options.now ?? Date.now)() - graceMs;
    const referenced = new Set(
      (referencedAssets ?? []).map((asset) => `${assetSubdirectory(asset.kind)}/${asset.storageFilename}`)
    );
    let scanned = 0;
    let deleted = 0;
    let truncated = false;

    for (const subdir of ["audio", "artwork"]) {
      const directory = resolve(this.rootDir, subdir);
      let entries;
      try {
        entries = await readdir(directory, { withFileTypes: true });
      } catch (error) {
        if (error.code === "ENOENT") continue;
        throw error;
      }

      for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
        if (scanned >= maximumScan || deleted >= maximumDeletes) {
          truncated = true;
          break;
        }
        scanned += 1;
        if (!entry.isFile() || referenced.has(`${subdir}/${entry.name}`)) continue;

        const candidate = resolve(directory, entry.name);
        if (!isWithin(directory, candidate)) continue;
        const stats = await lstat(candidate).catch((error) => error.code === "ENOENT" ? undefined : Promise.reject(error));
        if (!stats?.isFile() || stats.mtimeMs > cutoff) continue;
        await unlink(candidate).catch((error) => {
          if (error.code !== "ENOENT") throw error;
        });
        deleted += 1;
      }
      if (truncated) break;
    }

    return Object.freeze({ scanned, deleted, truncated });
  }

  async resolveStoredAsset(asset) {
    const subdir = assetSubdirectory(asset?.kind);
    const filename = asset?.storageFilename;
    if (typeof filename !== "string" || filename !== basename(filename) || !filename) throw storageBoundaryError();
    const expectedPath = resolve(this.rootDir, subdir, filename);

    const [rootRealPath, directoryRealPath, fileRealPath, recordedRealPath] = await Promise.all([
      realpath(this.rootDir),
      realpath(resolve(this.rootDir, subdir)),
      realpath(expectedPath),
      asset.storagePath ? realpath(resolve(asset.storagePath)) : undefined
    ]);
    if (
      !isWithin(rootRealPath, directoryRealPath) ||
      !isWithin(directoryRealPath, fileRealPath) ||
      (recordedRealPath && recordedRealPath !== fileRealPath)
    ) {
      throw storageBoundaryError();
    }
    return fileRealPath;
  }
}

function normalizeReleaseId(value) {
  const releaseId = typeof value === "string" ? value.trim() : "";
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9_-]{0,62}[A-Za-z0-9])?$/u.test(releaseId)) {
    throw Object.assign(new Error("Invalid release asset identifier"), {
      statusCode: 400,
      code: "INVALID_RELEASE_ID"
    });
  }
  return releaseId;
}

function isWithin(parent, child) {
  return child === parent || child.startsWith(`${parent}${sep}`);
}

function storageBoundaryError() {
  return Object.assign(new Error("Release asset path is outside the configured upload root"), {
    statusCode: 400,
    code: "ASSET_PATH_FORBIDDEN"
  });
}

function normalizeKind(kind, file) {
  if (kind === "audio" || kind === "mp3" || kind === "wav") {
    const extension = extname(file.filename).toLowerCase();
    return extension === ".wav" ? "audio_wav" : "audio_mp3";
  }

  if (kind === "artwork") {
    return "artwork";
  }

  throw new TypeError(`Unsupported asset kind: ${kind}`);
}

function validateFile(file, kind, storage) {
  const extension = extname(file.filename ?? "").toLowerCase();

  if (kind.startsWith("audio")) {
    if (!storage.allowedAudioTypes.has(file.contentType) || !AUDIO_EXTENSIONS.has(extension)) {
      throw Object.assign(new Error("Audio file must be MP3 or WAV"), {
        statusCode: 400,
        code: "INVALID_AUDIO_FILE"
      });
    }

    if (file.data.byteLength > storage.maxAudioBytes) {
      throw Object.assign(new Error("Audio file is too large"), {
        statusCode: 413,
        code: "AUDIO_TOO_LARGE"
      });
    }
  } else {
    if (!storage.allowedArtworkTypes.has(file.contentType) || !ARTWORK_EXTENSIONS.has(extension)) {
      throw Object.assign(new Error("Artwork file must be JPG, PNG, or WEBP"), {
        statusCode: 400,
        code: "INVALID_ARTWORK_FILE"
      });
    }

    if (file.data.byteLength > storage.maxArtworkBytes) {
      throw Object.assign(new Error("Artwork file is too large"), {
        statusCode: 413,
        code: "ARTWORK_TOO_LARGE"
      });
    }
  }
}

function sanitizeFilename(filename) {
  return String(filename)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-zA-Z0-9._-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 120);
}

function parseBytes(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function assetSubdirectory(kind) {
  if (typeof kind === "string" && kind.startsWith("audio")) return "audio";
  if (kind === "artwork") return "artwork";
  throw storageBoundaryError();
}

function boundedInteger(value, fallback, minimum, maximum) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw Object.assign(new Error("Asset cleanup configuration is outside its allowed bound"), {
      statusCode: 400,
      code: "ASSET_CLEANUP_CONFIG_INVALID"
    });
  }
  return parsed;
}
