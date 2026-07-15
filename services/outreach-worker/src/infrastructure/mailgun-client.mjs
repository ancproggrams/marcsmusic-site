import { ApplicationError } from "../errors.mjs";
import { createAbortScope } from "./abort-signal.mjs";
import { readBoundedResponseText, ResponseSizeLimitError } from "./bounded-response.mjs";

const MAX_RESPONSE_BYTES = 64 * 1_024;
const MAX_LOG_RESPONSE_BYTES = 2 * 1_024 * 1_024;
const MAX_STORED_MESSAGE_BYTES = 1 * 1_024 * 1_024;
const OUTREACH_TAG = "marcsmusic-outreach";
const OUTCOME_EVENTS = Object.freeze([
  "accepted",
  "delivered",
  "failed",
  "complained",
  "unsubscribed",
  "stored"
]);
const STORAGE_API_HOSTS = new Set([
  "api.mailgun.net",
  "api.eu.mailgun.net",
  "storage-us-east4.api.mailgun.net",
  "storage-us-west1.api.mailgun.net",
  "storage-europe-west1.api.mailgun.net"
]);
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export class MailgunClient {
  constructor(config, options = {}) {
    this.config = config;
    this.fetch = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.signal = options.signal;
  }

  async send({ to, subject, text, tags = [], variables = {}, correlationId, messageId, inReplyTo, signal }) {
    const form = new FormData();
    form.set("from", this.config.from);
    form.set("to", to);
    form.set("subject", rejectHeaderInjection(subject));
    form.set("text", text);
    form.set("h:Reply-To", this.config.replyTo);
    if (messageId) form.set("h:Message-Id", rejectMessageId(messageId));
    if (inReplyTo) {
      const reference = rejectMessageId(inReplyTo);
      form.set("h:In-Reply-To", reference);
      form.set("h:References", reference);
    }
    form.set("o:tracking", "no");
    form.set("o:tracking-clicks", "no");
    form.set("o:tracking-opens", "no");
    form.set("v:correlation-id", correlationId);
    for (const tag of tags.slice(0, 3)) form.append("o:tag", String(tag).slice(0, 128));
    for (const [key, value] of Object.entries(variables)) form.set(`v:${key}`, String(value).slice(0, 1_000));

    const abortScope = createAbortScope({ signals: [this.signal, signal], timeoutMs: this.timeoutMs });
    try {
      const response = await this.fetch(`${this.config.baseUrl}/v3/${encodeURIComponent(this.config.domain)}/messages`, {
        method: "POST",
        headers: { Authorization: `Basic ${Buffer.from(`api:${this.config.apiKey}`).toString("base64")}` },
        body: form,
        signal: abortScope.signal
      });
      let responseText;
      try {
        responseText = await readBoundedResponseText(response, MAX_RESPONSE_BYTES);
      } catch (error) {
        if (!(error instanceof ResponseSizeLimitError)) throw error;
        throw new ApplicationError("Mailgun response exceeded the configured byte limit", {
          code: "MAILGUN_RESPONSE_TOO_LARGE",
          statusCode: 502,
          retryable: false,
          deliveryUnknown: true
        });
      }
      let body;
      try {
        body = responseText ? JSON.parse(responseText) : {};
      } catch {
        body = { message: responseText.slice(0, 500) };
      }
      if (!response.ok) {
        const deliveryUnknown = response.status === 408 || response.status === 425 || response.status >= 500;
        throw new ApplicationError("Mailgun rejected the message", {
          code: `MAILGUN_HTTP_${response.status}`,
          statusCode: 502,
          retryable: response.status === 429,
          deliveryUnknown,
          details: { status: response.status }
        });
      }
      if (!body.id) {
        throw new ApplicationError("Mailgun accepted without a message id", {
          code: "MAILGUN_MESSAGE_ID_MISSING",
          statusCode: 502,
          deliveryUnknown: true
        });
      }
      return Object.freeze({ id: String(body.id), message: String(body.message ?? "Queued") });
    } catch (error) {
      if (error instanceof ApplicationError) throw error;
      throw new ApplicationError(abortScope.externallyAborted ? "Mailgun request aborted during shutdown" : abortScope.timedOut ? "Mailgun request timed out" : "Mailgun network request failed", {
        code: abortScope.externallyAborted ? "MAILGUN_ABORTED" : abortScope.timedOut ? "MAILGUN_TIMEOUT" : "MAILGUN_NETWORK_ERROR",
        statusCode: 502,
        deliveryUnknown: true,
        cause: error
      });
    } finally {
      abortScope.cleanup();
    }
  }

  async listOutcomeEvents({
    from,
    to,
    pageToken,
    pageSize = 100,
    mode = "logs",
    signal
  }) {
    const window = outcomeWindow(from, to);
    const limit = integerBetween(pageSize, 1, 300, "MAILGUN_OUTCOME_PAGE_SIZE_INVALID");
    const token = pageToken === undefined || pageToken === null || pageToken === ""
      ? undefined
      : validateOpaqueToken(pageToken);
    if (mode === "events") {
      return this.#listLegacyEvents({ ...window, pageToken: token, pageSize: limit, signal });
    }
    if (mode !== "logs") throw permanentError("MAILGUN_OUTCOME_MODE_INVALID");
    return this.#listLogs({ ...window, pageToken: token, pageSize: limit, signal });
  }

  async retrieveStoredMessage(event, { signal } = {}) {
    if (!event || String(event.event).toLowerCase() !== "stored") {
      throw permanentError("MAILGUN_STORAGE_EVENT_INVALID");
    }
    const reference = storageReference(event.storage, this.config);
    const body = await this.#requestJson(reference.url, {
      method: "GET",
      headers: {
        Authorization: authorization(this.config.apiKey),
        Accept: "application/json"
      },
      redirect: "error"
    }, {
      signal,
      maximumBytes: this.config.outcomeReconcile?.storageMaxResponseBytes ?? MAX_STORED_MESSAGE_BYTES,
      operation: "STORAGE"
    });
    return normalizeStoredMessage(body, event, reference.storageKey);
  }

  async #listLogs({ from, to, pageToken, pageSize, signal }) {
    const body = {
      start: from.toUTCString(),
      end: to.toUTCString(),
      events: OUTCOME_EVENTS,
      filter: {
        AND: [
          filter("domain", this.config.domain),
          filter("tag", OUTREACH_TAG)
        ]
      },
      include_subaccounts: false,
      include_totals: false,
      pagination: {
        sort: "timestamp:asc",
        limit: pageSize,
        ...(pageToken ? { token: pageToken } : {})
      }
    };
    const response = await this.#requestJson(`${this.config.baseUrl}/v1/analytics/logs`, {
      method: "POST",
      headers: {
        Authorization: authorization(this.config.apiKey),
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(body),
      redirect: "error"
    }, {
      signal,
      maximumBytes: this.config.outcomeReconcile?.maxResponseBytes ?? MAX_LOG_RESPONSE_BYTES,
      operation: "LOGS"
    });
    if (!Array.isArray(response.items) || !isPlainObject(response.pagination)) {
      throw permanentError("MAILGUN_LOGS_RESPONSE_INVALID");
    }
    const normalized = normalizeOutcomeEvents(response.items, this.config.domain);
    return Object.freeze({
      events: Object.freeze(normalized.events),
      rejected: normalized.rejected,
      nextPageToken: optionalOpaqueToken(response.pagination.next)
    });
  }

  async #listLegacyEvents({ from, to, pageToken, pageSize, signal }) {
    let url;
    if (pageToken) {
      url = `${this.config.baseUrl}/v3/${encodeURIComponent(this.config.domain)}/events/${encodeURIComponent(pageToken)}`;
    } else {
      const query = new URLSearchParams({
        begin: String(Math.floor(from.getTime() / 1_000)),
        end: String(Math.floor(to.getTime() / 1_000)),
        ascending: "yes",
        limit: String(pageSize),
        tags: OUTREACH_TAG
      });
      for (const eventName of OUTCOME_EVENTS) query.append("event", eventName);
      url = `${this.config.baseUrl}/v3/${encodeURIComponent(this.config.domain)}/events?${query.toString()}`;
    }
    const response = await this.#requestJson(url, {
      method: "GET",
      headers: { Authorization: authorization(this.config.apiKey), Accept: "application/json" },
      redirect: "error"
    }, {
      signal,
      maximumBytes: this.config.outcomeReconcile?.maxResponseBytes ?? MAX_LOG_RESPONSE_BYTES,
      operation: "EVENTS"
    });
    if (!Array.isArray(response.items) || !isPlainObject(response.paging)) {
      throw permanentError("MAILGUN_EVENTS_RESPONSE_INVALID");
    }
    const normalized = normalizeOutcomeEvents(response.items, this.config.domain);
    return Object.freeze({
      events: Object.freeze(normalized.events),
      rejected: normalized.rejected,
      nextPageToken: legacyNextToken(response.paging.next, this.config)
    });
  }

  async #requestJson(url, init, { signal, maximumBytes, operation }) {
    const abortScope = createAbortScope({ signals: [this.signal, signal], timeoutMs: this.timeoutMs });
    try {
      const response = await this.fetch(url, { ...init, signal: abortScope.signal });
      let responseText;
      try {
        responseText = await readBoundedResponseText(response, maximumBytes);
      } catch (error) {
        if (!(error instanceof ResponseSizeLimitError)) throw error;
        throw new ApplicationError("Mailgun recovery response exceeded its byte limit", {
          code: `MAILGUN_${operation}_RESPONSE_TOO_LARGE`,
          statusCode: 502,
          retryable: false
        });
      }
      if (!response.ok) {
        throw new ApplicationError("Mailgun recovery request failed", {
          code: `MAILGUN_${operation}_HTTP_${response.status}`,
          statusCode: 502,
          retryable: RETRYABLE_STATUS.has(response.status),
          details: { status: response.status }
        });
      }
      try {
        const parsed = JSON.parse(responseText || "{}");
        if (!isPlainObject(parsed)) throw new Error("response_not_object");
        return parsed;
      } catch (error) {
        throw new ApplicationError("Mailgun recovery response was not valid JSON", {
          code: `MAILGUN_${operation}_RESPONSE_INVALID`,
          statusCode: 502,
          retryable: false,
          cause: error
        });
      }
    } catch (error) {
      if (error instanceof ApplicationError) throw error;
      throw new ApplicationError(
        abortScope.externallyAborted
          ? "Mailgun recovery request aborted during shutdown"
          : abortScope.timedOut
            ? "Mailgun recovery request timed out"
            : "Mailgun recovery network request failed",
        {
          code: abortScope.externallyAborted
            ? `MAILGUN_${operation}_ABORTED`
            : abortScope.timedOut
              ? `MAILGUN_${operation}_TIMEOUT`
              : `MAILGUN_${operation}_NETWORK_ERROR`,
          statusCode: 502,
          retryable: !abortScope.externallyAborted,
          cause: error
        }
      );
    } finally {
      abortScope.cleanup();
    }
  }
}

