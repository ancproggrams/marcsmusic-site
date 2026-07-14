import { createHash, randomUUID } from "node:crypto";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";

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
    const assetUuid = randomUUID();
    const storageName = `${assetUuid}-${checksumSha256}${extension}`;
    const subdir = normalizedKind.startsWith("audio") ? "audio" : "artwork";
    const subdirPath = resolve(this.rootDir, subdir);

    await mkdir(this.rootDir, { recursive: true });
    await mkdir(subdirPath, { recursive: true });

    const realRootDir = await realpath(this.rootDir);
    const realSubdirPath = await realpath(subdirPath);
    assertContained(realRootDir, realSubdirPath);

    const storagePath = resolve(realSubdirPath, storageName);
    assertContained(realRootDir, storagePath);
    await writeFile(storagePath, file.data, { flag: "wx", mode: 0o600 });

    return Object.freeze({
      id: `asset_${assetUuid}`,
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

function assertContained(rootDir, candidatePath) {
  const pathFromRoot = relative(rootDir, candidatePath);

  if (isAbsolute(pathFromRoot) || pathFromRoot === ".." || pathFromRoot.startsWith(`..${sep}`)) {
    throw Object.assign(new Error("Asset storage path escapes the configured root"), {
      statusCode: 500,
      code: "ASSET_STORAGE_ESCAPE"
    });
  }
}

function parseBytes(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}
