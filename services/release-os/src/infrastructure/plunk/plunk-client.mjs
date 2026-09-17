import { createHash } from "node:crypto";
import { isProductionRuntime } from "../../domain/legacy-outreach-send-policy.mjs";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_ATTEMPTS = 2;
const DEFAULT_MAX_RESPONSE_BYTES = 64 * 1024;
const DEFAULT_RETRY_POLICY = Object.freeze({
  baseDelayMs: 250,
  maxDelayMs: 2_000
});
// Only an explicit rate-limit response is safe to retry automatically. A
// timeout, disconnect, or 5xx can happen after Plunk accepted the request;
// those outcomes must be reconciled instead of being sent a second time.
const RETRYABLE_STATUS_CODES = new Set([429]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

/**
 * Error boundary for the provider-neutral email port.
 *
 * `outcomeUncertain` is deliberately separate from `retryable`: a timeout or
 * network disconnect can happen after Plunk accepted the request, so callers
 * must reconcile that result instead of blindly sending it again.
 */
export class PlunkClientError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "PlunkClientError";
    this.status = options.status;
    this.code = options.code;
    this.response = options.response;
    this.retryable = Boolean(options.retryable);
    this.outcomeUncertain = Boolean(options.outcomeUncertain);
    this.idempotencyKey = options.idempotencyKey;
  }
}

export class PlunkSendDisabledError extends Error {
  constructor() {
    super("Plunk sending is disabled; set PLUNK_SEND_ENABLED=true only after production readiness checks.");
    this.name = "PlunkSendDisabledError";
    this.code = "PLUNK_SEND_DISABLED";
    this.statusCode = 503;
    this.retryable = false;
    this.outcomeUncertain = false;
  }
}

export class PlunkClient {
  constructor(options = {}) {
    if (!options || typeof options !== "object") {
      throw new TypeError("PlunkClient options are required");
    }

    const env = options.env ?? process.env;
    this.secretKey = requireString(options.secretKey ?? options.apiKey, "secretKey");
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? "https://mail.marcsmusic.nl", env);
    this.sendPath = normalizePath(options.sendPath ?? "/v1/send");
    this.defaultFrom = requireString(options.defaultFrom, "defaultFrom");
    this.fromName = optionalString(options.fromName);
    this.defaultReplyTo = optionalString(options.defaultReplyTo ?? options.replyTo);
    if (this.defaultReplyTo) assertEmail(this.defaultReplyTo, "defaultReplyTo");
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxAttempts = options.maxAttempts ?? options.retryPolicy?.attempts ?? DEFAULT_MAX_ATTEMPTS;
    this.maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
    this.fetch = options.fetch ?? globalThis.fetch;
    this.sleep = options.sleep ?? sleep;
    this.retryPolicy = normalizeRetryPolicy(options.retryPolicy ?? DEFAULT_RETRY_POLICY);
    this.sendEnabled = options.sendEnabled === true || options.plunkSendEnabled === true ||
      env.PLUNK_SEND_ENABLED === "true";
    this.legacyOutreachSendEnabled = options.legacyOutreachSendEnabled === true &&
      !isProductionRuntime(env);