function normalizeOutcomeEvents(items, configuredDomain) {
  const events = [];
  let rejected = 0;
  for (const item of items) {
    const normalized = normalizeOutcomeEvent(item, configuredDomain);
    if (normalized) events.push(normalized);
    else rejected += 1;
  }
  events.sort(compareOutcomeEvents);
  return Object.freeze({ events, rejected });
}

function normalizeOutcomeEvent(item, configuredDomain) {
  if (!isPlainObject(item)) return undefined;
  const event = String(item.event ?? "").trim().toLowerCase();
  const id = scalar(item.id ?? item["event-id"] ?? item.eventId, 500);
  const timestamp = providerTimestamp(item["@timestamp"] ?? item.timestamp);
  const domain = scalar(item.domain?.name ?? item.domain, 253)?.toLowerCase();
  const tags = Array.isArray(item.tags) ? item.tags.map((tag) => String(tag)) : [];
  if (!OUTCOME_EVENTS.includes(event) || !id || !timestamp) return undefined;
  if (domain !== String(configuredDomain).toLowerCase() || !tags.includes(OUTREACH_TAG)) return undefined;
  const variables = parseVariables(item["user-variables"]);
  const message = normalizeMessage(item.message);
  const storage = normalizeStorage(item.storage);
  return Object.freeze({
    ...item,
    id,
    event,
    timestamp: timestamp.getTime() / 1_000,
    "@timestamp": timestamp.toISOString(),
    domain: Object.freeze({ name: domain }),
    tags: Object.freeze(tags.slice(0, 20)),
    "user-variables": variables,
    ...(message ? { message } : {}),
    ...(storage ? { storage } : {})
  });
}

