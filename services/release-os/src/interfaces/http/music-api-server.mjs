import http from "node:http";
import { timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createReleasePlan } from "../../application/music/release-planner.mjs";
import { publishRelease } from "../../application/music/publication-service.mjs";
import { createReleaseManagementService } from "../../application/music/release-management-service.mjs";
import { createArtistService } from "../../application/artists/artist-service.mjs";
import { createPlayerSyncService } from "../../application/music/player-sync-service.mjs";
import { createContactSegmentService } from "../../application/contacts/contact-segment-service.mjs";
import { createNewMusicCampaignService } from "../../application/email/new-music-campaign-service.mjs";
import { listPlatformCapabilities } from "../../domain/music/platform-capabilities.mjs";
import { executeMusicGraphQuery } from "../graphql/music-schema.mjs";
import { readMultipartForm } from "../../infrastructure/http/multipart.mjs";
import { UploadAdmissionController } from "../../infrastructure/http/upload-admission-controller.mjs";
import { resolveUploadRequestDeadlines } from "../../infrastructure/http/upload-request-deadline.mjs";
import { JsonStore, createDefaultState } from "../../infrastructure/storage/json-store.mjs";
import { ReleaseAssetStorage } from "../../infrastructure/storage/release-asset-storage.mjs";
import { PlayerManifestClient } from "../../infrastructure/marcsmusic-site/player-client.mjs";
import { EspoCrmClient } from "../../infrastructure/espocrm/espocrm-client.mjs";
import { MailgunClient } from "../../infrastructure/mailgun/mailgun-client.mjs";
import { resolveMailgunConfig } from "../../config/env.mjs";

const MAX_JSON_BODY_BYTES = 1_000_000;
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

export function createMusicApiServer(options = {}) {
  const env = options.env ?? process.env;
  const fetch = options.fetch ?? globalThis.fetch;
  const store =
    options.store ??
    new JsonStore({
      filePath: options.storeFilePath ?? env.MUSIC_STORE_PATH,
      initialState: createDefaultState()
    });
  const assetStorage =
    options.assetStorage ??
    new ReleaseAssetStorage({
      rootDir: options.uploadDir ?? env.MUSIC_UPLOAD_DIR
    });
  const artistService = options.artistService ?? createArtistService({ store });
  const releaseService =
    options.releaseService ?? createReleaseManagementService({ store, assetStorage, artistService });
  const playerClient =
    options.playerClient ??
    new PlayerManifestClient({
      manifestPath: options.playerManifestPath ?? env.MARCSMUSIC_PLAYER_MANIFEST_PATH,
      siteBaseUrl: env.MARCSMUSIC_SITE_BASE_URL,
      downloadBaseUrl: env.MARCSMUSIC_DOWNLOAD_BASE_URL,
      artworkBaseUrl: env.MARCSMUSIC_ARTWORK_BASE_URL
    });
  const playerSyncService =
    options.playerSyncService ?? createPlayerSyncService({ store, playerClient, artistService });
  const espocrmClient =
    options.espocrmClient ??
    new EspoCrmClient({
      baseUrl: env.ESPOCRM_BASE_URL,
      apiKey: env.ESPOCRM_API_KEY,
      fetch,
      contacts: options.contacts
    });
  const contactSegmentService =
    options.contactSegmentService ?? createContactSegmentService({ espocrmClient });
  const mailProvider = options.mailProvider ?? createOptionalMailgunProvider(env, fetch);
  const campaignService =
    options.campaignService ??
    createNewMusicCampaignService({
      store,
      contactSegmentService,
      mailProvider
    });
  const uploadAdmission =
    options.uploadAdmission ??
    new UploadAdmissionController({
      maxConcurrent: options.maxConcurrentUploads ?? env.MUSIC_MAX_CONCURRENT_UPLOADS
    });
  const uploadDeadlines = resolveUploadRequestDeadlines({
    bodyTimeoutMs: options.uploadBodyTimeoutMs ?? env.MUSIC_UPLOAD_BODY_TIMEOUT_MS,
    idleTimeoutMs: options.uploadIdleTimeoutMs ?? env.MUSIC_UPLOAD_IDLE_TIMEOUT_MS
  });
  const context = {
    env,
    fetch,
    store,
    assetStorage,
    artistService,
    releaseService,
    playerClient,
    playerSyncService,
    espocrmClient,
    contactSegmentService,
    campaignService,
    uploadAdmission,
    uploadDeadlines
  };

  const handleRequest = async (request, response) => {
    try {
      await routeRequest(request, response, context);
    } catch (error) {
      if (response.headersSent || response.destroyed) {
        response.destroy(error);
        return;
      }

      if (error.closeConnection) {
        response.shouldKeepAlive = false;
        response.setHeader("connection", "close");
      }

      if (error.retryAfterSeconds) {
        response.setHeader("retry-after", String(error.retryAfterSeconds));
      }

      sendJson(response, error.statusCode ?? 500, {
        error: {
          message: error.message,
          code: error.code ?? "MUSIC_API_ERROR"
        }
      });
    }
  };
  const server = http.createServer(handleRequest);

  server.on("checkContinue", (request, response) => {
    if (isReleaseUploadRequest(request) && context.uploadAdmission.atCapacity) {
      void handleRequest(request, response);
      return;
    }

    response.writeContinue();
    void handleRequest(request, response);
  });

  return server;
}

