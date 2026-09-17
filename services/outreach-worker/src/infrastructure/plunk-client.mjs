import { ApplicationError } from "../errors.mjs";
import { createAbortScope } from "./abort-signal.mjs";
import { readBoundedResponseText, ResponseSizeLimitError } from "./bounded-response.mjs";
import { createHash } from "node:crypto";

// Plunk exposes a provider-neutral transactional API with a bounded
// Idempotency-Key window. Durable queue leases and the deterministic message
// id in PostgreSQL remain the source of truth for duplicate suppression; the
// provider key closes the request/response gap without permitting a blind
// second send.
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RESPONSE_BYTES = 64 * 1_024;
const RETRYABLE_STATUS = new Set([429]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export class PlunkClient {
  constructor(config, options = {}) {
    if (!config || typeof config !== "object") throw new TypeError("Plunk configuration is required");
    this.baseUrl = normalizeBaseUrl(config.baseUrl);
    this.apiKey = requiredString(config.apiKey ?? config.secretKey, "apiKey");
    this.from = assertMailbox(config.from ?? config.defaultFrom, "from");
    this.fromAddress = parseMailbox(this.from, "from");
    this.replyTo = optionalString(config.replyTo);
    if (this.replyTo) assertEmail(this.replyTo, "replyTo");
    this.timeoutMs = positiveInteger(config.timeoutMs, DEFAULT_TIMEOUT_MS);
    this.maxResponseBytes = positiveInteger(config.maxResponseBytes, DEFAULT_MAX_RESPONSE_BYTES);
    this.fetch = options.fetch ?? globalThis.fetch;
    this.signal = options.signal;
    if (typeof this.fetch !== "function") throw new TypeError("A fetch implementation is required");
    this.providerName = "plunk";
    this.supportsOutcomeReconciliation = false;
  }

  /**
   * Send one transactional message through Plunk.
   *
   * The caller owns durable idempotency. `messageId` is propagated as a
   * standard Message-Id header so Plunk/MXRoute and later event webhooks can
   * correlate a provider receipt. The request also carries a deterministic
   * Idempotency-Key derived from the durable message identity.
   */
  async send({ to, subject, text, html, tags = [], variables = {}, correlationId, messageId, inReplyTo, signal }) {
    const recipient = normalizeRecipient(to);
    const normalizedSubject = rejectHeaderInjection(subject, "subject");
    const body = optionalString(html) ?? optionalString(text);
    if (!body) throw new TypeError("text or html is required");

    const headers = {};
    if (messageId) headers["Message-Id"] = rejectMessageId(messageId);
    if (inReplyTo) {
      const reference = rejectMessageId(inReplyTo);
      headers["In-Reply-To"] = reference;
      headers.References = reference;
    }
    if (correlationId) headers["X-MarcsMusic-Correlation-Id"] = scalar(correlationId, 256);

    const data = Object.fromEntries(
      Object.entries({ ...variables, tags: tags.slice(0, 3).map((tag) => String(tag).slice(0, 128)) })
        .filter(([key]) => /^[A-Za-z0-9_.-]{1,64}$/u.test(key))
        .map(([key, value]) => [key, scalar(value, 1_000)])
    );
    const payload = {
      to: recipient,
      from: this.fromAddress.name ? this.fromAddress : this.fromAddress.email,
      ...(this.replyTo ? { reply: this.replyTo } : {}),
      subject: normalizedSubject,
      body,
      ...(Object.keys(headers).length ? { headers } : {}),
      ...(Object.keys(data).length ? { data } : {})
    };
    const idempotencyKey = idempotencyKeyFor({
      recipient,
      subject: normalizedSubject,
      body,
      from: this.from,
      correlationId,
      messageId
    });

    const abortScope = createAbortScope({ signals: [this.signal, signal], timeoutMs: this.timeoutMs });
    try {
      const response = await this.fetch(`${this.baseUrl}/v1/send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Idempotency-Key": idempotencyKey
        },
        body: JSON.stringify(payload),
        redirect: "error",
        signal: abortScope.signal
      });
      let responseText;
      try {
        responseText = await readBoundedResponseText(response, this.maxResponseBytes);
      } catch (error) {
        if (!(error instanceof ResponseSizeLimitError)) throw error;
        throw new ApplicationError("Plunk response exceeded the configured byte limit", {
          code: "PLUNK_RESPONSE_TOO_LARGE",
          statusCode: 502,
          retryable: false,
          deliveryUnknown: true
        });
      }
      const parsed = parseJson(responseText);
      if (!response.ok || parsed?.success === false) {
        const status = Number(response.status);
        const idempotencyReused = status === 409 || parsed?.error?.code === "IDEMPOTENCY_KEY_REUSED";
        const retryable = RETRYABLE_STATUS.has(status) && !idempotencyReused;
        throw new ApplicationError(
          idempotencyReused
            ? "Plunk reports that the idempotency key was already used; reconcile the original send"
            : "Plunk rejected the message",
          {
          code: idempotencyReused ? "PLUNK_IDEMPOTENCY_REUSED" : `PLUNK_HTTP_${status || "UNKNOWN"}`,
          statusCode: 502,
          retryable,
          // A 429 is a rate limit response and is safe to retry. 5xx/408/425
          // are deliberately classified as unknown because the API may have
          // queued the message before the response was lost.
          deliveryUnknown: idempotencyReused || status === 408 || status === 425 || status >= 500,
          details: { status }
          }
        );
      }
      const id = plunkMessageId(parsed);
      if (!id) {
        throw new ApplicationError("Plunk accepted the message without a provider id", {
          code: "PLUNK_MESSAGE_ID_MISSING",
          statusCode: 502,
          retryable: false,
          deliveryUnknown: true
        });
      }
      return Object.freeze({ id, message: "Queued", provider: "plunk" });
    } catch (error) {
      if (error instanceof ApplicationError) throw error;
      throw new ApplicationError(
        abortScope.externallyAborted
          ? "Plunk request aborted during shutdown"
          : abortScope.timedOut
            ? "Plunk request timed out"
            : "Plunk network request failed",
        {
          code: abortScope.externallyAborted ? "PLUNK_ABORTED" : abortScope.timedOut ? "PLUNK_TIMEOUT" : "PLUNK_NETWORK_ERROR",
          statusCode: 502,
          retryable: false,
          deliveryUnknown: true,
          cause: error
        }
      );
    } finally {
      abortScope.cleanup();
    }
  }

  async listOutcomeEvents() {
    throw Object.assign(new Error("Plunk does not expose a provider outcome polling contract"), {
      code: "PLUNK_OUTCOME_RECONCILIATION_UNSUPPORTED",
      retryable: false
    });
  }

  async retrieveStoredMessage() {
    throw Object.assign(new Error("Plunk stored-message recovery is not configured"), {
      code: "PLUNK_STORED_MESSAGE_UNSUPPORTED",
      retryable: false
    });
  }
}

/**
 * Explicit fail-closed adapter used when the deployment has not supplied the
 * Plunk secret or fixed sender. Keeping this as a provider object means the
 * application cannot accidentally select the legacy Mailgun client.
 */
export class UnconfiguredPlunkClient {
  providerName = "plunk";

  async send() {
    throw new ApplicationError("Plunk outbound email is not configured", {
      code: "PLUNK_NOT_CONFIGURED",
      statusCode: 503,
      retryable: false,
      deliveryUnknown: false
    });
  }

  async listOutcomeEvents() {
    throw Object.assign(new Error("Plunk outcome reconciliation is not configured"), {
      code: "PLUNK_OUTCOME_RECONCILIATION_UNSUPPORTED",
      retryable: false
    });
  }

  async retrieveStoredMessage() {
    throw Object.assign(new Error("Plunk stored-message recovery is not configured"), {
      code: "PLUNK_STORED_MESSAGE_UNSUPPORTED",
      retryable: false
    });
  }
}

export function createPlunkClient(config, options) {
  return new PlunkClient(config, options);
}

function normalizeBaseUrl(value) {
  const base = requiredString(value, "baseUrl").replace(/\/+$/u, "");
  let parsed;
  try { parsed = new URL(base); } catch { throw new TypeError("Plunk baseUrl must be a valid URL"); }
  if (parsed.protocol !== "https:") throw new TypeError("Plunk baseUrl must use HTTPS");
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new TypeError("Plunk baseUrl must not contain credentials or query parameters");
  }
  return base;
}

function normalizeRecipient(value) {
  const recipient = requiredString(value, "to");
  assertEmail(recipient, "to");
  return recipient;
}

function assertEmail(value, name) {
  if (!EMAIL_PATTERN.test(value)) throw new TypeError(`${name} must be a valid email address`);
}

function assertMailbox(value, name) {
  const text = requiredString(value, name);
  if (text.length > 320 || /[\r\n]/u.test(text)) throw new TypeError(`${name} must be a valid mailbox`);
  parseMailbox(text, name);
  return text;
}

function parseMailbox(value, name) {
  const text = requiredString(value, name);
  if (text.length > 320 || /[\r\n]/u.test(text)) throw new TypeError(`${name} must be a valid mailbox`);
  const displayMatch = text.match(/^([^<>]*)<([^<>]+)>\s*$/u);
  const candidate = displayMatch ? displayMatch[2].trim() : text;
  if ((!displayMatch && /[<>]/u.test(text)) || (displayMatch && /[<>]/u.test(displayMatch[1]))) {
    throw new TypeError(`${name} must be a valid mailbox`);
  }
  assertEmail(candidate, name);
  const displayName = displayMatch?.[1].trim();
  if (displayName && displayName.length > 100) throw new TypeError(`${name} display name is too long`);
  return Object.freeze({
    email: candidate,
    ...(displayName ? { name: displayName } : {})
  });
}

function rejectHeaderInjection(value, name) {
  const text = requiredString(value, name);
  if (/[\r\n]/u.test(text)) throw new TypeError(`${name} must not contain newlines`);
  return text;
}

function rejectMessageId(value) {
  const text = requiredString(value, "messageId");
  if (!/^<[^<>\s@]+@[^<>\s]+>$/u.test(text)) throw new TypeError("messageId must be an RFC message id");
  return text;
}

function parseJson(value) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return { message: value.slice(0, 500) };
  }
}

function plunkMessageId(body) {
  const candidates = [
    body?.data?.id,
    body?.data?.emailId,
    body?.data?.email,
    body?.data?.emails?.[0]?.email,
    body?.id,
    body?.emailId
  ];
  return candidates.find((candidate) => typeof candidate === "string" && candidate.trim())?.trim();
}

function requiredString(value, name) {
  const normalized = optionalString(value);
  if (!normalized) throw new TypeError(`${name} is required`);
  return normalized;
}

function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function scalar(value, maximum) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return String(text).slice(0, maximum);
}

function idempotencyKeyFor(value) {
  // `messageId` is generated from the durable send-queue identity and remains
  // stable across delivery-attempt leases. Correlation IDs are intentionally
  // excluded from this key; a fresh attempt must not create a second Plunk
  // email after an ambiguous response.
  const material = value.messageId
    ? `message:${value.messageId}`
    : JSON.stringify({
        recipient: value.recipient,
        subject: value.subject,
        body: value.body,
        from: value.from
      });
  return `marcsmusic-${createHash("sha256").update(material).digest("hex")}`;
}

function positiveInteger(value, fallback) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw new TypeError("positive integer expected");
  return number;
}
