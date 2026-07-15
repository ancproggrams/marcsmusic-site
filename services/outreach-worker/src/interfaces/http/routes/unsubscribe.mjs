import { verifyUnsubscribeToken } from "../../../domain/unsubscribe-token.mjs";
import { sha256 } from "../../../infrastructure/crypto-box.mjs";
import { readToken } from "../payloads.mjs";
import { sendUnsubscribeConfirmation, sendUnsubscribeInvalid, sendUnsubscribeSuccess } from "../unsubscribe-page.mjs";

export function registerUnsubscribeRoutes(server, { config, repository, metrics }) {
  server.get("/unsubscribe", async (request, reply) => {
    const token = readToken(undefined, request.query);
    const verification = verifyUnsubscribeToken(token, config.crypto.unsubscribeSigning);
    if (!verification.valid) {
      metrics.increment("outreach_unsubscribe_invalid_total");
      return sendUnsubscribeInvalid(reply);
    }
    return sendUnsubscribeConfirmation(reply, token);
  });

  server.post("/unsubscribe", async (request, reply) => {
    const token = readToken(request.body, request.query);
    const verification = verifyUnsubscribeToken(token, config.crypto.unsubscribeSigning);
    if (!verification.valid) {
      metrics.increment("outreach_unsubscribe_invalid_total");
      return sendUnsubscribeInvalid(reply);
    }
    const { contactId, matchId } = verification.data;
    await repository.suppress({ subjectType: "contact", subject: contactId, reason: "unsubscribed", source: "self_service" });
    await repository.cancelPendingForMatch(matchId, "contact_unsubscribed");
    const externalId = sha256(`unsubscribe:${token}`);
    const event = await repository.receiveEvent({
      source: "unsubscribe",
      externalId,
      eventType: "unsubscribed",
      entityType: "MediaContact",
      entityId: contactId,
      payload: { contactId, matchId, reason: "unsubscribed" },
      workKind: "process_unsubscribe_event"
    });
    metrics.increment("outreach_unsubscribe_confirmed_total", {}, event.inserted ? 1 : 0);
    return sendUnsubscribeSuccess(reply);
  });
}
