import { openAsBlob } from "node:fs";
import { stat } from "node:fs/promises";
import { basename, extname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const CONTENT_TYPES_BY_EXTENSION = Object.freeze({
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".png": "image/png",
  ".wav": "audio/wav",
  ".webp": "image/webp"
});

export async function createMediaFile(source, options = {}) {
  const filePath = resolveLocalFilePath(source);
  const fileStat = await stat(filePath);

  if (!fileStat.isFile()) {
    throw new TypeError(`${options.fieldName ?? "media"} source is not a file: ${filePath}`);
  }

  const contentType = options.contentType ?? inferContentType(filePath);
  const blob = await openAsBlob(filePath, { type: contentType });

  return Object.freeze({
    blob,
    contentType,
    filename: options.filename ?? basename(filePath),
    path: filePath,
    size: fileStat.size
  });
}

export function resolveLocalFilePath(source) {
  if (typeof source !== "string" || !source.trim()) {
    throw new TypeError("media source must be a non-empty string");
  }

  const normalizedSource = source.trim();

  if (normalizedSource.startsWith("file://")) {
    return fileURLToPath(new URL(normalizedSource));
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//iu.test(normalizedSource)) {
    throw new TypeError(
      `Only local file sources are executable right now; received ${normalizedSource}`
    );
  }

  if (!isAbsolute(normalizedSource)) {
    throw new TypeError(`media source must be an absolute path or file:// URL: ${normalizedSource}`);
  }

  return normalizedSource;
}

export function inferContentType(filePath) {
  return CONTENT_TYPES_BY_EXTENSION[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}
