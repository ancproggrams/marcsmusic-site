import http from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { constants } from "node:fs";
import { open, readFile, realpath } from "node:fs/promises";
import { basename, extname, isAbsolute, relative, resolve, sep } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { createReleasePlan } from "../../application/music/release-planner.mjs";
import { createDurablePublicationService } from "../../application/music/durable-publication-service.mjs";
import { createReleaseManagementService } from "../../application/music/release-management-service.mjs";
import { createArtistService } from "../../application/artists/artist-service.mjs";
import { createPlayerSyncService } from "../../application/music/player-sync-service.mjs";
import { createContactSegmentService } from "../../application/contacts/contact-segment-service.mjs";
import { createNewMusicCampaignService } from "../../application/email/new-music-campaign-service.mjs";
import { listPlatformCapabilities } from "../../domain/music/platform-capabilities.mjs";
import { assertLegacyOutreachSendEnabled, isLegacyOutreachSendEnabled } from "../../domain/legacy-outreach-send-policy.mjs";
import { executeMusicGraphQuery } from "../graphql/music-schema.mjs";
import { readMultipartForm } from "../../infrastructure/http/multipart.mjs";
import { UploadAdmissionController } from "../../infrastructure/http/upload-admission-controller.mjs";
import { JsonStore, audit, createDefaultState } from "../../infrastructure/storage/json-store.mjs";
import { ReleaseAssetStorage } from "../../infrastructure/storage/release-asset-storage.mjs";
import { AssetUrlSigner } from "../../infrastructure/security/asset-url-signer.mjs";
import { PlayerManifestClient } from "../../infrastructure/marcsmusic-site/player-client.mjs";
import { EspoCrmClient } from "../../infrastructure/espocrm/espocrm-client.mjs";
import { PlunkClient } from "../../infrastructure/plunk/plunk-client.mjs";
import { resolvePlunkConfig } from "../../config/env.mjs";

const MAX_JSON_BODY_BYTES = 1_000_000;
const MAX_AUTHORIZATION_HEADER_BYTES = 1_024;
const MIN_ADMIN_PASSWORD_BYTES = 32;
const MAX_ADMIN_CREDENTIAL_BYTES = 256;
const ADMIN_AUTH_REALM = "MarcsMusic Release OS";
const MODULE_DIR = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC_APP_PATH = resolve(MODULE_DIR, "public", "music-app.html");
const STATIC_TYPES = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
});
const ASSET_EXTENSIONS = Object.freeze({
  audio: new Set([".mp3", ".wav"]),
  artwork: new Set([".jpg", ".jpeg", ".png", ".webp"])
});

