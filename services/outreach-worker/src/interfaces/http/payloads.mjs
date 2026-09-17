import { HttpError } from "./http-error.mjs";

const MAX_MULTIPART_FIELDS = 32;

export function parseEspoEventName(value) {
  const eventName = String(value ?? "");
  if (!/^[A-Za-z][A-Za-z0-9_]*\.[A-Za-z][A-Za-z0-9_]*$/u.test(eventName)) {
    throw new HttpError(400, "ESPO_EVENT_INVALID", "Invalid webhook event.");
  }
  const [entityType] = eventName.split(".", 1);
  return Object.freeze({ eventName, entityType });
}

export function parseEspoPayload(body) {
  if (!Array.isArray(body) || body.length === 0 || body.length > 200) {
    throw new HttpError(400, "ESPO_PAYLOAD_INVALID", "Invalid webhook payload.");
  }
  if (body.some((record) => !isPlainObject(record))) {
    throw new HttpError(400, "ESPO_PAYLOAD_INVALID", "Invalid webhook payload.");
  }
  return body;
}

export async function parseMailgunRequest(request) {
  const raw = request.isMultipart() ? await readMultipartFields(request) : request.body;
  if (!isPlainObject(raw)) {
    throw new HttpError(400, "MAILGUN_PAYLOAD_INVALID", "Invalid webhook payload.");
  }

  const signatureObject = parseObject(raw.signature);
  const eventDataField = raw["event-data"] ?? raw.eventData;
  const parsedEventData = parseObject(eventDataField);
  if (eventDataField !== undefined && !parsedEventData) {
    throw new HttpError(400, "MAILGUN_EVENT_DATA_INVALID", "Invalid webhook payload.");
  }
  const eventData = parsedEventData ?? removeAuthenticationFields(raw);
  const timestamp = signatureObject?.timestamp ?? raw.timestamp;
  const token = signatureObject?.token ?? raw.token;
  const signature = signatureObject?.signature ?? raw.signature;

  if (!timestamp || !token || typeof signature !== "string") {
    throw new HttpError(401, "MAILGUN_SIGNATURE_MISSING", "Webhook authentication failed.");
  }

  return Object.freeze({
    timestamp: String(timestamp),
    token: String(token),
    signature,
    eventData
  });
}

export function parsePlunkRequest(body) {
  if (!isPlainObject(body)) {
    throw new HttpError(400, "PLUNK_PAYLOAD_INVALID", "Invalid webhook payload.");
  }
  const event = body.event && isPlainObject(body.event) ? body.event : undefined;
  const data = body.data && isPlainObject(body.data) ? body.data : undefined;
  const eventType = cleanScalar(
    body.eventType ?? body.type ?? body.name ?? event?.type ?? data?.eventType ?? data?.type ?? data?.name,
    120
  );
  const eventId = cleanScalar(
    event?.emailId ?? event?.email_id ?? event?.id ?? event?.messageId
      ?? data?.emailId ?? data?.email_id ?? data?.id ?? data?.messageId
      ?? body.id,
    500
  );
  if (!eventType || !eventId) {
    throw new HttpError(400, "PLUNK_EVENT_IDENTITY_INVALID", "Webhook event identity is required.");
  }
  return Object.freeze({ eventType, eventId });
}

function removeAuthenticationFields(raw) {
  const eventData = { ...raw };
  delete eventData.signature;
  delete eventData.timestamp;
  delete eventData.token;
  return eventData;
}

export function extractMailgunEvent(eventData, timestamp, token) {
  const eventType = cleanScalar(eventData.event ?? eventData["event"] ?? "unknown", 120);
  const providerId = cleanScalar(eventData.id ?? eventData["event-id"] ?? eventData.eventId, 500);
  const messageId = cleanScalar(
    eventData.message?.headers?.["message-id"] ??
      eventData["message-id"] ??
      eventData.MessageId,
    500
  );
  const matchId = cleanScalar(
    eventData["user-variables"]?.matchId ??
      eventData["user-variables"]?.match_id ??
      eventData["X-Mailgun-Variables"]?.matchId,
    250
  );

  return Object.freeze({
    eventType: eventType || "unknown",
    providerId,
    messageId,
    matchId,
    replayMaterial: providerId || `${messageId ?? "no-message-id"}:${eventType}:${timestamp}:${token}`
  });
}

export function readToken(body, query) {
  const candidate = body?.token ?? query?.token;
  return typeof candidate === "string" && candidate.length <= 2_048 ? candidate : "";
}

async function readMultipartFields(request) {
  const fields = Object.create(null);
  let count = 0;

  for await (const part of request.parts()) {
    if (part.type === "file") {
      // Inbound replies may contain attachments. They are deliberately never
      // persisted or parsed by this service; drain the bounded stream only.
      part.file.resume();
      continue;
    }
    count += 1;
    if (count > MAX_MULTIPART_FIELDS) {
      throw new HttpError(413, "MAILGUN_FIELDS_LIMIT", "Webhook payload is too large.");
    }
    fields[part.fieldname] = part.value;
  }

  return fields;
}

function parseObject(value) {
  if (isPlainObject(value)) return value;
  if (typeof value !== "string" || value.length > 524_288) return undefined;
  try {
    const parsed = JSON.parse(value);
    return isPlainObject(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  // fast-querystring intentionally uses a safe, null-rooted prototype rather
  // than Object.prototype. Accept that shape while rejecting class instances.
  return prototype === Object.prototype ||
    prototype === null ||
    Object.getPrototypeOf(prototype) === null;
}

function cleanScalar(value, maxLength) {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}