function normalizeMessage(value) {
  if (!isPlainObject(value)) return undefined;
  const headers = isPlainObject(value.headers)
    ? Object.fromEntries(Object.entries(value.headers).slice(0, 64).map(([key, header]) => [String(key).toLowerCase(), scalar(header, 2_000)]))
    : {};
  return Object.freeze({ ...value, headers: Object.freeze(headers) });
}

function normalizeStorage(value) {
  if (!isPlainObject(value)) return undefined;
  const key = scalar(value.key, 2_048);
  const url = scalar(value.url, 4_096);
  return key || url ? Object.freeze({ ...(key ? { key } : {}), ...(url ? { url } : {}) }) : undefined;
}

function normalizeStoredMessage(body, event, storageKey) {
  const headers = parseStoredHeaders(body["message-headers"] ?? body["Message-Headers"]);
  const inReplyTo = scalar(
    body["In-Reply-To"] ?? body["in-reply-to"] ?? headers["in-reply-to"],
    500
  );
  const messageId = scalar(
    body["Message-Id"] ?? body["message-id"] ?? headers["message-id"],
    500
  );
  return Object.freeze({
    event: "inbound",
    id: event.id,
    timestamp: event.timestamp,
    domain: event.domain,
    tags: event.tags,
    sender: scalar(body.sender ?? body.from ?? body.From, 500),
    from: scalar(body.from ?? body.From ?? body.sender, 500),
    subject: scalar(body.subject ?? body.Subject ?? headers.subject, 1_000),
    "body-plain": scalar(body["body-plain"] ?? body["stripped-text"] ?? body.body, 524_288),
    "stripped-text": scalar(body["stripped-text"], 524_288),
    ...(inReplyTo ? { "In-Reply-To": inReplyTo } : {}),
    ...(messageId ? { "Message-Id": messageId } : {}),
    message: Object.freeze({ headers: Object.freeze(headers) }),
    // Bind retrieval evidence without persisting the provider URL.
    storage: Object.freeze({ key: storageKey })
  });
}