    if (typeof this.fetch !== "function") {
      throw new TypeError("A fetch implementation is required");
    }
    assertPositiveInteger(this.timeoutMs, "timeoutMs");
    assertPositiveInteger(this.maxAttempts, "maxAttempts");
    assertPositiveInteger(this.maxResponseBytes, "maxResponseBytes");
  }

  async sendMessage(message) {
    if (!this.sendEnabled && !this.legacyOutreachSendEnabled) {
      throw new PlunkSendDisabledError();
    }

    const payload = normalizeMessage(message, {
      defaultFrom: this.defaultFrom,
      fromName: this.fromName,
      defaultReplyTo: this.defaultReplyTo
    });
    const idempotencyKey = payload.idempotencyKey;
    const url = `${this.baseUrl}${this.sendPath}`;
    const response = await this.#requestWithRetry(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "Idempotency-Key": idempotencyKey
      },
      body: JSON.stringify(payload.body)
    }, idempotencyKey);

    return normalizeSendResponse(response, idempotencyKey);
  }

  async #requestWithRetry(url, request, idempotencyKey) {
    let lastError;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        return await this.#request(url, request, idempotencyKey);
      } catch (error) {
        lastError = error;
        // A timeout/network error may have happened after Plunk accepted the
        // request. Never retry an uncertain outcome automatically.
        if (!error.retryable || error.outcomeUncertain || attempt === this.maxAttempts) {
          throw error;
        }

        await this.sleep(getRetryDelayMs(error, attempt, this.retryPolicy));
      }
    }

    throw lastError;
  }

  async #request(url, request, idempotencyKey) {
    const controller = new AbortController();
    let timeout;
    const operation = (async () => {
      let response;
      try {
        response = await this.fetch(url, {
          ...request,
          redirect: "error",
          signal: controller.signal
        });
      } catch (error) {
        if (error?.name === "AbortError") {
          throw new PlunkClientError("Plunk request timed out", {
            code: "PLUNK_TIMEOUT",
            retryable: false,
            outcomeUncertain: true,
            idempotencyKey
          });
        }

        throw new PlunkClientError("Plunk request failed", {
          code: "PLUNK_NETWORK_ERROR",
          retryable: false,
          outcomeUncertain: true,
          response: { cause: error?.message },
          idempotencyKey
        });
      }

      const body = await readResponseBody(response, this.maxResponseBytes, idempotencyKey);
      if (!response.ok) {
        const idempotencyReused = response.status === 409;
        const outcomeUncertain = idempotencyReused || response.status === 408 || response.status === 425 || response.status >= 500;
        throw new PlunkClientError(
          idempotencyReused
            ? "Plunk rejected a reused idempotency key; reconcile the original send"
            : `Plunk request failed with HTTP ${response.status}`,
          {
            status: response.status,
            response: safeProviderError(body),
            code: idempotencyReused ? "PLUNK_IDEMPOTENCY_REUSED" : "PLUNK_REQUEST_FAILED",
            retryable: RETRYABLE_STATUS_CODES.has(response.status) && !outcomeUncertain,
            outcomeUncertain,
            idempotencyKey
          }
        );
      }

      return body;
    })();

    try {
      return await Promise.race([
        operation,
        new Promise((_, reject) => {
          timeout = setTimeout(() => {
            controller.abort();
            reject(new PlunkClientError("Plunk request timed out", {
              code: "PLUNK_TIMEOUT",
              retryable: false,
              outcomeUncertain: true,
              idempotencyKey
            }));
          }, this.timeoutMs);
        })
      ]);
    } catch (error) {
      if (error instanceof PlunkClientError) throw error;
      if (error?.name === "AbortError") {
        throw new PlunkClientError("Plunk request timed out", {
          code: "PLUNK_TIMEOUT",
          retryable: false,
          outcomeUncertain: true,
          idempotencyKey
        });
      }

      throw new PlunkClientError("Plunk request failed", {
        code: "PLUNK_NETWORK_ERROR",
        retryable: false,
        outcomeUncertain: true,
        response: { cause: error?.message },
        idempotencyKey
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createPlunkClient(config) {
  return new PlunkClient(config);
}

function normalizeMessage(message, options) {
  if (!message || typeof message !== "object") {
    throw new TypeError("message is required");
  }

  const from = normalizeFrom(message.from ?? options.defaultFrom, options.fromName);
  const configuredFrom = normalizeFrom(options.defaultFrom, options.fromName);
  if (from.email.toLowerCase() !== configuredFrom.email.toLowerCase()) {
    throw new TypeError("message.from must match the configured EMAIL_FROM address");
  }

  const to = normalizeRecipients(message.to);
  const subject = requireString(message.subject, "subject");
  if (/[\r\n]/u.test(subject)) {
    throw new TypeError("message.subject must not contain newlines");
  }

  const text = optionalString(message.text);
  const html = optionalString(message.html);
  const template = optionalString(message.template);
  if (!text && !html && !template) {
    throw new TypeError("message.text, message.html, or message.template is required");
  }
  if (template) {
    throw new TypeError("Plunk template sends require a configured template payload");
  }

  const replyTo = optionalString(message.replyTo) ?? options.defaultReplyTo;
  if (replyTo) assertEmail(replyTo, "message.replyTo");
  const headers = normalizeHeaders(message.headers);
  const templateVariables = normalizeRecord(message.templateVariables, "templateVariables");
  const variables = normalizeRecord(message.variables, "variables");
  const data = normalizeData({ ...templateVariables, ...variables });
  const correlationId = optionalString(message.correlationId);
  const idempotencyKey = normalizeIdempotencyKey(
    message.idempotencyKey ?? correlationId ?? createDeterministicIdempotencyKey({
      from: from.email,
      to,
      subject,
      text,
      html,
      data
    })
  );

  const payloadHeaders = { ...headers };
  if (correlationId && !Object.hasOwn(payloadHeaders, "X-MarcsMusic-Correlation-Id")) {
    payloadHeaders["X-MarcsMusic-Correlation-Id"] = correlationId;
  }

  return {
    idempotencyKey,
    body: {
      to: to.length === 1 ? to[0] : to,
      from,
      subject,
      body: html ?? textToHtml(text),
      ...(replyTo ? { reply: replyTo } : {}),
      ...(Object.keys(data).length > 0 ? { data } : {}),
      ...(Object.keys(payloadHeaders).length > 0 ? { headers: payloadHeaders } : {})
    }
  };
}

function normalizeFrom(value, fallbackName) {
  const raw = requireString(value, "from");
  const match = raw.match(/^(.+?)\s*<([^<>]+)>$/u);
  if (match) {
    const name = match[1].trim().replace(/^['"]|['"]$/gu, "");
    const email = match[2].trim();
    assertEmail(email, "from");
    if (/[\r\n]/u.test(name)) throw new TypeError("from name must not contain newlines");
    return name ? { name, email } : { email };
  }

  assertEmail(raw, "from");
  return fallbackName ? { name: fallbackName, email: raw } : { email: raw };
}

function normalizeRecipients(value) {
  if (value === undefined) {
    throw new TypeError("message.to must contain at least one recipient");
  }
  const values = Array.isArray(value) ? value : [value];
  const recipients = values.map((item) => {
    const email = typeof item === "object" && item !== null ? item.email : item;
    const normalized = requireString(email, "to");
    assertEmail(normalized, "to");
    return normalized;
  });
  const unique = [...new Set(recipients.map((email) => email.toLowerCase()))];
  if (unique.length === 0) throw new TypeError("message.to must contain at least one recipient");
  return unique;
}

function normalizeHeaders(headers) {
  if (headers === undefined) return {};
  if (!headers || typeof headers !== "object" || Array.isArray(headers)) {
    throw new TypeError("message.headers must be an object");
  }
  const normalized = {};
  for (const [name, value] of Object.entries(headers)) {
    if (!name.trim() || /[\r\n:]/u.test(name)) {
      throw new TypeError("header names must not be empty or contain ':' or newlines");
    }
    const headerValue = requireString(value, `headers.${name}`);
    if (/[\r\n]/u.test(headerValue) || headerValue.length > 998) {
      throw new TypeError(`headers.${name} contains an invalid value`);
    }
    normalized[name] = headerValue;
  }
  return normalized;
}

function normalizeData(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("message.variables must be an object");
  }
  const normalized = {};
  for (const [key, item] of Object.entries(value)) {
    if (/^(id|plunk_id|plunk_email|email|unsubscribeUrl|subscribeUrl|manageUrl)$/u.test(key)) continue;
    if (item === null || typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
      normalized[key] = item;
    }
  }
  return normalized;
}

function normalizeRecord(value, fieldName) {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`message.${fieldName} must be an object`);
  }
  return value;
}

function normalizeSendResponse(response, idempotencyKey) {
  if (!response || typeof response !== "object") {
    throw new PlunkClientError("Plunk returned an invalid response", {
      code: "PLUNK_INVALID_RESPONSE",
      retryable: false,
      response,
      idempotencyKey
    });
  }

  const firstEmail = response.data?.emails?.[0];
  const id = firstEmail?.email ?? response.data?.email ?? response.id;
  if (typeof id !== "string" || id.trim() === "") {
    throw new PlunkClientError("Plunk returned no provider message id", {
      code: "PLUNK_INVALID_RESPONSE",
      retryable: false,
      response: safeProviderError(response),
      idempotencyKey
    });
  }

  return {
    id: id.trim(),
    providerMessageId: id.trim(),
    provider: "plunk",
    message: "Accepted by Plunk",
    idempotencyKey
  };
}

async function readResponseBody(response, maximumBytes, idempotencyKey) {
  const declared = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declared) && declared > maximumBytes) {
    throw new PlunkClientError("Plunk response exceeded the configured byte limit", {
      code: "PLUNK_RESPONSE_TOO_LARGE",
      retryable: false,
      idempotencyKey
    });
  }
  const text = typeof response.text === "function" ? await response.text() : "";
  if (Buffer.byteLength(text, "utf8") > maximumBytes) {
    throw new PlunkClientError("Plunk response exceeded the configured byte limit", {
      code: "PLUNK_RESPONSE_TOO_LARGE",
      retryable: false,
      idempotencyKey
    });
  }
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: "Plunk returned a non-JSON response" };
  }
}

