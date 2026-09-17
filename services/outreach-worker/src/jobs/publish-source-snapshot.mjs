import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import {
  adaptDjFinderRows,
  adaptMusicSubmissionPlatforms,
  adaptReleaseOsReleases,
  buildSourceArtifact
} from "../domain/source-adapters.mjs";
import { parseSourceArtifact, sourceRequestSignature } from "../domain/source-artifact.mjs";

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runEmitter(process.env);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

export async function runEmitter(env, options = {}) {
  const config = loadEmitterConfig(env);
  const snapshot = await readSnapshot(config, options);
  const records = adaptSnapshot(config.sourceId, snapshot.value);
  const chunks = chunk(records, 500);
  if (!chunks.length) throw emitterError("SOURCE_EMITTER_EMPTY", "Source snapshot produced no eligible records");
  const results = [];
  for (let index = 0; index < chunks.length; index += 1) {
    const artifact = buildSourceArtifact({
      sourceId: config.sourceId,
      records: chunks[index],
      generatedAt: snapshot.generatedAt,
      partition: `${index + 1}-of-${chunks.length}`
    });
    parseSourceArtifact(artifact, {
      maxAgeSeconds: config.maxArtifactAgeSeconds,
      maxEvidenceAgeSeconds: config.maxEvidenceAgeSeconds
    });
    if (!config.publishEnabled) {
      results.push({ artifactId: artifact.artifactId, records: artifact.records.length, published: false });
      continue;
    }
    results.push(await publishArtifact(artifact, config, options));
  }
  return Object.freeze({
    sourceId: config.sourceId,
    artifacts: results.length,
    records: records.length,
    published: config.publishEnabled,
    results
  });
}

export function loadEmitterConfig(env) {
  const sourceId = required(env.SOURCE_EMITTER_SOURCE_ID, "SOURCE_EMITTER_SOURCE_ID");
  if (!["dj-finder", "music-submission-agent", "marcsmusic-release-os"].includes(sourceId)) {
    throw emitterError("SOURCE_EMITTER_CONFIG_INVALID", "SOURCE_EMITTER_SOURCE_ID is not allowed");
  }
  const inputPath = optional(env.SOURCE_EMITTER_INPUT_PATH);
  const inputUrl = optional(env.SOURCE_EMITTER_INPUT_URL);
  if (Boolean(inputPath) === Boolean(inputUrl)) {
    throw emitterError("SOURCE_EMITTER_CONFIG_INVALID", "Exactly one source input path or URL is required");
  }
  const inputBearerToken = optional(env.SOURCE_EMITTER_INPUT_BEARER_TOKEN);
  if (inputUrl) {
    assertHttps(inputUrl, "SOURCE_EMITTER_INPUT_URL");
    if (!inputBearerToken || inputBearerToken.length < 24) {
      throw emitterError("SOURCE_EMITTER_CONFIG_INVALID", "Authenticated HTTPS input requires a 24+ character bearer token");
    }
  }
  const publishEnabled = env.SOURCE_EMITTER_PUBLISH_ENABLED === "true";
  const outreachBaseUrl = optional(env.SOURCE_EMITTER_OUTREACH_BASE_URL);
  const signingKeyId = optional(env.SOURCE_EMITTER_SIGNING_KEY_ID);
  const signingKey = optional(env.SOURCE_EMITTER_SIGNING_KEY);
  if (publishEnabled) {
    assertHttps(outreachBaseUrl, "SOURCE_EMITTER_OUTREACH_BASE_URL");
    if (!signingKeyId || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/u.test(signingKeyId)) {
      throw emitterError("SOURCE_EMITTER_CONFIG_INVALID", "Publishing requires a bounded source signing key id");
    }
    if (!signingKey || signingKey.length < 32 || signingKey.length > 512) {
      throw emitterError("SOURCE_EMITTER_CONFIG_INVALID", "Publishing requires a source-specific 32-512 character signing key");
    }
  }
  return Object.freeze({
    sourceId,
    inputPath,
    inputUrl,
    inputBearerToken,
    publishEnabled,
    outreachBaseUrl: outreachBaseUrl?.replace(/\/+$/u, ""),
    signingKeyId,
    signingKey,
    timeoutMs: integer(env.SOURCE_EMITTER_TIMEOUT_MS, 10_000, 1_000, 60_000),
    maxAttempts: integer(env.SOURCE_EMITTER_MAX_ATTEMPTS, 4, 1, 8),
    maxInputBytes: integer(env.SOURCE_EMITTER_MAX_INPUT_BYTES, 20_000_000, 1_024, 50_000_000),
    maxArtifactAgeSeconds: integer(env.SOURCE_INGESTION_MAX_ARTIFACT_AGE_SECONDS, 86_400, 300, 604_800),
    maxEvidenceAgeSeconds: integer(env.SOURCE_INGESTION_MAX_EVIDENCE_AGE_SECONDS, 7_776_000, 86_400, 31_536_000)
  });
}

