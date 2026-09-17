import { assertReadOnlyResearch } from "@/lib/security/policy";
import { getSoundCloudConfig } from "./config";
import { getSoundCloudApiReliabilityConfig, SoundCloudRuntimeConfigurationError, type SoundCloudRuntimeEnv } from "./runtimeConfig";
import type { SoundCloudCollection, SoundCloudComment, SoundCloudTrack, SoundCloudUser } from "./types";

type SoundCloudFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type SoundCloudClientOptions = {
  accessToken: string;
  maxRetries?: number;
  env?: SoundCloudRuntimeEnv;
  fetchImpl?: SoundCloudFetch;
  sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
  random?: () => number;
  now?: () => number;
};

export type SoundCloudApiErrorCode =
  | "CANCELLED"
  | "DEADLINE_EXCEEDED"
  | "HTTP_ERROR"
  | "INVALID_RESPONSE"
  | "NETWORK_ERROR"
  | "RESPONSE_TOO_LARGE"
  | "TIMEOUT";

export class SoundCloudApiError extends Error {
  readonly code: SoundCloudApiErrorCode;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(code: SoundCloudApiErrorCode, message: string, options: { status?: number; retryable?: boolean } = {}) {
    super(message);
    this.name = "SoundCloudApiError";
    this.code = code;
    this.status = options.status;
    this.retryable = options.retryable ?? false;
  }
}

export type TrackSearchParams = {
  q?: string;
  tags?: string;
  genres?: string;
  bpmFrom?: number;
  bpmTo?: number;
  durationFrom?: number;
  durationTo?: number;
  createdAtFrom?: string;
  createdAtTo?: string;
  limit?: number;
};

const retryableStatuses = new Set([408, 425, 429, 500, 502, 503, 504]);

function defaultSleep(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timeout = setTimeout(finish, milliseconds);
    function finish() {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", finish);
      resolve();
    }
    if (signal?.aborted) finish();
    else signal?.addEventListener("abort", finish, { once: true });
  });
}

function maxRetries(value?: number) {
  const resolved = value ?? 3;
  if (!Number.isInteger(resolved) || resolved < 0 || resolved > 5) {
    throw new SoundCloudRuntimeConfigurationError();
  }
  return resolved;
}

function cancelledError() {
  return new SoundCloudApiError("CANCELLED", "SoundCloud API request was cancelled.");
}

function deadlineError() {
  return new SoundCloudApiError("DEADLINE_EXCEEDED", "SoundCloud API request deadline exceeded.");
}

function createAttemptSignal(parent: AbortSignal | null | undefined, timeoutMs: number) {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromParent = () => controller.abort(parent?.reason);
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  if (parent?.aborted) abortFromParent();
  else parent?.addEventListener("abort", abortFromParent, { once: true });

  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    cleanup: () => {
      clearTimeout(timeout);
      parent?.removeEventListener("abort", abortFromParent);
    }
  };
}

function parseRetryAfter(value: string | null, now: number) {
  if (!value) return null;
  const normalized = value.trim();
  if (/^[0-9]+$/u.test(normalized)) {
    const seconds = Number(normalized);
    return Number.isSafeInteger(seconds) ? seconds * 1_000 : null;
  }

  const date = Date.parse(normalized);
  return Number.isFinite(date) ? Math.max(0, date - now) : null;
}

function retryDelay(
  retryAfter: string | null,
  attempt: number,
  now: number,
  maxDelayMs: number,
  jitterMs: number,
  random: () => number
) {
  const providerDelay = parseRetryAfter(retryAfter, now);
  const baseDelay = Math.min(maxDelayMs, providerDelay ?? 250 * 2 ** attempt);
  const sample = random();
  const boundedSample = Number.isFinite(sample) ? Math.min(Math.max(sample, 0), 0.999_999) : 0;
  return Math.min(maxDelayMs, baseDelay + Math.floor(boundedSample * jitterMs));
}

