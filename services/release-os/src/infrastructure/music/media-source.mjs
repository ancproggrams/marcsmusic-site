import { openAsBlob } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { basename, extname, isAbsolute, join, resolve, sep } from "node:path";
import { isProductionRuntime } from "../../config/runtime-environment.mjs";

const DEFAULT_MAX_MEDIA_BYTES = 80 * 1024 * 1024;
const DEFAULT_MAX_REMOTE_MEDIA_BYTES = 25 * 1024 * 1024;
const DEFAULT_MEDIA_TIMEOUT_MS = 10_000;
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
  const normalizedSource = requireSource(source);
  if (/^[a-z][a-z0-9+.-]*:/iu.test(normalizedSource)) {
    const url = parseSourceUrl(normalizedSource);
    if (url.protocol === "file:") throw mediaError("MEDIA_SOURCE_FILE_URL_FORBIDDEN", "file: media URLs are not permitted");
    if (url.protocol !== "https:") throw mediaError("MEDIA_SOURCE_SCHEME_FORBIDDEN", "remote media sources must use HTTPS");
    return createRemoteMediaFile(url, options);
  }

  return createManagedLocalMediaFile(normalizedSource, options);
}

async function createManagedLocalMediaFile(source, options) {
  const rootDir = resolve(
    options.rootDir ??
    options.env?.MUSIC_UPLOAD_DIR ??
    process.env.MUSIC_UPLOAD_DIR ??
    join(process.cwd(), "data", "uploads")
  );
  const candidatePath = resolveLocalFilePath(source, { rootDir });
  const [rootRealPath, fileRealPath] = await Promise.all([
    realpath(rootDir).catch(() => { throw mediaError("MEDIA_SOURCE_ROOT_UNAVAILABLE", "managed media root is unavailable"); }),
    realpath(candidatePath).catch(() => { throw mediaError("MEDIA_SOURCE_UNAVAILABLE", "managed media source is unavailable"); })
  ]);
  if (!isWithin(rootRealPath, fileRealPath)) {
    throw mediaError("MEDIA_SOURCE_PATH_FORBIDDEN", "media source is outside the managed upload root");
  }

  const fileStat = await stat(fileRealPath);
  if (!fileStat.isFile()) throw mediaError("MEDIA_SOURCE_NOT_FILE", "managed media source is not a file");
  const maximumBytes = mediaMaximumBytes(options);
  if (fileStat.size > maximumBytes) throw mediaError("MEDIA_SOURCE_TOO_LARGE", "media source exceeds the configured byte limit", 413);
  const contentType = options.contentType ?? inferContentType(fileRealPath);
  assertContentType(contentType, options);
  const blob = await openAsBlob(fileRealPath, { type: contentType });

  return Object.freeze({
    blob,
    contentType,
    filename: options.filename ?? basename(fileRealPath),
    path: fileRealPath,
    size: fileStat.size,
    sourceKind: "managed_local"
  });
}