export async function readSnapshot(config, options = {}) {
  if (config.inputPath) return readLocalSnapshot(config);
  const fetchImpl = options.inputFetch ?? options.fetch ?? globalThis.fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetchImpl(config.inputUrl, {
      headers: { accept: "application/json,text/csv", authorization: `Bearer ${config.inputBearerToken}` },
      redirect: "error",
      signal: controller.signal
    });
    if (!response.ok) throw emitterError(`SOURCE_INPUT_HTTP_${response.status}`, "Source input request failed", response.status >= 500 || response.status === 429);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > config.maxInputBytes) throw emitterError("SOURCE_INPUT_TOO_LARGE", "Source input exceeded its byte limit");
    return Object.freeze({
      value: parseInput(config.sourceId, bytes),
      generatedAt: headerTimestamp(response.headers.get("last-modified")) ?? new Date().toISOString()
    });
  } catch (error) {
    if (error.code) throw error;
    throw emitterError(error?.name === "AbortError" ? "SOURCE_INPUT_TIMEOUT" : "SOURCE_INPUT_NETWORK_ERROR", "Source input could not be read", true, error);
  } finally {
    clearTimeout(timeout);
  }
}

export async function publishArtifact(artifact, config, options = {}) {
  const fetchImpl = options.publishFetch ?? options.fetch ?? globalThis.fetch;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const rawBody = JSON.stringify(artifact);
  const endpoint = `${config.outreachBaseUrl}/api/v1/source-ingestion/${encodeURIComponent(config.sourceId)}`;
  let lastError;
  for (let attempt = 1; attempt <= config.maxAttempts; attempt += 1) {
    const timestamp = String(Math.floor(Date.now() / 1_000));
    const nonce = randomUUID();
    const signature = sourceRequestSignature({
      sourceId: config.sourceId,
      keyId: config.signingKeyId,
      timestamp,
      nonce,
      rawBody
    }, config.signingKey);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-source-key-id": config.signingKeyId,
          "x-source-timestamp": timestamp,
          "x-source-nonce": nonce,
          "x-source-signature": `v2=${signature}`
        },
        body: rawBody,
        redirect: "error",
        signal: controller.signal
      });
      const responseBody = await boundedJson(response, 64_000);
      if (response.ok) {
        return Object.freeze({ artifactId: artifact.artifactId, records: artifact.records.length, published: true, replayed: Boolean(responseBody?.result?.replayed) });
      }
      const code = responseBody?.error?.code ?? `SOURCE_PUBLISH_HTTP_${response.status}`;
      const retryable = response.status === 429 || response.status >= 500 || code === "SOURCE_ARTIFACT_IN_PROGRESS";
      lastError = emitterError(code, "Outreach ingestion rejected the artifact", retryable);
      if (!retryable || attempt === config.maxAttempts) throw lastError;
    } catch (error) {
      lastError = error.code
        ? error
        : emitterError(error?.name === "AbortError" ? "SOURCE_PUBLISH_TIMEOUT" : "SOURCE_PUBLISH_NETWORK_ERROR", "Artifact publish failed", true, error);
      if (!lastError.retryable || attempt === config.maxAttempts) throw lastError;
    } finally {
      clearTimeout(timeout);
    }
    await sleep(Math.min(5_000, 250 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 100));
  }
  throw lastError;
}

