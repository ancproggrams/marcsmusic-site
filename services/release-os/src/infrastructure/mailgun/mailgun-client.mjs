import {
  isProductionRuntime,
  LegacyOutreachSendDisabledError
} from "../../domain/legacy-outreach-send-policy.mjs";

const DEFAULT_RETRY_POLICY = Object.freeze({
  attempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 2_000
});

const RETRYABLE_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const DEFAULT_MAX_RESPONSE_BYTES = 64 * 1024;

export class MailgunClientError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "MailgunClientError";
    this.status = options.status;
    this.code = options.code;
    this.response = options.response;
    this.rateLimitResetMs = options.rateLimitResetMs;
    this.retryable = Boolean(options.retryable);
  }
}

export class MailgunClient {
  constructor(options) {
    if (!options || typeof options !== "object") {
      throw new TypeError("MailgunClient options are required");
    }

    this.apiKey = requireString(options.apiKey, "apiKey");
    this.domain = requireString(options.domain, "domain");
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? "https://api.mailgun.net");
    this.defaultFrom = optionalString(options.defaultFrom);
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.maxResponseBytes = options.maxResponseBytes ?? configuredPositiveInteger(
      (options.env ?? process.env).MAILGUN_MAX_RESPONSE_BYTES,
      DEFAULT_MAX_RESPONSE_BYTES
    );
    this.fetch = options.fetch ?? globalThis.fetch;
    this.sleep = options.sleep ?? sleep;
    this.retryPolicy = normalizeRetryPolicy(options.retryPolicy ?? DEFAULT_RETRY_POLICY);
    this.legacyOutreachSendEnabled = options.legacyOutreachSendEnabled === true &&
      !isProductionRuntime(options.env ?? process.env);

    if (typeof this.fetch !== "function") {
      throw new TypeError("A fetch implementation is required");
    }

