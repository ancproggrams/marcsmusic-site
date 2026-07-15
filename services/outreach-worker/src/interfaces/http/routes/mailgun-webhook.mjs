import { verifyMailgunWebhook } from "../../../domain/signatures.mjs";
import { canonicalMailgunEventId } from "../../../domain/provider-event-identity.mjs";
import { HttpError } from "../http-error.mjs";
import { extractMailgunEvent, parseMailgunRequest } from "../payloads.mjs";

export function registerMailgunWebhookRoute(server, { config, repository, metrics }) {
  server.post("/webhooks/mailgun", async (request, reply) => {
    if (!config.mailgun?.webhookSigningKey) {
      throw new HttpError(503, "MAILGUN_WEBHOOK_NOT_CONFIGURED", "Legacy Mailgun webhook authentication is not configured.");
    }
    const payload = await parseMailgunRequest(request);
    const verification = verifyMailgunWebhook({
      timestamp: payload.timestamp,
      token: payload.token,
      signature: payload.signature,
      signingKey: config.mailgun.webhookSigningKey
    });
    if (!verification.valid) {
      metrics.increment("outreach_webhook_rejected_total", { source: "mailgun", reason: verification.reason });
      request.log.warn({ reason: verification.reason, requestId: request.id }, "mailgun_webhook_rejected");
      throw new HttpError(401, "MAILGUN_SIGNATURE_INVALID", "Webhook authentication failed.");
    }
    const event = extractMailgunEvent(payload.eventData, payload.timestamp, payload.token);
    // Authentication happens before canonical identity is derived. The
    // provider event id lets webhook and recovery polling converge on the same
    // encrypted inbox row; timestamp/token remains the legacy fallback.
    const externalId = canonicalMailgunEventId(payload.eventData, payload);
    const immediateCircuitReason = String(event.eventType).toLowerCase() === "complained"
      ? `signed_mailgun_complaint:${externalId}`
      : undefined;
    const result = await repository.receiveEvent({
      source: "mailgun",
      externalId,
      eventType: event.eventType,
      entityType: "MailgunEvent",
      entityId: event.providerId ?? event.messageId ?? externalId,
      payload: payload.eventData,
      workKind: "process_mailgun_event",
      priority: immediateCircuitReason ? 0 : 5,
      openCircuitReason: immediateCircuitReason
    });
    metrics.increment("outreach_webhook_received_total", { source: "mailgun" }, result.inserted ? 1 : 0);
    metrics.increment("outreach_webhook_duplicate_total", { source: "mailgun" }, result.inserted ? 0 : 1);
    return reply.code(202).send({ accepted: true, queued: result.inserted });
  });
}