async function readLocalSnapshot(config) {
  const handle = await open(config.inputPath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const stats = await handle.stat();
    if (!stats.isFile() || stats.size > config.maxInputBytes) {
      throw emitterError("SOURCE_INPUT_INVALID_FILE", "Source input must be a bounded regular file");
    }
    const bytes = await handle.readFile();
    return Object.freeze({ value: parseInput(config.sourceId, bytes), generatedAt: stats.mtime.toISOString() });
  } finally {
    await handle.close();
  }
}

function parseInput(sourceId, bytes) {
  if (sourceId === "dj-finder") return parseCsv(bytes.toString("utf8"));
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw emitterError("SOURCE_INPUT_JSON_INVALID", "Source input is not valid JSON");
  }
  if (sourceId === "music-submission-agent") return parsed.platforms ?? parsed;
  if (sourceId === "marcsmusic-release-os") return parsed.releases ?? parsed;
  return parsed;
}

function adaptSnapshot(sourceId, value) {
  if (sourceId === "dj-finder") return adaptDjFinderRows(value);
  if (sourceId === "music-submission-agent") return adaptMusicSubmissionPlatforms(value);
  return adaptReleaseOsReleases(value);
}

function parseCsv(input) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted && character === '"' && input[index + 1] === '"') { field += '"'; index += 1; continue; }
    if (character === '"') { quoted = !quoted; continue; }
    if (!quoted && character === ",") { row.push(field); field = ""; continue; }
    if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(field); field = "";
      if (row.some((value) => value.length)) rows.push(row);
      row = [];
      continue;
    }
    field += character;
  }
  if (quoted) throw emitterError("SOURCE_INPUT_CSV_INVALID", "CSV contains an unterminated quoted field");
  if (field || row.length) { row.push(field); rows.push(row); }
  const [headers, ...values] = rows;
  if (!headers?.length) throw emitterError("SOURCE_INPUT_CSV_INVALID", "CSV header is missing");
  const normalizedHeaders = headers.map((header) => header.replace(/^\uFEFF/u, "").trim());
  if (new Set(normalizedHeaders).size !== normalizedHeaders.length) throw emitterError("SOURCE_INPUT_CSV_INVALID", "CSV headers are duplicated");
  return values.map((cells) => Object.fromEntries(normalizedHeaders.map((header, index) => [header, cells[index] ?? ""])));
}

async function boundedJson(response, maxBytes) {
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > maxBytes) throw emitterError("SOURCE_PUBLISH_RESPONSE_TOO_LARGE", "Outreach response exceeded its byte limit");
  if (!bytes.length) return {};
  try { return JSON.parse(bytes.toString("utf8")); } catch { return {}; }
}

function chunk(values, size) {
  return Array.from({ length: Math.ceil(values.length / size) }, (_, index) => values.slice(index * size, (index + 1) * size));
}

function headerTimestamp(value) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

function assertHttps(value, key) {
  if (!value) throw emitterError("SOURCE_EMITTER_CONFIG_INVALID", `${key} is required`);
  try {
    if (new URL(value).protocol !== "https:") throw new Error();
  } catch {
    throw emitterError("SOURCE_EMITTER_CONFIG_INVALID", `${key} must be an HTTPS URL`);
  }
}

function integer(value, fallback, minimum, maximum) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw emitterError("SOURCE_EMITTER_CONFIG_INVALID", "Emitter integer configuration is outside its bound");
  }
  return parsed;
}

function required(value, key) {
  const result = optional(value);
  if (!result) throw emitterError("SOURCE_EMITTER_CONFIG_INVALID", `${key} is required`);
  return result;
}

function optional(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function emitterError(code, message, retryable = false, cause) {
  return Object.assign(new Error(message, { cause }), { code, retryable });
}
