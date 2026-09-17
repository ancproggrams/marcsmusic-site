import { verifyPlunkWebhook } from "../../../domain/signatures.mjs";
import { canonicalPlunkEventId } from "../../../domain/provider-event-identity.mjs";
import { HttpError } from "../http-error.mjs";
import { parsePlunkRequest } from "../payloads.mjs";

/**
 * Plunk workflow webhooks use an explicit Bearer shared secret configured in
 * the Plunk workflow step. Authentication happens before event identity is
 * derived or any payload is persisted.
 */
export function registerPlunkWebhookRoute(server, { config, repository, metrics }) {
  if (!config?.plunk?.webhookSecret) return;
  server.post("/webhooks/plunk", async (request, reply) => {
    const verification = verifyPlunkWebhook({
      authorization: request.headers.authorization,
      sharedSecret: config.plunk.webhookSecret
    });
    if (!verification.valid) {
      metrics.increment("outreach_webhook_rejected_total", { source: "plunk", reason: verification.reason });
      request.log.warn({ reason: verification.reason, requestId: request.id }, "plunk_webhook_rejected");
      throw new HttpError(401, "PLUNK_WEBHOOK_AUTH_INVALID", "Webhook authentication failed.");
    }
    const event = parsePlunkRequest(request.body);
    const externalId = canonicalPlunkEventId(request.body);
    const eventType = event.eventType;
    const immediateCircuitReason = eventType === "email.complaint"
      ? `signed_plunk_complaint:${externalId}`
      : undefined;
    const result = await repository.receiveEvent({
      source: "plunk",
      externalId,
      eventType,
      entityType: "PlunkEvent",
      entityId: event.eventId,
      payload: request.body,
      workKind: "process_plunk_event",
      priority: immediateCircuitReason ? 0 : 5,
      openCircuitReason: immediateCircuitReason
    });
    metrics.increment("outreach_webhook_received_total", { source: "plunk" }, result.inserted ? 1 : 0);
    metrics.increment("outreach_webhook_duplicate_total", { source: "plunk" }, result.inserted ? 0 : 1);
    return reply.code(202).send({ accepted: true, queued: result.inserted });
  });
}