export function createMusicApiServer(options = {}) {
  const env = options.env ?? process.env;
  const fetch = options.fetch ?? globalThis.fetch;
  const store =
    options.store ??
    new JsonStore({
      filePath: options.storeFilePath ?? env.MUSIC_STORE_PATH,
      initialState: createDefaultState(),
      lockTimeoutMs: env.MUSIC_FILE_LOCK_TIMEOUT_MS,
      lockLeaseMs: env.MUSIC_FILE_LOCK_LEASE_MS
    });
  const assetStorage =
    options.assetStorage ??
    new ReleaseAssetStorage({
      rootDir: options.uploadDir ?? env.MUSIC_UPLOAD_DIR
    });
  const assetUrlSigner = options.assetUrlSigner ?? new AssetUrlSigner({ env });
  const uploadAdmission =
    options.uploadAdmission ??
    new UploadAdmissionController({ maxConcurrent: options.maxConcurrentUploads ?? env.MUSIC_MAX_CONCURRENT_UPLOADS });
  const artistService = options.artistService ?? createArtistService({ store });
  const releaseService =
    options.releaseService ?? createReleaseManagementService({
      store,
      assetStorage,
      artistService,
      sourceOutboxStager: options.sourceOutboxStager
    });
  const playerClient =
    options.playerClient ??
    new PlayerManifestClient({
      manifestPath: options.playerManifestPath ?? env.MARCSMUSIC_PLAYER_MANIFEST_PATH,
      siteBaseUrl: env.MARCSMUSIC_SITE_BASE_URL,
      downloadBaseUrl: env.MARCSMUSIC_DOWNLOAD_BASE_URL,
      artworkBaseUrl: env.MARCSMUSIC_ARTWORK_BASE_URL,
      assetUrlSigner,
      lockTimeoutMs: env.MUSIC_FILE_LOCK_TIMEOUT_MS,
      lockLeaseMs: env.MUSIC_FILE_LOCK_LEASE_MS
    });
  const playerSyncService =
    options.playerSyncService ?? createPlayerSyncService({ store, playerClient, artistService });
  const espocrmClient =
    options.espocrmClient ??
    new EspoCrmClient({
      baseUrl: env.ESPOCRM_BASE_URL,
      apiKey: env.ESPOCRM_API_KEY,
      env,
      fetch,
      contacts: options.contacts
    });
  const contactSegmentService =
    options.contactSegmentService ?? createContactSegmentService({ espocrmClient });
  const emailProvider = options.emailProvider ?? options.mailProvider ?? createOptionalPlunkProvider(env, fetch);
  const campaignService =
    options.campaignService ??
    createNewMusicCampaignService({
      store,
      contactSegmentService,
      emailProvider
    });
  const publicationService =
    options.publicationService ??
    createDurablePublicationService({
      store,
      env,
      leaseMs: options.publicationLeaseMs,
      actionExecutor: options.publicationActionExecutor
    });
  const context = {
    env,
    fetch,
    store,
    assetStorage,
    assetUrlSigner,
    uploadAdmission,
    artistService,
    releaseService,
    playerClient,
    playerSyncService,
    espocrmClient,
    contactSegmentService,
    campaignService,
    publicationService
  };

  return http.createServer(async (request, response) => {
    try {
      await routeRequest(request, response, context);
    } catch (error) {
      if (response.headersSent || response.destroyed) {
        response.destroy(error);
        return;
      }

      const headers = {};
      if (error.closeConnection) headers.connection = "close";
      if (error.retryAfterSeconds) headers["retry-after"] = String(error.retryAfterSeconds);
      if (error.wwwAuthenticate) headers["www-authenticate"] = error.wwwAuthenticate;
      for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);
      sendJson(response, error.statusCode ?? 500, {
        error: {
          message: error.message,
          code: error.code ?? "MUSIC_API_ERROR"
        }
      });
    }
  });
}

