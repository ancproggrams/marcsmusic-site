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

function scalar(value, maximum) {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const normalized = String(value).trim();
  return normalized ? normalized.slice(0, maximum) : undefined;
}