function safeProviderError(body) {
  if (!body || typeof body !== "object") return undefined;
  const error = body.error;
  return {
    code: typeof error?.code === "string" ? error.code : undefined,
    message: typeof error?.message === "string" ? error.message : undefined,
    requestId: typeof error?.requestId === "string" ? error.requestId : undefined
  };
}

function createDeterministicIdempotencyKey(value) {
  const digest = createHash("sha256").update(JSON.stringify(value)).digest("hex");
  return `marcsmusic-${digest}`;
}

function normalizeIdempotencyKey(value) {
  const key = requireString(value, "idempotencyKey");
  if (key.length > 255 || /[^\x20-\x7E]/u.test(key)) {
    throw new TypeError("idempotencyKey must be 1-255 printable ASCII characters");
  }
  return key;
}

function textToHtml(text) {
  return escapeHtml(text).replace(/\r?\n/gu, "<br>\n");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function assertEmail(value, fieldName) {
  if (!EMAIL_PATTERN.test(value)) {
    throw new TypeError(`${fieldName} must be a valid email address`);
  }
}

function normalizeBaseUrl(value, env) {
  const baseUrl = requireString(value, "baseUrl").replace(/\/+$/u, "");
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new TypeError("baseUrl must be a valid URL");
  }
  const localHttp = parsed.protocol === "http:" &&
    ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(localHttp && !isProductionRuntime(env))) {
    throw new TypeError("baseUrl must use https in production");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new TypeError("baseUrl must not contain credentials or query parameters");
  }
  return baseUrl;
}