async function createRemoteMediaFile(url, options) {
  if (isProductionRuntime(process.env) || isProductionRuntime(options.env)) {
    throw mediaError(
      "MEDIA_SOURCE_REMOTE_DISABLED",
      "remote media fetching is disabled in production; publish an application-managed upload instead"
    );
  }
  if (url.username || url.password || url.hash) {
    throw mediaError("MEDIA_SOURCE_URL_FORBIDDEN", "media source URL must not contain credentials or a fragment");
  }
  const allowedOrigins = parseAllowedOrigins(
    options.allowedHttpsOrigins ?? options.env?.MUSIC_MEDIA_SOURCE_HTTPS_ORIGINS ?? ""
  );
  if (!allowedOrigins.has(url.origin)) {
    throw mediaError("MEDIA_SOURCE_ORIGIN_FORBIDDEN", "media source HTTPS origin is not allow-listed");
  }
  const fetchImplementation = options.fetch ?? globalThis.fetch;
  if (typeof fetchImplementation !== "function") throw new TypeError("fetch implementation is required for HTTPS media sources");
  const timeoutMs = positiveInteger(
    options.timeoutMs ?? options.env?.MUSIC_MEDIA_SOURCE_TIMEOUT_MS,
    DEFAULT_MEDIA_TIMEOUT_MS
  );
  const maximumBytes = remoteMediaMaximumBytes(options);
  const controller = new AbortController();
  let timeout;
  const operation = (async () => {
    const response = await fetchImplementation(url, {
      method: "GET",
      headers: { accept: "audio/*" },
      redirect: "error",
      signal: controller.signal
    });
    if (!response.ok) throw mediaError("MEDIA_SOURCE_REQUEST_FAILED", `media source returned HTTP ${response.status}`, 502);
    const bytes = await readBoundedBody(response, maximumBytes, () => {
      throw mediaError("MEDIA_SOURCE_TOO_LARGE", "media source exceeds the configured byte limit", 413);
    });
    const declaredType = String(response.headers?.get?.("content-type") || "").split(";", 1)[0].trim().toLowerCase();
    const contentType = options.contentType ?? (declaredType || inferContentType(url.pathname));
    assertContentType(contentType, options);
    const filename = options.filename ?? safeRemoteFilename(url);
    return Object.freeze({
      blob: new Blob([bytes], { type: contentType }),
      contentType,
      filename,
      path: undefined,
      size: bytes.byteLength,
      sourceKind: "allowlisted_https"
    });
  })();
  try {
    return await Promise.race([
      operation,
      new Promise((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(mediaError("MEDIA_SOURCE_TIMEOUT", "media source request timed out", 504));
        }, timeoutMs);
      })
    ]);
  } catch (error) {
    if (error?.name === "AbortError") throw mediaError("MEDIA_SOURCE_TIMEOUT", "media source request timed out", 504);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function resolveLocalFilePath(source, options = {}) {
  const normalizedSource = requireSource(source);
  if (/^[a-z][a-z0-9+.-]*:/iu.test(normalizedSource)) {
    throw mediaError("MEDIA_SOURCE_LOCAL_URL_FORBIDDEN", "local media sources must be managed absolute paths, never URL schemes");
  }
  if (!isAbsolute(normalizedSource)) {
    throw mediaError("MEDIA_SOURCE_PATH_FORBIDDEN", "local media source must be an absolute managed path");
  }
  const rootDir = resolve(options.rootDir ?? join(process.cwd(), "data", "uploads"));
  const filePath = resolve(normalizedSource);
  if (!isWithin(rootDir, filePath)) {
    throw mediaError("MEDIA_SOURCE_PATH_FORBIDDEN", "media source is outside the managed upload root");
  }
  return filePath;
}

export function inferContentType(filePath) {
  return CONTENT_TYPES_BY_EXTENSION[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

async function readBoundedBody(response, maximumBytes, tooLarge) {
  const declared = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declared) && declared > maximumBytes) tooLarge();
  if (!response.body?.getReader) {
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > maximumBytes) tooLarge();
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
        await reader.cancel().catch(() => {});
        tooLarge();
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock?.();
  }
  return Buffer.concat(chunks, total);
}

function parseAllowedOrigins(value) {
  const values = Array.isArray(value) ? value : String(value || "").split(",");
  const origins = new Set();
  for (const raw of values.map((entry) => String(entry).trim()).filter(Boolean)) {
    let url;
    try { url = new URL(raw); } catch { throw mediaError("MEDIA_SOURCE_ALLOWLIST_INVALID", "media source origin allow-list is invalid", 500); }
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      throw mediaError("MEDIA_SOURCE_ALLOWLIST_INVALID", "media source allow-list entries must be HTTPS origins", 500);
    }
    origins.add(url.origin);
  }
  return origins;
}

function parseSourceUrl(value) {
  try { return new URL(value); } catch { throw mediaError("MEDIA_SOURCE_URL_INVALID", "media source URL is invalid"); }
}

function assertContentType(contentType, options) {
  const requiredPrefix = options.requiredContentTypePrefix;
  if (requiredPrefix && !String(contentType).toLowerCase().startsWith(requiredPrefix.toLowerCase())) {
    throw mediaError("MEDIA_SOURCE_CONTENT_TYPE_FORBIDDEN", `media source must use ${requiredPrefix} content`);
  }
}

function safeRemoteFilename(url) {
  let filename;
  try { filename = decodeURIComponent(basename(url.pathname)); } catch { filename = "media"; }
  return filename.replace(/[^A-Za-z0-9._-]+/gu, "-").replace(/^[-.]+|[-.]+$/gu, "").slice(0, 120) || "media";
}

function mediaMaximumBytes(options) {
  return positiveInteger(
    options.maxBytes ?? options.env?.MUSIC_MEDIA_SOURCE_MAX_BYTES ?? options.env?.MUSIC_MAX_AUDIO_BYTES,
    DEFAULT_MAX_MEDIA_BYTES
  );
}

function remoteMediaMaximumBytes(options) {
  return positiveInteger(
    options.maxBytes ?? options.env?.MUSIC_REMOTE_MEDIA_MAX_BYTES,
    Math.min(mediaMaximumBytes(options), DEFAULT_MAX_REMOTE_MEDIA_BYTES)
  );
}

function requireSource(value) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError("media source must be a non-empty string");
  return value.trim();
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}

function isWithin(parent, child) {
  return child === parent || child.startsWith(`${parent}${sep}`);
}

function mediaError(code, message, statusCode = 400) {
  return Object.assign(new Error(message), { code, statusCode, retryable: statusCode >= 500 });
}
