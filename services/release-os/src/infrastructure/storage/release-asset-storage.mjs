import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

const DEFAULT_AUDIO_TYPES = Object.freeze(["audio/mpeg", "audio/wav", "audio/x-wav"]);
const DEFAULT_ARTWORK_TYPES = Object.freeze(["image/jpeg", "image/png", "image/webp"]);
const AUDIO_EXTENSIONS = new Set([".mp3", ".wav"]);
const ARTWORK_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

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
    const normalizedKind = normalizeKind(kind, file);
    validateFile(file, normalizedKind, this);
    const extension = extname(file.filename).toLowerCase();
    const checksumSha256 = createHash("sha256").update(file.data).digest("hex");
    const safeBaseName = sanitizeFilename(file.filename).replace(new RegExp(`${escapeRegExp(extension)}$`, "iu"), "");
    const storageName = `${releaseId}-${normalizedKind}-${safeBaseName}-${checksumSha256.slice(0, 10)}${extension}`;
    const subdir = normalizedKind.startsWith("audio") ? "audio" : "artwork";
    const storagePath = resolve(this.rootDir, subdir, storageName);

    await mkdir(resolve(this.rootDir, subdir), { recursive: true });
    await writeFile(storagePath, file.data);

    return Object.freeze({
      id: `asset_${randomUUID()}`,
      releaseId,
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