function normalizePath(value) {
  const path = requireString(value, "sendPath");
  if (!path.startsWith("/") || path.includes("..") || /[\r\n]/u.test(path)) {
    throw new TypeError("sendPath must be a safe absolute path");
  }
  return path;
}

function normalizeRetryPolicy(value) {
  const baseDelayMs = Number(value.baseDelayMs);
  const maxDelayMs = Number(value.maxDelayMs);
  if (!Number.isSafeInteger(baseDelayMs) || baseDelayMs < 0) {
    throw new TypeError("retryPolicy.baseDelayMs must be a non-negative integer");
  }
  if (!Number.isSafeInteger(maxDelayMs) || maxDelayMs < 0) {
    throw new TypeError("retryPolicy.maxDelayMs must be a non-negative integer");
  }
  return { baseDelayMs, maxDelayMs };
}

function getRetryDelayMs(error, attempt, policy) {
  const exponentialDelay = policy.baseDelayMs * 2 ** (attempt - 1);
  return Math.min(exponentialDelay, policy.maxDelayMs);
}

function assertPositiveInteger(value, fieldName) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${fieldName} must be a positive integer`);
  }
}

function requireString(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${fieldName} must be a non-empty string`);
  }
  return value.trim();
}

function optionalString(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function sleep(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