function parseStoredHeaders(value) {
  let headers = value;
  if (typeof value === "string" && value.length <= 131_072) {
    try { headers = JSON.parse(value); } catch { headers = undefined; }
  }
  const result = {};
  if (Array.isArray(headers)) {
    for (const pair of headers.slice(0, 128)) {
      if (!Array.isArray(pair) || pair.length < 2) continue;
      const name = String(pair[0]).trim().toLowerCase();
      if (/^[a-z0-9-]{1,80}$/u.test(name)) result[name] = scalar(pair[1], 2_000);
    }
  } else if (isPlainObject(headers)) {
    for (const [nameRaw, valueRaw] of Object.entries(headers).slice(0, 128)) {
      const name = String(nameRaw).trim().toLowerCase();
      if (/^[a-z0-9-]{1,80}$/u.test(name)) result[name] = scalar(valueRaw, 2_000);
    }
  }
  return result;
}

function storageReference(storage, config) {
  if (!isPlainObject(storage)) throw permanentError("MAILGUN_STORAGE_REFERENCE_MISSING");
  const configuredDomain = String(config.domain).toLowerCase();
  const suppliedKey = scalar(storage.key, 2_048);
  let url;
  if (storage.url) {
    try { url = new URL(String(storage.url)); } catch { throw permanentError("MAILGUN_STORAGE_URL_INVALID"); }
    if (
      url.protocol !== "https:"
      || url.port
      || url.username
      || url.password
      || url.search
      || url.hash
      || !STORAGE_API_HOSTS.has(url.hostname)
    ) throw permanentError("MAILGUN_STORAGE_URL_REJECTED");
    const segments = url.pathname.split("/").filter(Boolean).map(safeDecode);
    if (
      segments.length !== 5
      || segments[0] !== "v3"
      || segments[1] !== "domains"
      || String(segments[2]).toLowerCase() !== configuredDomain
      || segments[3] !== "messages"
      || !segments[4]
    ) throw permanentError("MAILGUN_STORAGE_PATH_REJECTED");
    const pathKey = validateStorageKey(segments[4]);
    if (suppliedKey && suppliedKey !== pathKey) {
      throw permanentError("MAILGUN_STORAGE_KEY_MISMATCH");
    }
    return Object.freeze({ url: url.toString(), storageKey: pathKey });
  }
  if (!suppliedKey) throw permanentError("MAILGUN_STORAGE_REFERENCE_MISSING");
  const storageKey = validateStorageKey(suppliedKey);
  url = new URL(`${config.baseUrl}/v3/domains/${encodeURIComponent(config.domain)}/messages/${encodeURIComponent(storageKey)}`);
  return Object.freeze({ url: url.toString(), storageKey });
}

