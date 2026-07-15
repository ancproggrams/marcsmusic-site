import { sha256 } from "../infrastructure/crypto-box.mjs";

export function canonicalMailgunEventId(eventData, { timestamp, token } = {}) {
  const providerId = scalar(
    eventData?.id ?? eventData?.["event-id"] ?? eventData?.eventId,
    500
  );
  return providerId
    ? sha256(`mailgun:event:${providerId}`)
    : sha256(`mailgun:webhook:${scalar(timestamp, 100) ?? ""}:${scalar(token, 500) ?? ""}`);
}

export function canonicalEspoEventId({ eventName, record, webhookId, bodyDigest, index = 0 }) {
  const recordId = scalar(record?.id, 250);
  if (eventName === "Email.created" && recordId) {
    return sha256(`espocrm:Email.created:${recordId}`);
  }
  return sha256(`espocrm:webhook:${scalar(webhookId, 250) ?? ""}:${bodyDigest}:${index}`);
}

export function canonicalPlunkEventId(payload) {
  const event = payload?.event && typeof payload.event === "object"
    ? payload.event
    : payload?.data && typeof payload.data === "object"
      ? payload.data
      : payload;
  const providerId = scalar(
    event?.emailId ?? event?.email_id ?? event?.id ?? event?.messageId ?? payload?.id,
    500
  );
  const eventType = scalar(
    payload?.eventType
      ?? payload?.type
      ?? payload?.name
      ?? payload?.event?.type
      ?? payload?.data?.eventType
      ?? payload?.data?.type
      ?? payload?.data?.name,
    120
  ) ?? "unknown";
  return providerId
    ? sha256(`plunk:event:${eventType}:${providerId}`)
    : sha256(`plunk:webhook:${eventType}:${JSON.stringify(payload).slice(0, 524_288)}`);
}

function scalar(value, maximum) {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const normalized = String(value).trim();
  return normalized ? normalized.slice(0, maximum) : undefined;
}
