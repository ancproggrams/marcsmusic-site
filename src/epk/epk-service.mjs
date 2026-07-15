import { constants as fsConstants, lstat, open, realpath } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, extname, resolve, sep } from "node:path";

import { createEpkUrlPolicy, EPK_MANIFEST_MAX_BYTES, validateEpkManifest } from "./epk-contract.mjs";
import { contentSecurityPolicyForRelease, renderEpkPage } from "./epk-page.mjs";

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u;
const DEFAULT_RELOAD_INTERVAL_MS = 1_000;

export function createEpkService({
  manifestRoot,
  manifestPath,
  siteOrigin,
  allowedHttpsOrigins = [],
  sameOriginAssetPrefixes = ["/assets/epk/"],
  reloadIntervalMs = DEFAULT_RELOAD_INTERVAL_MS,
  now = () => Date.now()
} = {}) {
  let configuration;
  let snapshot;
  let reloadInFlight;
  let nextReloadAt = 0;
  let lastErrorCode;
  let lastLoadedAt;

  try {
    configuration = normalizeConfiguration({ manifestRoot, manifestPath, siteOrigin, allowedHttpsOrigins, sameOriginAssetPrefixes });
  } catch (error) {
    lastErrorCode = safeErrorCode(error, "EPK_CONFIGURATION_INVALID");
  }

  async function initialize() {
    await refresh({ force: true });
    return capability();
  }

  async function refresh({ force = false } = {}) {
    if (!configuration) return snapshot;
    const timestamp = now();
    if (!force && timestamp < nextReloadAt) return snapshot;
    if (reloadInFlight) return reloadInFlight;
    nextReloadAt = timestamp + reloadIntervalMs;
    reloadInFlight = loadSnapshot(configuration, snapshot)
      .then((next) => {
        snapshot = next;
        lastErrorCode = undefined;
        lastLoadedAt = new Date(now()).toISOString();
        return snapshot;
      })
      .catch((error) => {
        lastErrorCode = safeErrorCode(error, "EPK_MANIFEST_INVALID");
        return snapshot;
      })
      .finally(() => { reloadInFlight = undefined; });
    return reloadInFlight;
  }

  function capability() {
    return Object.freeze({
      available: Boolean(snapshot),
      configured: Boolean(configuration),
      stale: Boolean(snapshot && lastErrorCode),
      lastErrorCode,
      lastLoadedAt,
      releaseCount: snapshot?.manifest.releases.length ?? 0
    });
  }

  async function handle(request, response, url) {
    const route = matchRoute(url.pathname);
    if (!route) return false;
    if (!["GET", "HEAD"].includes(request.method || "")) {
      send(response, request.method, 405, Buffer.from("Method not allowed", "utf8"), {
        ...baseSecurityHeaders(),
        allow: "GET, HEAD",
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store"
      });
      return true;
    }

    await refresh();
    const release = snapshot?.bySlug.get(route.slug);
    if (!release) {
      send(response, request.method, 404, Buffer.from(route.format === "json" ? '{"error":"EPK_NOT_FOUND"}' : "EPK not found", "utf8"), {
        ...baseSecurityHeaders(),
        "content-security-policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
        "content-type": route.format === "json" ? "application/json; charset=utf-8" : "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-robots-tag": "noindex, nofollow"
      });
      return true;
    }

    const representation = route.format === "json"
      ? JSON.stringify({ schemaVersion: snapshot.manifest.schemaVersion, generatedAt: snapshot.manifest.generatedAt, release })
      : renderEpkPage({ release, manifestGeneratedAt: snapshot.manifest.generatedAt, siteOrigin: configuration.urlPolicy.siteOrigin });
    const body = Buffer.from(representation, "utf8");
    const etag = `"${createHash("sha256").update(body).digest("base64url")}"`;
    const headers = {
      ...baseSecurityHeaders(),
      "content-security-policy": route.format === "json"
        ? "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
        : contentSecurityPolicyForRelease(release, configuration.urlPolicy.siteOrigin),
      "content-type": route.format === "json" ? "application/json; charset=utf-8" : "text/html; charset=utf-8",
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
      etag,
      "last-modified": new Date(snapshot.modifiedMs).toUTCString(),
      vary: "Accept-Encoding",
      ...(route.format === "json" ? { "x-robots-tag": "noindex" } : {})
    };
    if (isNotModified(request.headers, etag, snapshot.modifiedMs)) {
      response.writeHead(304, headers);
      response.end();
      return true;
    }
    send(response, request.method, 200, body, headers);
    return true;
  }

  return Object.freeze({ initialize, refresh, capability, handle });
}