    if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs <= 0) {
      throw new TypeError("timeoutMs must be a positive integer");
    }
    if (!Number.isSafeInteger(this.maxResponseBytes) || this.maxResponseBytes <= 0) {
      throw new TypeError("maxResponseBytes must be a positive integer");
    }
  }

  async sendMessage(message) {
    if (!this.legacyOutreachSendEnabled) {
      throw new LegacyOutreachSendDisabledError();
    }
    const payload = normalizeMessage(message, this.defaultFrom);
    const url = `${this.baseUrl}/v3/${encodeURIComponent(this.domain)}/messages`;
    const response = await this.#requestWithRetry(url, {
      method: "POST",
      body: buildMessageFormData(payload)
    });

    return normalizeSendResponse(response);
  }

  async #requestWithRetry(url, request) {
    let lastError;

    for (let attempt = 1; attempt <= this.retryPolicy.attempts; attempt += 1) {
      try {
        return await this.#request(url, request);
      } catch (error) {
        lastError = error;

        if (!isRetryableError(error) || attempt === this.retryPolicy.attempts) {
          throw error;
        }

        await this.sleep(getRetryDelayMs(error, attempt, this.retryPolicy));
      }
    }

    throw lastError;
  }

  async #request(url, request) {
    const controller = new AbortController();
    let timeout;
    const operation = (async () => {
      const response = await this.fetch(url, {
        ...request,
        headers: {
          Authorization: `Basic ${Buffer.from(`api:${this.apiKey}`).toString("base64")}`,
          ...(request.headers ?? {})
        },
        redirect: "error",
        signal: controller.signal
      });
      const body = await readResponseBody(response, this.maxResponseBytes);
      if (!response.ok) {
        throw new MailgunClientError(readErrorMessage(body, response.status), {
          status: response.status,
          response: body,
          rateLimitResetMs: readRateLimitResetMs(response.headers),
          retryable: RETRYABLE_STATUS_CODES.has(response.status)
        });
      }
      return body;
    })();

    try {
      return await Promise.race([
        operation,
        new Promise((_, reject) => {
          timeout = setTimeout(() => {
            controller.abort();
            reject(new MailgunClientError("Mailgun request timed out", {
              code: "MAILGUN_TIMEOUT",
              retryable: true
            }));
          }, this.timeoutMs);
        })
      ]);
    } catch (error) {
      if (error instanceof MailgunClientError) throw error;
      if (error?.name === "AbortError") {
        throw new MailgunClientError("Mailgun request timed out", {
          code: "MAILGUN_TIMEOUT",
          retryable: true
        });
      }

      throw new MailgunClientError("Mailgun request failed", {
        code: "MAILGUN_NETWORK_ERROR",
        response: { cause: error?.message },
        retryable: true
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createMailgunClient(config) {
  return new MailgunClient(config);
}

function buildMessageFormData(message) {
  const form = new FormData();

  appendValue(form, "from", message.from);
  appendArray(form, "to", message.to);
  appendArray(form, "cc", message.cc);
  appendArray(form, "bcc", message.bcc);
  appendValue(form, "subject", message.subject);
  appendValue(form, "text", message.text);
  appendValue(form, "html", message.html);
  appendValue(form, "template", message.template);
  appendValue(form, "t:variables", message.templateVariables && JSON.stringify(message.templateVariables));
  appendArray(form, "o:tag", message.tags);
  appendValue(form, "o:testmode", message.testMode ? "yes" : undefined);
  appendValue(form, "h:Reply-To", message.replyTo);
  appendValue(form, "v:correlation-id", message.correlationId);

  for (const [name, value] of Object.entries(message.headers ?? {})) {
    appendValue(form, `h:${name}`, value);
  }

  for (const [name, value] of Object.entries(message.variables ?? {})) {
    appendValue(form, `v:${name}`, serializeVariable(value));
  }

  return form;
}

function normalizeMessage(message, defaultFrom) {
  if (!message || typeof message !== "object") {
    throw new TypeError("message is required");
  }

  const from = optionalString(message.from) ?? defaultFrom;
  const to = normalizeRecipients(message.to, "to");
  const cc = normalizeOptionalRecipients(message.cc, "cc");
  const bcc = normalizeOptionalRecipients(message.bcc, "bcc");
  const subject = requireString(message.subject, "subject");
  const text = optionalString(message.text);
  const html = optionalString(message.html);
  const template = optionalString(message.template);

  if (!from) {
    throw new TypeError("message.from is required when no defaultFrom is configured");
  }

  if (!text && !html && !template) {
    throw new TypeError("message.text, message.html, or message.template is required");
  }

  return {
    from,
    to,
    cc,
    bcc,
    subject,
    text,
    html,
    template,
    templateVariables: normalizeRecord(message.templateVariables, "templateVariables"),
    tags: normalizeOptionalStringArray(message.tags, "tags"),
    testMode: Boolean(message.testMode),
    replyTo: optionalString(message.replyTo),
    headers: normalizeHeaders(message.headers),
    variables: normalizeRecord(message.variables, "variables"),
    correlationId: optionalString(message.correlationId)
  };
}

function normalizeRecipients(value, fieldName) {
  const recipients = normalizeOptionalRecipients(value, fieldName);

  if (recipients.length === 0) {
    throw new TypeError(`message.${fieldName} must contain at least one recipient`);
  }

  return recipients;
}

function normalizeOptionalRecipients(value, fieldName) {
  if (value === undefined) {
    return [];
  }

  const values = Array.isArray(value) ? value : [value];
  const recipients = values.map((item) => requireString(item, fieldName));
  return [...new Set(recipients)];
}

function normalizeOptionalStringArray(value, fieldName) {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new TypeError(`message.${fieldName} must be an array`);
  }

  return value.map((item) => requireString(item, fieldName));
}

function normalizeHeaders(headers) {
  if (headers === undefined) {
    return {};
  }

  const normalized = normalizeRecord(headers, "headers");
  const safeHeaders = {};

  for (const [name, value] of Object.entries(normalized)) {
    if (/[\r\n:]/u.test(name) || name.trim() === "") {
      throw new TypeError("header names must not be empty or contain ':' or newlines");
    }

    safeHeaders[name] = requireString(value, `headers.${name}`);
  }

  return safeHeaders;
}

function normalizeRecord(value, fieldName) {
  if (value === undefined) {
    return undefined;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`message.${fieldName} must be an object`);
  }

  return value;
}

function normalizeSendResponse(response) {
  if (!response || typeof response !== "object") {
    throw new MailgunClientError("Mailgun returned an invalid response", {
      response,
      retryable: false
    });
  }

  return {
    id: requireString(response.id, "response.id"),
    message: requireString(response.message, "response.message")
  };
}

async function readResponseBody(response, maximumBytes) {
  const declared = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declared) && declared > maximumBytes) throw mailgunResponseTooLarge();
  let bytes;
  if (response.body?.getReader) {
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
          throw mailgunResponseTooLarge();
        }
        chunks.push(Buffer.from(value));
      }
    } finally {
      reader.releaseLock?.();
    }
    bytes = Buffer.concat(chunks, total);
  } else {
    bytes = Buffer.from(await response.text(), "utf8");
    if (bytes.byteLength > maximumBytes) throw mailgunResponseTooLarge();
  }
  const text = bytes.toString("utf8");

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function mailgunResponseTooLarge() {
  return new MailgunClientError("Mailgun response exceeded the configured byte limit", {
    code: "MAILGUN_RESPONSE_TOO_LARGE",
    retryable: false
  });
}

