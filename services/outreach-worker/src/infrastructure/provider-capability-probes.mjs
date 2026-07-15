import { createAbortScope } from "./abort-signal.mjs";
import { resolveMx as dnsResolveMx } from "node:dns/promises";
import { readBoundedResponseText, ResponseSizeLimitError } from "./bounded-response.mjs";

const DEFAULT_CACHE_TTL_MS = 30_000;
const DEFAULT_TIMEOUT_MS = 3_000;
const DEFAULT_MAX_RESPONSE_BYTES = 16_384;

/**
 * Non-mutating Mailgun control-plane probe. It only reads the configured
 * domain resource; it never calls a message, event, route, or validation
 * endpoint. Results are sanitized before they enter the cache.
 */
export class MailgunDomainHealthProbe {
  constructor(config, options = {}) {
    this.baseUrl = stripTrailingSlash(config.baseUrl);
    this.apiKey = config.apiKey;
    this.domain = config.domain;
    this.timeoutMs = boundedPositiveInteger(config.healthTimeoutMs, DEFAULT_TIMEOUT_MS);
    this.maxResponseBytes = boundedPositiveInteger(
      config.healthMaxResponseBytes,
      DEFAULT_MAX_RESPONSE_BYTES
    );
    this.fetch = options.fetch ?? globalThis.fetch;
    this.resolveMx = options.resolveMx ?? dnsResolveMx;
    this.signal = options.signal;
    const clock = options.now ?? Date.now;
    this.now = () => epochMilliseconds(clock());
    this.cache = new SingleFlightTtlCache({
      ttlMs: boundedPositiveInteger(options.cacheTtlMs, DEFAULT_CACHE_TTL_MS),
      now: this.now
    });
    if (typeof this.fetch !== "function") throw new TypeError("A fetch implementation is required");
  }

  async check() {
    return this.cache.get(() => this.probe());
  }

  async probe() {
    const checkedAt = isoTimestamp(this.now());
    const abortScope = createAbortScope({ signals: [this.signal], timeoutMs: this.timeoutMs });
    try {
      throwIfAborted(abortScope.signal);
      const url = `${this.baseUrl}/v4/domains/${encodeURIComponent(this.domain)}`;
      const response = await raceWithAbort(this.fetch(url, {
        method: "GET",
        headers: {
          accept: "application/json",
          authorization: `Basic ${Buffer.from(`api:${this.apiKey}`, "utf8").toString("base64")}`
        },
        signal: abortScope.signal
      }), abortScope.signal);

      const statusReason = mailgunStatusReason(response.status);
      if (statusReason) {
        await cancelResponseBody(response);
        return providerResult({
          configured: true,
          available: false,
          health: "unavailable",
          reason: statusReason,
          checkedAt
        });
      }

      if (!response.ok) {
        await cancelResponseBody(response);
        return providerResult({
          configured: true,
          available: false,
          health: "unavailable",
          reason: "mailgun_unavailable",
          checkedAt
        });
      }

      const body = await readProbeJson(response, this.maxResponseBytes, abortScope.signal);
      const domain = body?.domain;
      if (
        !isPlainObject(domain)
        || typeof domain.name !== "string"
        || typeof domain.state !== "string"
        || typeof domain.is_disabled !== "boolean"
      ) {
        return providerResult({
          configured: true,
          available: false,
          health: "unavailable",
          reason: "mailgun_response_invalid",
          checkedAt
        });
      }
      if (normalizeDomain(domain.name) !== normalizeDomain(this.domain)) {
        return providerResult({
          configured: true,
          available: false,
          health: "unavailable",
          reason: "mailgun_domain_mismatch",
          checkedAt
        });
      }
      if (domain.state.toLowerCase() !== "active" || domain.is_disabled) {
        return providerResult({
          configured: true,
          available: false,
          health: "unavailable",
          reason: "mailgun_domain_inactive",
          checkedAt
        });
      }
      return providerResult({
        configured: true,
        available: true,
        health: "available",
        checkedAt
      });
    } catch (error) {
      return providerResult({
        configured: true,
        available: false,
        health: "unavailable",
        reason: probeFailureReason("mailgun", error, abortScope),
        checkedAt
      });
    } finally {
      abortScope.cleanup();
    }
  }
}