function legacyNextToken(value, config) {
  if (!value) return undefined;
  let next;
  try { next = new URL(String(value)); } catch { throw permanentError("MAILGUN_EVENTS_NEXT_URL_INVALID"); }
  const base = new URL(config.baseUrl);
  if (
    next.origin !== base.origin
    || next.username
    || next.password
    || next.search
    || next.hash
  ) throw permanentError("MAILGUN_EVENTS_NEXT_URL_REJECTED");
  const segments = next.pathname.split("/").filter(Boolean).map(safeDecode);
  if (
    segments.length !== 4
    || segments[0] !== "v3"
    || String(segments[1]).toLowerCase() !== String(config.domain).toLowerCase()
    || segments[2] !== "events"
  ) throw permanentError("MAILGUN_EVENTS_NEXT_PATH_REJECTED");
  return validateOpaqueToken(segments[3]);
}

function outcomeWindow(from, to) {
  const lower = from instanceof Date ? new Date(from) : new Date(from);
  const upper = to instanceof Date ? new Date(to) : new Date(to);
  if (!Number.isFinite(lower.getTime()) || !Number.isFinite(upper.getTime()) || upper < lower) {
    throw permanentError("MAILGUN_OUTCOME_WINDOW_INVALID");
  }
  return Object.freeze({ from: lower, to: upper });
}

function filter(attribute, value) {
  return Object.freeze({
    attribute,
    comparator: "=",
    values: Object.freeze([Object.freeze({ label: value, value })])
  });
}

function authorization(apiKey) {
  return `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`;
}

function providerTimestamp(value) {
  const numeric = Number(value);
  const date = Number.isFinite(numeric) && numeric > 0
    ? new Date(numeric < 10_000_000_000 ? numeric * 1_000 : numeric)
    : new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

function compareOutcomeEvents(left, right) {
  return left.timestamp - right.timestamp || left.id.localeCompare(right.id);
}

function parseVariables(value) {
  if (isPlainObject(value)) return Object.freeze({ ...value });
  if (typeof value !== "string" || value.length > 65_536) return Object.freeze({});
  try {
    const parsed = JSON.parse(value);
    return isPlainObject(parsed) ? Object.freeze({ ...parsed }) : Object.freeze({});
  } catch {
    return Object.freeze({});
  }
}

function validateOpaqueToken(value) {
  const token = String(value ?? "");
  if (!/^[A-Za-z0-9._~+/=%-]{1,2048}$/u.test(token)) throw permanentError("MAILGUN_PAGE_TOKEN_INVALID");
  return token;
}

function optionalOpaqueToken(value) {
  return value ? validateOpaqueToken(value) : undefined;
}

function integerBetween(value, minimum, maximum, code) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) throw permanentError(code);
  return number;
}

function scalar(value, maximum) {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const normalized = String(value).trim();
  return normalized ? normalized.slice(0, maximum) : undefined;
}

function safeDecode(value) {
  try { return decodeURIComponent(value); } catch { throw permanentError("MAILGUN_URL_ENCODING_INVALID"); }
}

function validateStorageKey(value) {
  const key = String(value ?? "");
  if (!/^[A-Za-z0-9._~+/=-]{1,2048}$/u.test(key)) throw permanentError("MAILGUN_STORAGE_KEY_INVALID");
  return key;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function permanentError(code) {
  return Object.assign(new Error(code), { code, retryable: false });
}

function rejectHeaderInjection(value) {
  const text = String(value ?? "").trim();
  if (!text || /[\r\n]/u.test(text)) throw new TypeError("Invalid mail subject");
  return text;
}

function rejectMessageId(value) {
  const text = String(value ?? "").trim();
  if (!/^<[^<>\s@]+@[^<>\s@]+>$/u.test(text)) throw new TypeError("Invalid message id");
  return text;
}