async function readBoundedJson<T>(response: Response, maxBytes: number): Promise<T> {
  const contentLength = response.headers.get("content-length");
  if (contentLength && (!/^[0-9]+$/u.test(contentLength) || Number(contentLength) > maxBytes)) {
    await response.body?.cancel().catch(() => undefined);
    throw new SoundCloudApiError("RESPONSE_TOO_LARGE", "SoundCloud API response exceeded the configured limit.");
  }
  if (!response.body) {
    throw new SoundCloudApiError("INVALID_RESPONSE", "SoundCloud API returned an invalid response.");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new SoundCloudApiError("RESPONSE_TOO_LARGE", "SoundCloud API response exceeded the configured limit.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  try {
    const body = new TextDecoder("utf-8", { fatal: true }).decode(
      Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
    );
    return JSON.parse(body) as T;
  } catch (error) {
    if (error instanceof SoundCloudApiError) throw error;
    throw new SoundCloudApiError("INVALID_RESPONSE", "SoundCloud API returned an invalid response.");
  }
}

function appendDefined(params: URLSearchParams, key: string, value: string | number | undefined) {
  if (value !== undefined && value !== "") params.set(key, String(value));
}

export class SoundCloudClient {
  private readonly apiBaseUrl: string;
  private readonly accessToken: string;
  private readonly maxRetries: number;
  private readonly reliability: ReturnType<typeof getSoundCloudApiReliabilityConfig>;
  private readonly fetchImpl: SoundCloudFetch;
  private readonly sleep: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
  private readonly random: () => number;
  private readonly now: () => number;

  constructor(options: SoundCloudClientOptions) {
    this.apiBaseUrl = getSoundCloudConfig(options.env).apiBaseUrl;
    this.accessToken = options.accessToken;
    this.maxRetries = maxRetries(options.maxRetries);
    this.reliability = getSoundCloudApiReliabilityConfig(options.env);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? defaultSleep;
    this.random = options.random ?? Math.random;
    this.now = options.now ?? Date.now;
  }

  async request<T>(pathOrUrl: string, init: RequestInit = {}): Promise<T> {
    const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${this.apiBaseUrl}${pathOrUrl}`;
    assertReadOnlyResearch(url, init.method ?? "GET");
    const requestDeadline = this.now() + this.reliability.deadlineMs;
    const headers = new Headers(init.headers);
    headers.set("Authorization", `OAuth ${this.accessToken}`);
    headers.set("Accept", "application/json");

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      if (init.signal?.aborted) throw cancelledError();
      const remainingMs = requestDeadline - this.now();
      if (remainingMs <= 0) throw deadlineError();

      const attemptSignal = createAttemptSignal(init.signal, Math.min(remainingMs, this.reliability.attemptTimeoutMs));
      let response: Response;
      try {
        response = await this.fetchImpl(url, {
          ...init,
          headers,
          redirect: "error",
          signal: attemptSignal.signal
        });
      } catch (error) {
        const classified = init.signal?.aborted
          ? cancelledError()
          : attemptSignal.timedOut()
            ? this.now() >= requestDeadline
              ? deadlineError()
              : new SoundCloudApiError("TIMEOUT", "SoundCloud API request attempt timed out.", { retryable: true })
            : error instanceof TypeError
              ? new SoundCloudApiError("NETWORK_ERROR", "SoundCloud API network request failed.", { retryable: true })
              : new SoundCloudApiError("NETWORK_ERROR", "SoundCloud API network request failed.");
        attemptSignal.cleanup();

        if (!classified.retryable || attempt >= this.maxRetries) throw classified;
        await this.waitBeforeRetry(null, attempt, requestDeadline, init.signal);
        continue;
      }

      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        attemptSignal.cleanup();
        const classified = new SoundCloudApiError(
          "HTTP_ERROR",
          `SoundCloud API request failed (${response.status}).`,
          { status: response.status, retryable: retryableStatuses.has(response.status) }
        );
        if (!classified.retryable || attempt >= this.maxRetries) throw classified;
        await this.waitBeforeRetry(response.headers.get("retry-after"), attempt, requestDeadline, init.signal);
        continue;
      }

      try {
        const result = await readBoundedJson<T>(response, this.reliability.maxResponseBytes);
        attemptSignal.cleanup();
        return result;
      } catch (error) {
        const classified = error instanceof SoundCloudApiError
          ? error
          : init.signal?.aborted
            ? cancelledError()
            : attemptSignal.timedOut()
              ? this.now() >= requestDeadline
                ? deadlineError()
                : new SoundCloudApiError("TIMEOUT", "SoundCloud API response timed out.", { retryable: true })
              : error instanceof TypeError
                ? new SoundCloudApiError("NETWORK_ERROR", "SoundCloud API response failed.", { retryable: true })
                : new SoundCloudApiError("INVALID_RESPONSE", "SoundCloud API returned an invalid response.");
        attemptSignal.cleanup();
        if (!classified.retryable || attempt >= this.maxRetries) throw classified;
        await this.waitBeforeRetry(null, attempt, requestDeadline, init.signal);
      }
    }

    throw new SoundCloudApiError("NETWORK_ERROR", "SoundCloud API request exhausted bounded retries.");
  }

  private async waitBeforeRetry(
    retryAfter: string | null,
    attempt: number,
    requestDeadline: number,
    signal?: AbortSignal | null
  ) {
    if (signal?.aborted) throw cancelledError();
    const delayMs = retryDelay(
      retryAfter,
      attempt,
      this.now(),
      this.reliability.maxRetryDelayMs,
      this.reliability.retryJitterMs,
      this.random
    );
    if (delayMs >= requestDeadline - this.now()) throw deadlineError();
    await this.sleep(delayMs, signal ?? undefined);
    if (signal?.aborted) throw cancelledError();
  }

  async getMe() {
    return this.request<SoundCloudUser>("/me");
  }

  async getMyTracks(limit = 50) {
    return this.request<SoundCloudCollection<SoundCloudTrack>>(`/me/tracks?linked_partitioning=true&limit=${limit}`);
  }

  async getTrackComments(trackUrn: string, limit = 50) {
    return this.request<SoundCloudCollection<SoundCloudComment>>(
      `/tracks/${encodeURIComponent(trackUrn)}/comments?linked_partitioning=true&limit=${limit}`
    );
  }

  async getTrackFavoriters(trackUrn: string, limit = 50) {
    return this.request<SoundCloudCollection<SoundCloudUser>>(
      `/tracks/${encodeURIComponent(trackUrn)}/favoriters?linked_partitioning=true&limit=${limit}`
    );
  }

  async getTrackReposters(trackUrn: string, limit = 50) {
    return this.request<SoundCloudCollection<SoundCloudUser>>(
      `/tracks/${encodeURIComponent(trackUrn)}/reposters?linked_partitioning=true&limit=${limit}`
    );
  }

  async getRelatedTracks(trackUrn: string, limit = 50) {
    return this.request<SoundCloudCollection<SoundCloudTrack>>(
      `/tracks/${encodeURIComponent(trackUrn)}/related?linked_partitioning=true&limit=${limit}`
    );
  }

  async getRelatedUsers(userUrn: string, limit = 50) {
    return this.request<SoundCloudCollection<SoundCloudUser>>(
      `/users/${encodeURIComponent(userUrn)}/related?linked_partitioning=true&limit=${limit}`
    );
  }

  async searchTracks(params: TrackSearchParams) {
    const query = new URLSearchParams({ linked_partitioning: "true" });
    appendDefined(query, "q", params.q);
    appendDefined(query, "tags", params.tags);
    appendDefined(query, "genres", params.genres);
    appendDefined(query, "bpm[from]", params.bpmFrom);
    appendDefined(query, "bpm[to]", params.bpmTo);
    appendDefined(query, "duration[from]", params.durationFrom);
    appendDefined(query, "duration[to]", params.durationTo);
    appendDefined(query, "created_at[from]", params.createdAtFrom);
    appendDefined(query, "created_at[to]", params.createdAtTo);
    appendDefined(query, "limit", params.limit ?? 50);
    return this.request<SoundCloudCollection<SoundCloudTrack>>(`/tracks?${query.toString()}`);
  }
}

export async function paginateSoundCloud<T>(
  firstPage: SoundCloudCollection<T>,
  fetchPage: (nextHref: string) => Promise<SoundCloudCollection<T>>,
  maxPages = 10
) {
  const items = [...firstPage.collection];
  let nextHref = firstPage.next_href;
  let page = 1;

  while (nextHref && page < maxPages) {
    const next = await fetchPage(nextHref);
    items.push(...next.collection);
    nextHref = next.next_href;
    page += 1;
  }

  return items;
}