/**
 * Email validation health is deliberately separate from validation itself.
 * A live probe is only made when an explicit, non-mutating health URL exists.
 * SMTP and HTTP providers without such an endpoint remain honestly unknown.
 */
export class EmailValidationHealthProbe {
  constructor(config, options = {}) {
    this.enabled = config.enabled === true;
    this.type = config.type;
    this.heloDomain = config.heloDomain;
    this.healthUrl = config.healthUrl;
    this.token = config.token;
    this.timeoutMs = boundedPositiveInteger(config.healthTimeoutMs, DEFAULT_TIMEOUT_MS);
    this.maxResponseBytes = boundedPositiveInteger(
      config.healthMaxResponseBytes,
      DEFAULT_MAX_RESPONSE_BYTES
    );
    this.fetch = options.fetch ?? globalThis.fetch;
    this.signal = options.signal;
    const clock = options.now ?? Date.now;
    this.now = () => epochMilliseconds(clock());
    this.cache = new SingleFlightTtlCache({
      ttlMs: boundedPositiveInteger(options.cacheTtlMs, DEFAULT_CACHE_TTL_MS),
      now: this.now
    });
    if (this.healthUrl && typeof this.fetch !== "function") {
      throw new TypeError("A fetch implementation is required for email validation health checks");
    }
  }

  async check() {
    if (!this.enabled) {
      return providerResult({
        configured: false,
        available: false,
        health: "disabled",
        reason: "email_validation_disabled",
        type: this.type
      });
    }
    if (this.type === "smtp") {
      return this.smtpProbe();
    }
    if (this.type !== "http" || !this.healthUrl) {
      return providerResult({
        configured: true,
        available: false,
        health: "unknown",
        reason: "email_validation_health_unknown",
        type: this.type
      });
    }
    return this.cache.get(() => this.probe());
  }

  async smtpProbe() {
    const checkedAt = isoTimestamp(this.now());
    const domain = String(this.heloDomain ?? "").trim();
    if (!domain) return providerResult({ configured: true, available: false, health: "unknown", reason: "email_validation_health_unknown", type: this.type });
    try {
      const records = await this.resolveMx("gmail.com");
      if (!Array.isArray(records) || records.length === 0) throw new Error("no MX records");
      return providerResult({ configured: true, available: true, health: "available", reason: "smtp_mx_resolution_available", type: this.type, checkedAt });
    } catch {
      return providerResult({ configured: true, available: false, health: "unavailable", reason: "email_validation_mx_unavailable", type: this.type, checkedAt });
    }
  }

  async probe() {
    const checkedAt = isoTimestamp(this.now());
    const abortScope = createAbortScope({ signals: [this.signal], timeoutMs: this.timeoutMs });
    try {
      throwIfAborted(abortScope.signal);
      const response = await raceWithAbort(this.fetch(this.healthUrl, {
        method: "GET",
        headers: {
          accept: "application/json",
          ...(this.token ? { authorization: `Bearer ${this.token}` } : {})
        },
        signal: abortScope.signal
      }), abortScope.signal);

      const statusReason = emailValidationStatusReason(response.status);
      if (statusReason) {
        await cancelResponseBody(response);
        return providerResult({
          configured: true,
          available: false,
          health: "unavailable",
          reason: statusReason,
          type: this.type,
          checkedAt
        });
      }
      if (!response.ok) {
        await cancelResponseBody(response);
        return providerResult({
          configured: true,
          available: false,
          health: "unavailable",
          reason: "email_validation_unavailable",
          type: this.type,
          checkedAt
        });
      }

      const body = await readProbeJson(response, this.maxResponseBytes, abortScope.signal);
      if (!isPlainObject(body) || body.status !== "ok") {
        return providerResult({
          configured: true,
          available: false,
          health: "unavailable",
          reason: "email_validation_response_invalid",
          type: this.type,
          checkedAt
        });
      }
      return providerResult({
        configured: true,
        available: true,
        health: "available",
        type: this.type,
        checkedAt
      });
    } catch (error) {
      return providerResult({
        configured: true,
        available: false,
        health: "unavailable",
        reason: probeFailureReason("email_validation", error, abortScope),
        type: this.type,
        checkedAt
      });
    } finally {
      abortScope.cleanup();
    }
  }
}