function readErrorMessage(body, status) {
  if (body && typeof body.message === "string" && body.message.trim()) {
    return body.message;
  }

  return `Mailgun request failed with HTTP ${status}`;
}

function getRetryDelayMs(error, attempt, retryPolicy) {
  if (Number.isSafeInteger(error.rateLimitResetMs)) {
    const resetDelayMs = error.rateLimitResetMs - Date.now();
    return Math.min(Math.max(resetDelayMs, 0), retryPolicy.maxDelayMs);
  }

  const exponentialDelay = retryPolicy.baseDelayMs * 2 ** (attempt - 1);
  return Math.min(exponentialDelay, retryPolicy.maxDelayMs);
}

function readRateLimitResetMs(headers) {
  const value = headers?.get?.("x-ratelimit-reset");

  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function isRetryableError(error) {
  return error instanceof MailgunClientError && error.retryable;
}

function normalizeBaseUrl(value) {
  const baseUrl = requireString(value, "baseUrl").replace(/\/+$/u, "");
  const parsed = new URL(baseUrl);

  if (parsed.protocol !== "https:") {
    throw new TypeError("baseUrl must use https");
  }

  return baseUrl;
}

function normalizeRetryPolicy(value) {
  return {
    attempts: parsePositiveInteger(value.attempts, "retryPolicy.attempts"),
    baseDelayMs: parseNonNegativeInteger(value.baseDelayMs, "retryPolicy.baseDelayMs"),
    maxDelayMs: parseNonNegativeInteger(value.maxDelayMs, "retryPolicy.maxDelayMs")
  };
}

function parsePositiveInteger(value, fieldName) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${fieldName} must be a positive integer`);
  }

  return value;
}

function configuredPositiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}

function parseNonNegativeInteger(value, fieldName) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${fieldName} must be a non-negative integer`);
  }

  return value;
}

function requireString(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${fieldName} must be a non-empty string`);
  }

  return value.trim();
}

function optionalString(value) {
  if (value === undefined || value === null) {
    return undefined;
  }

  return requireString(value, "value");
}

function appendArray(form, name, values = []) {
  for (const value of values) {
    appendValue(form, name, value);
  }
}

function appendValue(form, name, value) {
  if (value !== undefined) {
    form.append(name, value);
  }
}

function serializeVariable(value) {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
}

function sleep(delayMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}