async function loadSnapshot(configuration, previous) {
  const rootRealPath = await realpath(configuration.manifestRoot).catch((error) => {
    throw loaderError(error?.code === "ENOENT" ? "EPK_MANIFEST_NOT_FOUND" : "EPK_MANIFEST_ROOT_UNAVAILABLE");
  });
  const parentRealPath = await realpath(dirname(configuration.manifestPath)).catch(() => {
    throw loaderError("EPK_MANIFEST_PARENT_UNAVAILABLE");
  });
  if (!isWithin(rootRealPath, parentRealPath)) throw loaderError("EPK_MANIFEST_PATH_FORBIDDEN");
  const metadata = await lstat(configuration.manifestPath).catch((error) => {
    throw loaderError(error?.code === "ENOENT" ? "EPK_MANIFEST_NOT_FOUND" : "EPK_MANIFEST_STAT_FAILED");
  });
  if (metadata.isSymbolicLink() || !metadata.isFile()) throw loaderError("EPK_MANIFEST_FILE_UNSAFE");
  if (metadata.size < 2 || metadata.size > EPK_MANIFEST_MAX_BYTES) throw loaderError("EPK_MANIFEST_SIZE_INVALID");
  const fingerprint = `${metadata.dev}:${metadata.ino}:${metadata.size}:${metadata.mtimeMs}`;
  if (previous?.fingerprint === fingerprint) return previous;

  const noFollow = fsConstants.O_NOFOLLOW ?? 0;
  const handle = await open(configuration.manifestPath, fsConstants.O_RDONLY | noFollow).catch(() => {
    throw loaderError("EPK_MANIFEST_OPEN_FAILED");
  });
  let raw;
  let openedMetadata;
  try {
    openedMetadata = await handle.stat();
    if (!openedMetadata.isFile() || openedMetadata.size < 2 || openedMetadata.size > EPK_MANIFEST_MAX_BYTES) {
      throw loaderError("EPK_MANIFEST_SIZE_INVALID");
    }
    raw = await handle.readFile({ encoding: "utf8" });
    const afterReadMetadata = await handle.stat();
    if (
      openedMetadata.dev !== afterReadMetadata.dev || openedMetadata.ino !== afterReadMetadata.ino ||
      openedMetadata.size !== afterReadMetadata.size || openedMetadata.mtimeMs !== afterReadMetadata.mtimeMs ||
      Buffer.byteLength(raw) !== openedMetadata.size
    ) {
      throw loaderError("EPK_MANIFEST_CHANGED_DURING_READ");
    }
  } finally {
    await handle.close().catch(() => {});
  }
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    throw loaderError("EPK_MANIFEST_JSON_INVALID");
  }
  const manifest = validateEpkManifest(input, { urlPolicy: configuration.urlPolicy, allowExample: false });
  return Object.freeze({
    manifest,
    bySlug: new Map(manifest.releases.map((release) => [release.slug, release])),
    fingerprint: `${openedMetadata.dev}:${openedMetadata.ino}:${openedMetadata.size}:${openedMetadata.mtimeMs}`,
    modifiedMs: openedMetadata.mtimeMs
  });
}

function normalizeConfiguration({ manifestRoot, manifestPath, siteOrigin, allowedHttpsOrigins, sameOriginAssetPrefixes }) {
  if (!manifestRoot || !manifestPath) throw loaderError("EPK_NOT_CONFIGURED");
  const resolvedRoot = resolve(String(manifestRoot));
  const resolvedPath = resolve(String(manifestPath));
  if (!isWithin(resolvedRoot, resolvedPath) || extname(resolvedPath).toLowerCase() !== ".json") {
    throw loaderError("EPK_MANIFEST_PATH_FORBIDDEN");
  }
  const urlPolicy = createEpkUrlPolicy({ siteOrigin, allowedHttpsOrigins, sameOriginAssetPrefixes });
  return Object.freeze({ manifestRoot: resolvedRoot, manifestPath: resolvedPath, urlPolicy });
}

function matchRoute(pathname) {
  const html = pathname.match(/^\/epk\/([^/]+)$/u);
  const json = pathname.match(/^\/api\/epk\/([^/]+)$/u);
  const match = html ?? json;
  if (!match) return (pathname.startsWith("/epk/") || pathname.startsWith("/api/epk/"))
    ? Object.freeze({ slug: "", format: pathname.startsWith("/api/") ? "json" : "html" })
    : undefined;
  const slug = match[1];
  if (!SLUG_PATTERN.test(slug)) return Object.freeze({ slug: "", format: json ? "json" : "html" });
  return Object.freeze({ slug, format: json ? "json" : "html" });
}

function baseSecurityHeaders() {
  return {
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-resource-policy": "same-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY"
  };
}

function isNotModified(headers, etag, modifiedMs) {
  const suppliedEtags = String(headers["if-none-match"] || "").split(",").map((value) => value.trim());
  if (suppliedEtags.some((value) => value === "*" || value.replace(/^W\//u, "") === etag)) return true;
  if (headers["if-none-match"]) return false;
  const ifModifiedSince = Date.parse(String(headers["if-modified-since"] || ""));
  return Number.isFinite(ifModifiedSince) && Math.floor(modifiedMs / 1_000) <= Math.floor(ifModifiedSince / 1_000);
}

function send(response, method, status, body, headers) {
  response.writeHead(status, { ...headers, "content-length": body.byteLength });
  response.end(method === "HEAD" ? undefined : body);
}

function isWithin(parent, child) {
  return child === parent || child.startsWith(`${parent}${sep}`);
}

function loaderError(code) {
  return Object.assign(new Error(code), { code });
}

function safeErrorCode(error, fallback) {
  return typeof error?.code === "string" && /^EPK_[A-Z0-9_]+$/u.test(error.code) ? error.code : fallback;
}