export function configuredInboundRouteEvidence(config) {
  if (
    config.inboundRouteEvidence === "configured"
    && typeof config.inboundRouteEvidenceReference === "string"
    && config.inboundRouteEvidenceReference.length > 0
  ) {
    return Object.freeze({ status: "configured", reason: "inbound_route_configured_evidence" });
  }
  return Object.freeze({ status: "unknown", reason: "inbound_route_evidence_unknown" });
}

class SingleFlightTtlCache {
  constructor({ ttlMs, now }) {
    this.ttlMs = ttlMs;
    this.now = now;
  }

  async get(loader) {
    const now = this.now();
    if (this.cached && this.cached.expiresAt > now) return this.cached.value;
    if (this.inFlight) return this.inFlight;
    this.inFlight = Promise.resolve()
      .then(loader)
      .then((value) => {
        this.cached = { value, expiresAt: this.now() + this.ttlMs };
        return value;
      })
      .finally(() => {
        this.inFlight = undefined;
      });
    return this.inFlight;
  }
}

async function readProbeJson(response, maximumBytes, signal) {
  const contentType = String(response.headers?.get?.("content-type") ?? "").toLowerCase();
  if (!contentType.startsWith("application/json")) {
    await cancelResponseBody(response);
    throw new ProbeContractError();
  }
  const text = await raceWithAbort(readBoundedResponseText(response, maximumBytes), signal);
  try {
    return JSON.parse(text);
  } catch {
    throw new ProbeContractError();
  }
}

function mailgunStatusReason(status) {
  if (status === 401 || status === 403) return "mailgun_auth_rejected";
  if (status === 404) return "mailgun_domain_not_found";
  if (status === 429) return "mailgun_rate_limited";
  if (status >= 500) return "mailgun_unavailable";
  return undefined;
}

function emailValidationStatusReason(status) {
  if (status === 401 || status === 403) return "email_validation_auth_rejected";
  if (status === 429) return "email_validation_rate_limited";
  if (status >= 400) return "email_validation_unavailable";
  return undefined;
}

function probeFailureReason(provider, error, abortScope) {
  if (error instanceof ResponseSizeLimitError) return `${provider}_response_too_large`;
  if (error instanceof ProbeContractError) return `${provider}_response_invalid`;
  if (abortScope.timedOut) return `${provider}_timeout`;
  if (abortScope.externallyAborted || error?.name === "AbortError") return `${provider}_probe_aborted`;
  return `${provider}_unavailable`;
}

async function raceWithAbort(operation, signal) {
  if (signal.aborted) throw abortError(signal.reason);
  let onAbort;
  const aborted = new Promise((_, reject) => {
    onAbort = () => reject(abortError(signal.reason));
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    return await Promise.race([Promise.resolve(operation), aborted]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

async function cancelResponseBody(response) {
  try {
    await response.body?.cancel?.();
  } catch {
    // The sanitized status code remains authoritative if cancellation races.
  }
}

function providerResult({ configured, available, health, reason, type, checkedAt }) {
  return Object.freeze({
    configured: Boolean(configured),
    available: Boolean(available),
    health,
    ...(type ? { type } : {}),
    ...(reason ? { reason } : {}),
    ...(checkedAt ? { checkedAt } : {})
  });
}

function boundedPositiveInteger(value, fallback) {
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function isoTimestamp(value) {
  return new Date(epochMilliseconds(value)).toISOString();
}

function normalizeDomain(value) {
  return String(value).trim().toLowerCase().replace(/\.$/u, "");
}

function stripTrailingSlash(value) {
  return String(value).replace(/\/+$/u, "");
}

function isPlainObject(value) {
  return Boolean(value) && !Array.isArray(value) && typeof value === "object";
}

function abortError(reason) {
  const error = new Error("Provider capability probe aborted", {
    ...(reason instanceof Error ? { cause: reason } : {})
  });
  error.name = "AbortError";
  return error;
}

function throwIfAborted(signal) {
  if (signal.aborted) throw abortError(signal.reason);
}

function epochMilliseconds(value) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) throw new TypeError("Provider probe clock returned an invalid time");
  return timestamp;
}

class ProbeContractError extends Error {
  constructor() {
    super("Provider capability response did not match the expected contract");
    this.name = "ProbeContractError";
  }
}