async function routeRequest(request, response, context) {
  const url = new URL(request.url, "http://localhost");

  if (request.method === "GET" && url.pathname === "/livez") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  if (isAdministratorRoute(url.pathname)) {
    assertAdministratorAuthorized(request, context.env);
  }

  if (request.method === "GET" && url.pathname === "/music/app") {
    sendHtml(response, await readFile(PUBLIC_APP_PATH, "utf8"));
    return;
  }

  if (request.method === "GET" && url.pathname.startsWith("/assets/audio/")) {
    assertAssetAccessAuthorized(request, url, context);
    await sendUploadedAsset(response, context.assetStorage.rootDir, "audio", url.pathname);
    return;
  }

  if (request.method === "GET" && url.pathname.startsWith("/assets/artwork/")) {
    assertAssetAccessAuthorized(request, url, context);
    await sendUploadedAsset(response, context.assetStorage.rootDir, "artwork", url.pathname);
    return;
  }

  if (request.method === "GET" && url.pathname === "/music/platforms") {
    sendJson(response, 200, {
      platforms: listPlatformCapabilities({
        observedOnly: url.searchParams.get("observedOnly") === "true",
        autoPostOnly: url.searchParams.get("autoPostOnly") === "true"
      })
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/music/artists") {
    sendJson(response, 200, { artists: await context.artistService.listArtists() });
    return;
  }

  if (request.method === "POST" && url.pathname === "/music/artists") {
    sendJson(response, 201, { artist: await context.artistService.createArtist(await readJsonBody(request)) });
    return;
  }

  const artistMatch = url.pathname.match(/^\/music\/artists\/([^/]+)$/u);
  if (artistMatch && request.method === "GET") {
    sendJson(response, 200, { artist: await context.artistService.getArtist(decodeURIComponent(artistMatch[1])) });
    return;
  }

  if (artistMatch && request.method === "PATCH") {
    sendJson(response, 200, {
      artist: await context.artistService.updateArtist(decodeURIComponent(artistMatch[1]), await readJsonBody(request))
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/music/releases/plan") {
    const body = await readJsonBody(request);
    sendJson(response, 200, createReleasePlan(body));
    return;
  }

  if (request.method === "POST" && url.pathname === "/music/releases") {
    const result = await context.uploadAdmission.run(async () => {
      const multipart = await readMultipartForm(request, {
        maxBytes: context.assetStorage.maxAudioBytes + context.assetStorage.maxArtworkBytes + 2_000_000,
        maxFiles: 2,
        maxFields: 16,
        maxFileBytes: context.assetStorage.maxAudioBytes
      });
      return context.releaseService.createRelease(multipart);
    });
    sendJson(response, 201, await result);
    return;
  }

  if (request.method === "POST" && url.pathname === "/music/assets/cleanup") {
    if (!isExecutionAuthorized(request, context.env)) {
      throw httpError(
        403,
        "Asset cleanup requires a valid x-music-api-token header.",
        "ASSET_CLEANUP_FORBIDDEN"
      );
    }
    const cleanupInput = await readOptionalJsonBody(request);
    sendJson(response, 200, {
      cleanup: await context.releaseService.cleanupOrphanAssets({
        ...cleanupInput,
        operator: administratorIdentity(request)
      })
    });
    return;
  }

  const signedAssetMatch = url.pathname.match(/^\/music\/assets\/([^/]+)\/signed-url$/u);
  if (signedAssetMatch && request.method === "GET") {
    const assetId = decodeURIComponent(signedAssetMatch[1]);
    const state = await context.store.read();
    const asset = state.assets.find((entry) => entry.id === assetId);
    if (!asset) throw assetNotFound();
    const signedUrl = context.assetUrlSigner.signPath(assetUrlPath(asset), {
      ttlSeconds: url.searchParams.get("ttlSeconds") ?? undefined
    });
    const expires = new URL(signedUrl, "http://localhost").searchParams.get("expires");
    await context.store.update((nextState) => {
      audit(nextState, "asset.signed_url_issued", {
        assetId,
        operator: administratorIdentity(request),
        expiresAt: new Date(Number(expires) * 1_000).toISOString()
      });
    });
    sendJson(response, 200, {
      assetId,
      url: signedUrl,
      expiresAt: new Date(Number(expires) * 1_000).toISOString()
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/music/releases/publish") {
    const body = await readJsonBody(request);
    const dryRun = body.dryRun !== false;

    if (!dryRun && !isExecutionAuthorized(request, context.env)) {
      throw httpError(
        403,
        "Real music publication requires a valid x-music-api-token header.",
        "MUSIC_PUBLICATION_FORBIDDEN"
      );
    }

    sendJson(
      response,
      200,
      await context.publicationService.publish(body, {
        dryRun,
        env: context.env,
        fetch: context.fetch,
        mediaRootDir: context.assetStorage.rootDir
      })
    );
    return;
  }

  const releaseMatch = url.pathname.match(/^\/music\/releases\/([^/]+)(?:\/([^/]+))?$/u);
  if (releaseMatch && request.method === "GET" && !releaseMatch[2]) {
    sendJson(response, 200, await context.releaseService.getRelease(decodeURIComponent(releaseMatch[1])));
    return;
  }

  if (releaseMatch && request.method === "POST" && releaseMatch[2] === "plan") {
    const body = await readOptionalJsonBody(request);
    sendJson(
      response,
      200,
      await context.releaseService.planRelease(decodeURIComponent(releaseMatch[1]), body)
    );
    return;
  }

  if (releaseMatch && request.method === "POST" && releaseMatch[2] === "publish") {
    const body = await readOptionalJsonBody(request);
    const dryRun = body.dryRun !== false;

    if (!dryRun && !isExecutionAuthorized(request, context.env)) {
      throw httpError(
        403,
        "Real music publication requires a valid x-music-api-token header.",
        "MUSIC_PUBLICATION_FORBIDDEN"
      );
    }

    const { release } = await context.releaseService.getRelease(decodeURIComponent(releaseMatch[1]));
    const artist = await context.artistService.getArtist(release.primaryArtistId);
    const publicationInput = await context.releaseService.toPublicationInput(decodeURIComponent(releaseMatch[1]), body);
    sendJson(
      response,
      200,
      await context.publicationService.publish(publicationInput, {
        dryRun,
        env: context.env,
        fetch: context.fetch,
        artist,
        mediaRootDir: context.assetStorage.rootDir
      })
    );
    return;
  }

  if (releaseMatch && request.method === "POST" && releaseMatch[2] === "player-sync") {
    if (!isExecutionAuthorized(request, context.env)) {
      throw httpError(
        403,
        "Player sync requires a valid x-music-api-token header.",
        "PLAYER_SYNC_FORBIDDEN"
      );
    }

    sendJson(response, 200, {
      playerEntry: await context.playerSyncService.syncRelease(decodeURIComponent(releaseMatch[1]))
    });
    return;
  }

  const campaignMatch = url.pathname.match(
    /^\/music\/releases\/([^/]+)\/email-campaigns\/(preview|test|send)$/u
  );
  if (campaignMatch && request.method === "POST") {
    if (campaignMatch[2] !== "preview") {
      // These historical endpoints bypass the central durable queue. Keep them
      // disabled before body parsing, segmentation, counters or provider I/O.
      assertLegacyOutreachSendEnabled(context.env);
    }
    const input = await readJsonBody(request);
    const { release } = await context.releaseService.getRelease(decodeURIComponent(campaignMatch[1]));
    const artist = await context.artistService.getArtist(release.primaryArtistId);
    const state = await context.store.read();
    const playerEntry = state.playerEntries.find((entry) => entry.releaseId === release.id);
    const payload = { release, playerEntry, artist, input };

    if (campaignMatch[2] === "preview") {
      sendJson(response, 200, await context.campaignService.previewCampaign(payload));
      return;
    }

    if (!isExecutionAuthorized(request, context.env)) {
      throw httpError(403, "Campaign send requires a valid x-music-api-token header.", "CAMPAIGN_FORBIDDEN");
    }

    sendJson(
      response,
      200,
      campaignMatch[2] === "test"
        ? await context.campaignService.sendTest(payload)
        : await context.campaignService.sendCampaign(payload)
    );
    return;
  }

  const campaignReadMatch = url.pathname.match(/^\/music\/email-campaigns\/([^/]+)(?:\/recipients)?$/u);
  if (campaignReadMatch && request.method === "GET") {
    const campaignId = decodeURIComponent(campaignReadMatch[1]);
    if (url.pathname.endsWith("/recipients")) {
      sendJson(response, 200, {
        recipients: await context.campaignService.getCampaignRecipients(campaignId)
      });
      return;
    }

    sendJson(response, 200, {
      campaign: await context.campaignService.getCampaign(campaignId)
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/music/publications/reconcile-stale") {
    if (!isExecutionAuthorized(request, context.env)) {
      throw httpError(
        403,
        "Publication reconciliation requires a valid x-music-api-token header.",
        "MUSIC_PUBLICATION_FORBIDDEN"
      );
    }
    sendJson(response, 200, {
      reconciliation: await context.publicationService.markStaleForReconciliation()
    });
    return;
  }

  const publicationMatch = url.pathname.match(/^\/music\/publications\/([^/]+)(?:\/(reconcile))?$/u);
  if (publicationMatch && request.method === "GET" && !publicationMatch[2]) {
    sendJson(response, 200, {
      publication: await context.publicationService.getPublication(decodeURIComponent(publicationMatch[1]))
    });
    return;
  }

  if (publicationMatch && request.method === "POST" && publicationMatch[2] === "reconcile") {
    if (!isExecutionAuthorized(request, context.env)) {
      throw httpError(
        403,
        "Publication reconciliation requires a valid x-music-api-token header.",
        "MUSIC_PUBLICATION_FORBIDDEN"
      );
    }
    const reconciliationInput = await readJsonBody(request);
    sendJson(response, 200, {
      publication: await context.publicationService.reconcile(
        decodeURIComponent(publicationMatch[1]),
        { ...reconciliationInput, operator: administratorIdentity(request) }
      )
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/graphql") {
    const body = await readJsonBody(request);
    const result = await executeMusicGraphQuery({
      query: body.query,
      variables: body.variables,
      operationName: body.operationName,
      contextValue: {
        allowExecution: isExecutionAuthorized(request, context.env),
        env: context.env,
        fetch: context.fetch,
        mediaRootDir: context.assetStorage.rootDir,
        publicationService: context.publicationService
      }
    });

    sendJson(response, result.errors ? 400 : 200, result);
    return;
  }

  sendJson(response, 404, {
    error: {
      message: "Not found",
      code: "NOT_FOUND"
    }
  });
}

function createOptionalPlunkProvider(env, fetch) {
  const providerRequested = env.EMAIL_PROVIDER || env.PLUNK_SECRET_KEY || env.PLUNK_BASE_URL;
  if (!providerRequested) {
    return undefined;
  }

  return new PlunkClient({
    ...resolvePlunkConfig(env),
    env,
    legacyOutreachSendEnabled: isLegacyOutreachSendEnabled(env),
    fetch
  });
}

function isExecutionAuthorized(request, env) {
  const expectedToken = env?.MUSIC_API_EXECUTION_TOKEN;
  const providedToken = request.headers["x-music-api-token"];

  if (!expectedToken || !providedToken || Array.isArray(providedToken)) {
    return false;
  }

  return safeTokenEquals(providedToken, expectedToken);
}

function isAdministratorRoute(pathname) {
  return pathname === "/music" || pathname.startsWith("/music/") || pathname === "/graphql";
}

function assertAdministratorAuthorized(request, env) {
  const expectedUsername = env?.MUSIC_API_ADMIN_USERNAME;
  const expectedPassword = env?.MUSIC_API_ADMIN_PASSWORD;

  if (!areAdministratorCredentialsValid(expectedUsername, expectedPassword)) {
    throw httpError(
      503,
      "Music API administrator authentication is not configured safely.",
      "MUSIC_ADMIN_AUTH_NOT_CONFIGURED"
    );
  }

  if (!isAdministratorAuthorized(request, env)) {
    const error = httpError(
      401,
      "Music API administrator authentication is required.",
      "MUSIC_ADMIN_AUTH_REQUIRED"
    );
    error.wwwAuthenticate = `Basic realm="${ADMIN_AUTH_REALM}", charset="UTF-8"`;
    throw error;
  }
}

function isAdministratorAuthorized(request, env) {
  const expectedUsername = env?.MUSIC_API_ADMIN_USERNAME;
  const expectedPassword = env?.MUSIC_API_ADMIN_PASSWORD;
  if (!areAdministratorCredentialsValid(expectedUsername, expectedPassword)) return false;
  const credentials = parseBasicAuthorization(request.headers.authorization);
  return (
    safeTokenEquals(credentials?.username ?? "", expectedUsername) &&
    safeTokenEquals(credentials?.password ?? "", expectedPassword)
  );
}

function administratorIdentity(request) {
  return parseBasicAuthorization(request.headers.authorization)?.username ?? "authenticated-administrator";
}

function assertAssetAccessAuthorized(request, url, context) {
  const signed = context.assetUrlSigner.verifyRequest({
    method: request.method,
    pathname: url.pathname,
    searchParams: url.searchParams
  });
  if (!signed && !isAdministratorAuthorized(request, context.env)) throw assetNotFound();
}

function areAdministratorCredentialsValid(username, password) {
  return (
    typeof username === "string" &&
    Buffer.byteLength(username) >= 1 &&
    Buffer.byteLength(username) <= MAX_ADMIN_CREDENTIAL_BYTES &&
    !/[:\u0000-\u0020\u007f]/u.test(username) &&
    typeof password === "string" &&
    Buffer.byteLength(password) >= MIN_ADMIN_PASSWORD_BYTES &&
    Buffer.byteLength(password) <= MAX_ADMIN_CREDENTIAL_BYTES &&
    !/[\u0000-\u001f\u007f]/u.test(password)
  );
}

function parseBasicAuthorization(value) {
  if (typeof value !== "string" || Buffer.byteLength(value) > MAX_AUTHORIZATION_HEADER_BYTES) return undefined;
  const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/u.exec(value);
  if (!match) return undefined;

  let decoded;
  try {
    decoded = Buffer.from(match[1], "base64").toString("utf8");
  } catch {
    return undefined;
  }
  const separator = decoded.indexOf(":");
  if (separator <= 0) return undefined;
  const username = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);
  if (
    Buffer.byteLength(username) > MAX_ADMIN_CREDENTIAL_BYTES ||
    Buffer.byteLength(password) > MAX_ADMIN_CREDENTIAL_BYTES ||
    /[\u0000-\u001f\u007f]/u.test(decoded)
  ) {
    return undefined;
  }
  return { username, password };
}

function safeTokenEquals(providedToken, expectedToken) {
  const provided = createHash("sha256").update(providedToken).digest();
  const expected = createHash("sha256").update(expectedToken).digest();
  return timingSafeEqual(provided, expected);
}

async function readJsonBody(request) {
  const contentType = request.headers["content-type"] ?? "";

  if (!contentType.includes("application/json")) {
    throw httpError(415, "Expected application/json request body", "UNSUPPORTED_MEDIA_TYPE");
  }

  let size = 0;
  const chunks = [];

  for await (const chunk of request) {
    size += chunk.byteLength;

    if (size > MAX_JSON_BODY_BYTES) {
      throw httpError(413, "JSON body is too large", "PAYLOAD_TOO_LARGE");
    }

    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw httpError(400, "Invalid JSON request body", "INVALID_JSON");
  }
}

async function readOptionalJsonBody(request) {
  if (request.headers["content-type"]?.includes("application/json")) {
    return readJsonBody(request);
  }

  return {};
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);

  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY"
  });
  response.end(body);
}

function sendHtml(response, body) {
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    "content-security-policy": "default-src 'none'; connect-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-resource-policy": "same-origin",
    "permissions-policy": "camera=(), geolocation=(), microphone=()",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY"
  });
  response.end(body);
}

async function sendUploadedAsset(response, uploadRoot, kind, pathname) {
  const prefix = kind === "audio" ? "/assets/audio/" : "/assets/artwork/";
  const filename = decodeAssetFilename(pathname.slice(prefix.length));
  const extension = extname(filename).toLowerCase();
  if (filename.includes("\0") || filename !== basename(filename) || !ASSET_EXTENSIONS[kind].has(extension)) {
    throw assetNotFound();
  }

  const filePath = await resolveUploadedAssetPath(uploadRoot, kind, filename);
  const fileHandle = await openAsset(filePath);
  try {
    const stats = await fileHandle.stat();
    if (!stats.isFile()) throw assetNotFound();
    if (response.destroyed) return;
    response.writeHead(200, {
      "content-type": STATIC_TYPES[extension],
      "content-length": stats.size,
      "cache-control": "private, no-store",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff"
    });
    await pipeline(fileHandle.createReadStream(), response);
  } finally {
    await fileHandle.close().catch((error) => {
      if (error.code !== "EBADF") throw error;
    });
  }
}

function decodeAssetFilename(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw assetNotFound();
  }
}

async function resolveUploadedAssetPath(uploadRoot, kind, filename) {
  try {
    const canonicalRoot = await realpath(resolve(uploadRoot));
    const canonicalSubdir = await realpath(resolve(canonicalRoot, kind));
    if (!isContained(canonicalRoot, canonicalSubdir)) throw assetNotFound();
    const requestedPath = resolve(canonicalSubdir, filename);
    if (!isContained(canonicalSubdir, requestedPath)) throw assetNotFound();
    const canonicalFile = await realpath(requestedPath);
    if (!isContained(canonicalSubdir, canonicalFile) || !ASSET_EXTENSIONS[kind].has(extname(canonicalFile).toLowerCase())) {
      throw assetNotFound();
    }
    return canonicalFile;
  } catch (error) {
    if (error.code === "ASSET_NOT_FOUND") throw error;
    if (["EACCES", "ELOOP", "ENOENT", "ENOTDIR"].includes(error.code)) throw assetNotFound();
    throw error;
  }
}

async function openAsset(filePath) {
  try {
    return await open(filePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  } catch (error) {
    if (["EACCES", "ELOOP", "ENOENT", "ENOTDIR"].includes(error.code)) throw assetNotFound();
    throw error;
  }
}

function isContained(root, candidate) {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot !== "" && !isAbsolute(pathFromRoot) && pathFromRoot !== ".." && !pathFromRoot.startsWith(`..${sep}`);
}

function assetNotFound() {
  return httpError(404, "Asset not found", "ASSET_NOT_FOUND");
}

function assetUrlPath(asset) {
  const kind = typeof asset?.kind === "string" && asset.kind.startsWith("audio") ? "audio" : asset?.kind;
  if (!["audio", "artwork"].includes(kind) || typeof asset.storageFilename !== "string") throw assetNotFound();
  return `/assets/${kind}/${encodeURIComponent(asset.storageFilename)}`;
}

function httpError(statusCode, message, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}
