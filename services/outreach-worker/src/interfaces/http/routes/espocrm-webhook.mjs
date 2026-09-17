import { verifyEspoWebhook } from "../../../domain/signatures.mjs";
import { canonicalEspoEventId } from "../../../domain/provider-event-identity.mjs";
import { sha256 } from "../../../infrastructure/crypto-box.mjs";
import { HttpError } from "../http-error.mjs";
import { parseEspoEventName, parseEspoPayload } from "../payloads.mjs";

export function registerEspoWebhookRoute(server, { config, repository, metrics }) {
  server.post("/webhooks/espocrm/:event", async (request, reply) => {
    if (!Buffer.isBuffer(request.rawBody)) throw new HttpError(415, "ESPO_CONTENT_TYPE_INVALID", "The webhook must use application/json.");
    const verification = verifyEspoWebhook({
      rawBody: request.rawBody,
      signature: firstHeader(request.headers.signature ?? request.headers["x-espo-signature"]),
      secrets: config.espocrm.webhookSecrets
    });
    if (!verification.valid) {
      metrics.increment("outreach_webhook_rejected_total", { source: "espocrm", reason: verification.reason });
      request.log.warn({ reason: verification.reason, requestId: request.id }, "espocrm_webhook_rejected");
      throw new HttpError(401, "ESPO_SIGNATURE_INVALID", "Webhook authentication failed.");
    }

    const { eventName, entityType } = parseEspoEventName(request.params.event);
    const records = parseEspoPayload(request.body);
    const bodyDigest = sha256(request.rawBody.toString("utf8"));
    let inserted = 0;
    for (const [index, record] of records.entries()) {
      const externalId = canonicalEspoEventId({
        eventName,
        record,
        webhookId: verification.webhookId,
        bodyDigest,
        index
      });
      const immediateCircuitReason = confirmedUnauthorizedCircuitReason(entityType, record, externalId);
      const result = await repository.receiveEvent({
        source: "espocrm",
        externalId,
        eventType: eventName,
        entityType,
        entityId: scalarId(record.id) ?? externalId,
        payload: { event: eventName, record },
        workKind: "process_espocrm_event",
        priority: immediateCircuitReason ? 0 : 10,
        openCircuitReason: immediateCircuitReason
      });
      if (result.inserted) inserted += 1;
    }
    metrics.increment("outreach_webhook_received_total", { source: "espocrm" }, inserted);
    metrics.increment("outreach_webhook_duplicate_total", { source: "espocrm" }, records.length - inserted);
    return reply.code(202).send({ accepted: records.length, queued: inserted });
  });
}

function confirmedUnauthorizedCircuitReason(entityType, record, externalId) {
  if (entityType !== "OutreachEvent") return undefined;
  const normalized = String(record.eventType ?? record.type ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "");
  return normalized === "unauthorized_recipient_confirmed"
    ? `confirmed_unauthorized_recipient:${externalId}`
    : undefined;
}

function firstHeader(value) {
  return Array.isArray(value) ? value[0] : value;
}

function scalarId(value) {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const normalized = String(value).trim();
  return normalized ? normalized.slice(0, 250) : undefined;
}
