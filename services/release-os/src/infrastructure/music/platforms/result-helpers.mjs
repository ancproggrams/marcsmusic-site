const DEFAULT_VISIBILITY = "private";

export function createPublicationResult({
  action,
  dryRun,
  status,
  message,
  externalId,
  externalUrl,
  manualTask,
  request
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
    message: `Provider request failed with HTTP ${providerResponse.status} ${providerResponse.statusText}.`
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

  const response = await fetchImplementation(url, {
    method: "POST",
    headers: options.headers,
    body: options.body
  });
  const body = await parseResponseBody(response);

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    body
  };
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

async function parseResponseBody(response) {
  const contentType = response.headers?.get?.("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

