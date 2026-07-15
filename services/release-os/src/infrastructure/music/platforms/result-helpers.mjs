const DEFAULT_VISIBILITY = "private";
const DEFAULT_PROVIDER_TIMEOUT_MS = 15_000;
const DEFAULT_PROVIDER_MAX_RESPONSE_BYTES = 256 * 1024;

export class ProviderHttpError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = "ProviderHttpError";
    this.code = code;
    this.statusCode = options.statusCode ?? 502;
    this.retryable = Boolean(options.retryable);
  }
}

export function createPublicationResult({
  action,
  dryRun,
  status,
  message,
  externalId,
  externalUrl,
  manualTask,
  request,
  errorCode,
  retryable = false,
  outcomeUncertain = false
}) {
  return Object.freeze({
    platformId: action.platformId,
    platformName: action.platformName,
    idempotencyKey: action.idempotencyKey,
    mode: action.mode,
    operation: action.operation,
    status,
    dryRun,
    message,
    externalId,
    externalUrl,
    errorCode,
    retryable,
    outcomeUncertain,
    requiredCredentialEnv: action.requiredCredentialEnv,
    requirements: action.requirements,
    request,
    manualTask
  });
}

export function missingCredentialResult(action, dryRun, envName) {
  return createPublicationResult({
    action,
    dryRun,
    status: "blocked",
    message: `Missing required server-side credential: ${envName}.`
  });
}

export function providerFailureResult(action, dryRun, providerResponse) {
  return createPublicationResult({
    action,
    dryRun,
    status: "failed",
    message: `Provider request failed with HTTP ${providerResponse.status} ${providerResponse.statusText}.`,
    errorCode: `PROVIDER_HTTP_${providerResponse.status}`,
    retryable: providerResponse.status === 408 || providerResponse.status === 429 || providerResponse.status >= 500,
    outcomeUncertain: providerResponse.status === 408 || providerResponse.status === 429 || providerResponse.status >= 500
  });
}

export function createManualTask(platform, release, action, workflowDefinition, options = {}) {
  return Object.freeze({
    id: `${action.idempotencyKey}:manual`,
    kind: workflowDefinition.kind,
    title: `${platform.name}: ${release.title}`,
    url: workflowDefinition.url,
    credentialEnvPrefix: platform.credentialEnvPrefix,
    missingArtistAccount: Boolean(options.missingArtistAccount),
    steps: Object.freeze([...workflowDefinition.steps]),
    fields: createManualFields(release, options.artist)
  });
}

export function createManualFields(release, artist) {
  return Object.freeze({
    releaseId: release.releaseId,
    title: release.title,
    artist: release.artist,
    artistId: artist?.id,
    artistSlug: artist?.slug,
    audioSource: release.audioSource,
    coverArtSource: release.coverArtSource,
    description: release.description,
    genre: release.genre,
    tags: Object.freeze([...(release.tags ?? [])]),
    releaseDate: release.releaseDate,
    visibility: release.visibility ?? DEFAULT_VISIBILITY,
    primaryReleaseUrl: release.primaryReleaseUrl
  });
}

export function workflow(kind, url, steps) {
  return Object.freeze({
    kind,
    url,
    steps: Object.freeze(steps)
  });
}

export async function postFormData(fetchImplementation, url, options) {
  if (typeof fetchImplementation !== "function") {
    throw new TypeError("fetch implementation is required for provider uploads");
  }

  const timeoutMs = positiveInteger(options.timeoutMs, DEFAULT_PROVIDER_TIMEOUT_MS);
  const maximumBytes = positiveInteger(options.maxResponseBytes, DEFAULT_PROVIDER_MAX_RESPONSE_BYTES);
  const controller = new AbortController();
  let timeout;
  const operation = (async () => {
    const response = await fetchImplementation(url, {
      method: "POST",
      headers: options.headers,
      body: options.body,
      redirect: "error",
      signal: controller.signal
    });
    const body = await parseResponseBody(response, maximumBytes);
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      body
    };
  })();

  try {
    return await Promise.race([
      operation,
      new Promise((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new ProviderHttpError("PROVIDER_REQUEST_TIMEOUT", "Provider request timed out.", {
            statusCode: 504,
            retryable: true
          }));
        }, timeoutMs);
      })
    ]);
  } catch (error) {
    if (error instanceof ProviderHttpError) throw error;
    if (error?.name === "AbortError") {
      throw new ProviderHttpError("PROVIDER_REQUEST_TIMEOUT", "Provider request timed out.", {
        statusCode: 504,
        retryable: true
      });
    }
    throw new ProviderHttpError("PROVIDER_REQUEST_FAILED", "Provider request failed.", { retryable: true });
  } finally {
    clearTimeout(timeout);
  }
}

export function appendIfPresent(form, field, value) {
  if (typeof value === "string" && value.trim()) {
    form.append(field, value.trim());
  }
}

export function stringOrUndefined(value) {
  if (typeof value === "number") {
    return String(value);
  }

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function parseResponseBody(response, maximumBytes) {
  const contentType = response.headers?.get?.("content-type") ?? "";
  const bytes = await readBoundedResponse(response, maximumBytes);
  const text = bytes.toString("utf8");
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    if (contentType.includes("application/json")) {
      throw new ProviderHttpError("PROVIDER_RESPONSE_INVALID", "Provider returned invalid JSON.", {
        retryable: false
      });
    }
    return { text };
  }
}

async function readBoundedResponse(response, maximumBytes) {
  const declared = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declared) && declared > maximumBytes) throw responseTooLarge();
  if (!response.body?.getReader) {
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > maximumBytes) throw responseTooLarge();
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
        throw responseTooLarge();
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock?.();
  }
  return Buffer.concat(chunks, total);
}

function responseTooLarge() {
  return new ProviderHttpError("PROVIDER_RESPONSE_TOO_LARGE", "Provider response exceeded the configured byte limit.", {
    retryable: false
  });
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}