async function routeRequest(request, response, context) {
  const url = new URL(request.url, "http://localhost");

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, {
      status: "ok",
      integrations: {
        mailgunConfigured: Boolean(context.env.MAILGUN_API_KEY && context.env.MAILGUN_DOMAIN),
        espocrmConfigured: context.espocrmClient.isConfigured(),
        playerManifestPath: context.playerClient.manifestPath,
        uploadDir: context.assetStorage.rootDir
      }
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/music/app") {
    sendHtml(response, await readFile(PUBLIC_APP_PATH, "utf8"));
    return;
  }

  if (request.method === "GET" && url.pathname.startsWith("/assets/audio/")) {
    await sendUploadedAsset(response, context.assetStorage.rootDir, "audio", url.pathname);
    return;
  }

  if (request.method === "GET" && url.pathname.startsWith("/assets/artwork/")) {
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
        ...context.uploadDeadlines
      });
      return context.releaseService.createRelease(multipart);
    });
    sendJson(response, 201, result);
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
      await publishRelease(body, {
        dryRun,
        env: context.env,
        fetch: context.fetch
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
      await publishRelease(publicationInput, {
        dryRun,
        env: context.env,
        fetch: context.fetch,
        artist
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

  if (request.method === "POST" && url.pathname === "/graphql") {
    const body = await readJsonBody(request);
    const result = await executeMusicGraphQuery({
      query: body.query,
      variables: body.variables,
      operationName: body.operationName,
      contextValue: {
        allowExecution: isExecutionAuthorized(request, context.env),
        env: context.env,
        fetch: context.fetch
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

function isReleaseUploadRequest(request) {
  if (request.method !== "POST") {
    return false;
  }

  return request.url?.split("?", 1)[0] === "/music/releases";
}

function createOptionalMailgunProvider(env, fetch) {
  if (!env.MAILGUN_API_KEY || !env.MAILGUN_DOMAIN) {
    return undefined;
  }

  return new MailgunClient({
    ...resolveMailgunConfig(env),
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

function safeTokenEquals(providedToken, expectedToken) {
  const provided = Buffer.from(providedToken);
  const expected = Buffer.from(expectedToken);

  if (provided.length !== expected.length) {
    return false;
  }

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
    "content-length": Buffer.byteLength(body)
  });
  response.end(body);
}

function sendHtml(response, body) {
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "content-length": Buffer.byteLength(body)
  });
  response.end(body);
}

async function sendUploadedAsset(response, uploadRoot, kind, pathname) {
  const prefix = kind === "audio" ? "/assets/audio/" : "/assets/artwork/";
  const filename = decodeURIComponent(pathname.slice(prefix.length));
  const filePath = resolve(uploadRoot, kind, filename);
  const root = resolve(uploadRoot, kind);

  if (!filePath.startsWith(root + sep)) {
    throw httpError(400, "Invalid asset path", "INVALID_ASSET_PATH");
  }

  response.writeHead(200, {
    "content-type": STATIC_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream",
    "cache-control": "public, max-age=31536000, immutable"
  });
  createReadStream(filePath).pipe(response);
}

function httpError(statusCode, message, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}
