import { isTerminalCampaignStatus } from "../domain/campaign-state.mjs";
import { evaluateEligibility } from "../domain/eligibility-policy.mjs";
import { calculateMatchScore } from "../domain/match-score.mjs";
import { normalizeContact, normalizeDomain, normalizeEmail, normalizeOutlet, normalizeRelease } from "../domain/normalization.mjs";
import { sendAuthorizationSnapshotDigest, sendAuthorizationSnapshotVersion } from "../domain/send-authorization-snapshot.mjs";
import { errorCode } from "../errors.mjs";
import { businessDate, businessDayUtcRange } from "./date-utils.mjs";

const DEFERRED_PREFLIGHT_CODES = new Set([
  "PREVIOUS_SEQUENCE_STEP_NOT_CONFIRMED",
  "SEND_AUTHORIZATION_IDENTITY_CHANGED",
  "circuit_open",
  "circuit_state_unavailable",
  "global_send_limit_reached",
  "release_send_limit_reached",
  "domain_send_limit_reached",
  "outlet_first_send_cooldown_active"
]);
const RESPONSE_BLOCKED_MATCH_STATUSES = new Set(["Completed", "Rejected", "Unsubscribed", "Stopped"]);
const RESPONSE_BLOCKED_CONTACT_STATUSES = new Set(["Inactive", "Blocked"]);
const RESPONSE_DEFERRED_PREFLIGHT_CODES = new Set(["circuit_open", "circuit_state_unavailable"]);

export function createSendService({ espocrm, repository, contactIntakeRepository, mailgun, config, logger, metrics }) {
  async function sendOne(workerId, { signal } = {}) {
    if (config.safety.killSwitch || !config.safety.sendEnabled) {
      return Object.freeze({ processed: false, reason: "sending_disabled" });
    }
    if (signal?.aborted) return Object.freeze({ processed: false, reason: "worker_stopping" });
    const item = await repository.claimSend(workerId);
    if (!item) return Object.freeze({ processed: false, reason: "queue_empty" });
    if (signal?.aborted) {
      await repository.deferClaimedSend(item, { code: "worker_shutdown", delaySeconds: 0 });
      return Object.freeze({ processed: true, sent: false, reason: "worker_stopping" });
    }

    let correlationId;
    let capacityReserved = false;
    let providerAccepted = false;
    try {
      const authorizationIdentity = await loadAuthorizationIdentity(item);
      return await withAuthorizationFence(authorizationIdentity, async () => {
        const authorized = await authorizeSend(item, authorizationIdentity);
        if (!authorized.allowed) return authorized.result;

        const domain = normalizeDomain(authorized.contact.email?.split("@")[1]);
        const releaseLimit = authorized.release.dailySendLimit > 0
          ? authorized.release.dailySendLimit
          : config.safety.dailySendLimit;
        const approvedBusinessDate = businessDate(new Date());
        const capacity = await repository.reserveSendCapacity(item, domain, {
          dailyLimit: config.safety.dailySendLimit,
          releaseLimit,
          domainLimit: config.safety.domainDailyLimit,
          businessDate: approvedBusinessDate,
          outletCooldownDays: config.policy.outletCooldownDays
        });
        if (!capacity.allowed) {
          throw Object.assign(new Error(`Send capacity unavailable: ${capacity.reason}`), {
            code: capacity.reason,
            retryable: true
          });
        }
        capacityReserved = true;

        correlationId = await repository.beginDeliveryAttempt(item);
        let result;
        try {
          result = await mailgun.send({
            to: authorized.contact.email,
            subject: authorized.copy.subject,
            text: authorized.copy.bodyText,
            tags: ["marcsmusic-outreach", `step-${item.sequence_step}`],
            variables: {
              "outreach-match-id": item.match_id,
              "send-queue-id": item.id,
              "release-id": item.release_id,
              "contact-id": item.contact_id
            },
            correlationId,
            messageId: item.deterministic_message_id,
            signal
          });
          providerAccepted = true;
        } catch (error) {
          throw error;
        }

        const committed = await repository.markSendAccepted(item, correlationId, result.id);
        if (committed === false) {
          throw Object.assign(new Error("Provider accepted the message after the send lease was lost"), {
            code: "SEND_LEASE_LOST",
            retryable: false,
            deliveryUnknown: true
          });
        }
        capacityReserved = false;
        metrics.increment("outreach_sent_total", { sequenceStep: item.sequence_step });
        logger.info({ matchId: item.match_id, queueId: item.id, sequenceStep: item.sequence_step, correlationId }, "outreach message accepted by provider");
        return Object.freeze({ processed: true, sent: true });
      });
    } catch (error) {
      const code = errorCode(error);
      if (correlationId) {
        await repository.markSendFailure(item, correlationId, {
          code,
          retryable: Boolean(error.retryable),
          deliveryUnknown: Boolean(error.deliveryUnknown || providerAccepted || signal?.aborted)
        });
      } else if (signal?.aborted) {
        if (capacityReserved) await repository.releaseSendCapacity?.(item);
        await repository.deferClaimedSend(item, { code: "worker_shutdown", delaySeconds: 0 });
      } else if (DEFERRED_PREFLIGHT_CODES.has(code)) {
        if (capacityReserved) await repository.releaseSendCapacity?.(item);
        await repository.deferClaimedSend(item, { code, delaySeconds: preflightDelaySeconds(code) });
        metrics.increment("outreach_send_deferred_total", { code });
        logger.warn({ code, matchId: item.match_id, queueId: item.id }, "outreach send deferred before provider attempt");
      } else {
        if (capacityReserved) await repository.releaseSendCapacity?.(item);
        await repository.markPreflightFailure(item, { code, retryable: Boolean(error.retryable) });
        metrics.increment("outreach_send_preflight_failures_total", { code });
        logger.error({ err: error, matchId: item.match_id, queueId: item.id }, "outreach send preflight failed");
      }
      if (correlationId) {
        metrics.increment("outreach_send_failures_total", { code, outcome: error.deliveryUnknown || providerAccepted ? "unknown" : "definite" });
        logger.error({ err: error, matchId: item.match_id, queueId: item.id }, "outreach provider send failed");
      }
      return Object.freeze({ processed: true, sent: false, error: code });
    }
  }

  async function authorizeSend(item, authorizationIdentity) {
    // Every mutable input, including the copy envelope, is fetched only after
    // entering the distributed authorization fence. The digest below binds the
    // artifact to the exact CRM facts used when it was generated.
    const [matchRaw, releaseRaw, contactRaw, outletRaw, copy] = await Promise.all([
      espocrm.get("OutreachMatch", item.match_id),
      espocrm.get("MusicRelease", item.release_id),
      espocrm.get("MediaContact", item.contact_id),
      item.outlet_id ? espocrm.get("MediaOutlet", item.outlet_id) : undefined,
      repository.readCopyArtifact(item.copy_artifact_id)
    ]);
    if (!outletRaw || !copy) {
      throw Object.assign(new Error("A send queue item references missing authoritative data"), {
        code: "SEND_REFERENCE_MISSING",
        retryable: false
      });
    }
    if (typeof contactIntakeRepository?.getEvidenceAttestation !== "function") {
      throw Object.assign(new Error("The purpose-bound evidence attestation reader is unavailable"), {
        code: "SEND_EVIDENCE_ATTESTATION_READER_UNAVAILABLE",
        retryable: false
      });
    }
    const [contactEvidenceAttestation, outletEvidenceAttestation] = await Promise.all([
      contactIntakeRepository.getEvidenceAttestation("MediaContact", item.contact_id),
      contactIntakeRepository.getEvidenceAttestation("MediaOutlet", item.outlet_id)
    ]);
    const release = normalizeRelease(releaseRaw);
    const contact = normalizeContact({ ...contactRaw, evidenceAttestation: contactEvidenceAttestation });
    const outlet = normalizeOutlet({ ...outletRaw, evidenceAttestation: outletEvidenceAttestation });
    assertAuthorizationIdentityUnchanged(authorizationIdentity, contact, outlet);
    if (isTerminalCampaignStatus(matchRaw.campaignStatus)) {
      await repository.cancelClaimedSend(item.id, "terminal_match_state");
      await repository.cancelPendingForMatch(item.match_id, "terminal_match_state");
      return Object.freeze({
        allowed: false,
        result: Object.freeze({ processed: true, sent: false, reason: "terminal_match_state" })
      });
    }
    const requiredStatus = ["Ready", "Sent 1", "Follow-Up 1"][item.sequence_step];
    if (matchRaw.campaignStatus !== requiredStatus) {
      throw Object.assign(new Error(`Sequence step ${item.sequence_step} requires match status ${requiredStatus}`), {
        code: "PREVIOUS_SEQUENCE_STEP_NOT_CONFIRMED",
        retryable: true
      });
    }
    if (
      matchRaw.musicReleaseId !== item.release_id
      || matchRaw.mediaContactId !== item.contact_id
      || matchRaw.mediaOutletId !== item.outlet_id
      || contact.mediaOutletId !== item.outlet_id
    ) {
      return denyClaimedSend(item, "send_reference_link_changed", {
        queueBinding: {
          releaseId: item.release_id,
          contactId: item.contact_id,
          outletId: item.outlet_id
        }
      });
    }
    if (typeof repository.getClaimedSendAllocation !== "function") {
      throw Object.assign(new Error("The durable send allocation verifier is unavailable"), {
        code: "SEND_ALLOCATION_VERIFIER_UNAVAILABLE",
        retryable: false
      });
    }
    const allocation = await repository.getClaimedSendAllocation(item);
    if (
      !allocation
      || allocation.status !== "active"
      || allocation.match_id !== item.match_id
      || allocation.release_id !== item.release_id
      || allocation.contact_id !== item.contact_id
      || allocation.outlet_id !== item.outlet_id
      || matchRaw.activeSequence !== true
    ) {
      return denyClaimedSend(item, "sequence_allocation_changed", {
        activeSequence: matchRaw.activeSequence === true,
        allocationPresent: Boolean(allocation)
      });
    }
    const [suppressed, genreDenied] = await Promise.all([
      repository.isSuppressed({
        contactId: contact.id,
        outletId: outlet.id,
        email: contact.email,
        domain: outlet.domain
      }),
      repository.hasContactGenreDenial?.(contact.id, release.genres) ?? false
    ]);
    const eligibility = evaluateEligibility({
      contact,
      outlet,
      release,
      cooldownUntil: matchRaw.cooldownUntil,
      suppressed,
      genreDenied,
      maxEvidenceAgeSeconds: config.sourceIngestion.maxEvidenceAgeSeconds
    });
    if (!eligibility.eligible) {
      const reason = eligibility.reasons[0]?.code ?? "eligibility_failed";
      return denyClaimedSend(item, reason, { eligibility: eligibility.reasons });
    }
    const scoring = calculateMatchScore({ release, contact, outlet });
    const threshold = config.policy?.matchThreshold ?? 80;
    if (scoring.score < threshold) {
      return denyClaimedSend(item, "match_score_below_auto_threshold", {
        score: scoring.score,
        threshold,
        scoreReasons: scoring.reasons
      });
    }
    const currentSnapshotDigest = sendAuthorizationSnapshotDigest({
      match: matchRaw,
      release,
      contact,
      outlet
    });
    if (
      Number(copy.authorizationSnapshotVersion) !== sendAuthorizationSnapshotVersion()
      || typeof copy.authorizationSnapshotDigest !== "string"
    ) {
      return denyClaimedSend(item, "copy_authorization_snapshot_missing", {
        expectedVersion: sendAuthorizationSnapshotVersion()
      });
    }
    if (copy.authorizationSnapshotDigest !== currentSnapshotDigest) {
      return denyClaimedSend(item, "copy_authorization_snapshot_changed", {
        snapshotVersion: sendAuthorizationSnapshotVersion()
      });
    }
    return Object.freeze({ allowed: true, matchRaw, release, contact, outlet, copy });
  }

  async function denyClaimedSend(item, reason, details) {
    await repository.cancelClaimedSend(item.id, reason);
    await repository.cancelPendingForMatch(item.match_id, reason);
    await repository.enqueueWork({
      kind: "sync_stop_to_crm",
      entityType: "OutreachMatch",
      entityId: item.match_id,
      dedupeKey: `stop:${item.id}:${reason}`,
      payload: { sendQueueId: item.id, reason, details },
      priority: 15
    });
    metrics.increment("outreach_send_skipped_total", { reason });
    return Object.freeze({
      allowed: false,
      result: Object.freeze({ processed: true, sent: false, reason })
    });
  }

  async function sendResponseOne(workerId, { signal } = {}) {
    if (config.safety.killSwitch || !config.safety.sendEnabled) {
      return Object.freeze({ processed: false, reason: "sending_disabled" });
    }
    if (signal?.aborted) return Object.freeze({ processed: false, reason: "worker_stopping" });
    const item = await repository.claimResponse(workerId);
    if (!item) return Object.freeze({ processed: false, reason: "queue_empty" });
    if (signal?.aborted) {
      await repository.deferClaimedResponse(item, { code: "worker_shutdown", delaySeconds: 0 });
      return Object.freeze({ processed: true, sent: false, reason: "worker_stopping" });
    }
    let correlationId;
    let providerAccepted = false;
    try {
      const payload = repository.readResponsePayload(item);
      const authorizationIdentity = await loadAuthorizationIdentity(item);
      return await withAuthorizationFence(authorizationIdentity, async () => {
        const authorization = await authorizeResponse(item, payload, authorizationIdentity);
        if (!authorization.allowed) {
          await repository.cancelClaimedResponse(item.id, authorization.reason);
          metrics.increment("outreach_response_canceled_total", { reason: authorization.reason });
          return Object.freeze({ processed: true, sent: false, reason: authorization.reason });
        }
        const approvedBusinessDate = businessDate(new Date());
        const businessDay = businessDayUtcRange(approvedBusinessDate);
        const rateAuthorization = await repository.authorizeClaimedResponse(item, {
          globalDailyLimit: config.safety.automaticResponseDailyLimit,
          contactDailyLimit: config.safety.automaticResponseContactLimit,
          businessDate: approvedBusinessDate,
          businessDayStart: businessDay.start,
          businessDayEnd: businessDay.end
        });
        if (!rateAuthorization.allowed) {
          if (RESPONSE_DEFERRED_PREFLIGHT_CODES.has(rateAuthorization.reason)) {
            await repository.deferClaimedResponse(item, {
              code: rateAuthorization.reason,
              delaySeconds: preflightDelaySeconds(rateAuthorization.reason)
            });
            metrics.increment("outreach_response_deferred_total", { reason: rateAuthorization.reason });
            return Object.freeze({ processed: true, sent: false, reason: rateAuthorization.reason });
          }
          await repository.cancelClaimedResponse(item.id, rateAuthorization.reason);
          metrics.increment("outreach_response_canceled_total", { reason: rateAuthorization.reason });
          return Object.freeze({ processed: true, sent: false, reason: rateAuthorization.reason });
        }
        correlationId = await repository.beginResponseAttempt(item);
        const result = await mailgun.send({
          to: authorization.contact.email,
          subject: payload.subject,
          text: payload.bodyText,
          tags: ["marcsmusic-outreach", "automatic-reply"],
          variables: { "outreach-match-id": item.match_id, "response-queue-id": item.id },
          correlationId,
          messageId: item.deterministic_message_id,
          inReplyTo: payload.inReplyTo,
          signal
        });
        providerAccepted = true;
        const committed = await repository.markResponseAccepted(item, correlationId, result.id);
        if (committed === false) {
          throw Object.assign(new Error("Provider accepted the response after the queue lease was lost"), {
            code: "RESPONSE_LEASE_LOST",
            retryable: false,
            deliveryUnknown: true
          });
        }
        metrics.increment("outreach_automatic_replies_total");
        return Object.freeze({ processed: true, sent: true });
      });
    } catch (error) {
      const code = errorCode(error);
      if (correlationId) {
        await repository.markResponseFailure(item, correlationId, {
          code,
          retryable: Boolean(error.retryable),
          deliveryUnknown: Boolean(error.deliveryUnknown || providerAccepted || signal?.aborted)
        });
      } else if (signal?.aborted) {
        await repository.deferClaimedResponse(item, { code: "worker_shutdown", delaySeconds: 0 });
      } else {
        await repository.markResponsePreflightFailure(item, { code, retryable: Boolean(error.retryable) });
      }
      metrics.increment("outreach_response_failures_total", { code, phase: correlationId ? "provider" : "preflight" });
      logger.error({ err: error, matchId: item.match_id, responseQueueId: item.id }, "automatic response send failed");
      return Object.freeze({ processed: true, sent: false, error: code });
    }
  }

  async function authorizeResponse(item, payload, authorizationIdentity) {
    const [match, contactRaw, outletRaw, originatingSend] = await Promise.all([
      espocrm.get("OutreachMatch", item.match_id),
      espocrm.get("MediaContact", item.contact_id),
      item.outlet_id ? espocrm.get("MediaOutlet", item.outlet_id) : undefined,
      payload.originatingSendQueueId ? repository.getSend(payload.originatingSendQueueId) : undefined
    ]);
    const contact = normalizeContact(contactRaw);
    const outlet = outletRaw ? normalizeOutlet(outletRaw) : undefined;
    assertAuthorizationIdentityUnchanged(authorizationIdentity, contact, outlet);
    if (!originatingSend || originatingSend.status !== "sent" || originatingSend.match_id !== item.match_id) {
      return Object.freeze({ allowed: false, reason: "response_origin_not_confirmed" });
    }
    if (!contact.email || normalizeEmail(payload.to) !== contact.email) {
      return Object.freeze({ allowed: false, reason: "response_recipient_mismatch" });
    }
    if (contact.doNotContact || contact.optedOut || contact.hardBounced || RESPONSE_BLOCKED_CONTACT_STATUSES.has(contact.status)) {
      return Object.freeze({ allowed: false, reason: "response_contact_blocked" });
    }
    if (RESPONSE_BLOCKED_MATCH_STATUSES.has(match.campaignStatus)) {
      return Object.freeze({ allowed: false, reason: "response_match_blocked" });
    }
    const suppressed = await repository.isSuppressed({
      contactId: contact.id,
      outletId: outlet?.id,
      email: contact.email,
      domain: outlet?.domain
    });
    if (suppressed) return Object.freeze({ allowed: false, reason: "response_suppressed" });
    return Object.freeze({ allowed: true, contact, match, outlet });
  }

  async function loadAuthorizationIdentity(item) {
    const [contactRaw, outletRaw] = await Promise.all([
      espocrm.get("MediaContact", item.contact_id),
      item.outlet_id ? espocrm.get("MediaOutlet", item.outlet_id) : undefined
    ]);
    return identityFromRecords(contactRaw, outletRaw);
  }

  function withAuthorizationFence(identity, work) {
    if (typeof repository.withSendAuthorizationFence === "function") {
      return repository.withSendAuthorizationFence(identity, work);
    }
    if (typeof repository.withContactSendFence === "function") {
      return repository.withContactSendFence(identity.contactId, work);
    }
    throw Object.assign(new Error("The distributed send authorization fence is unavailable"), {
      code: "SEND_AUTHORIZATION_FENCE_UNAVAILABLE",
      retryable: false
    });
  }

  async function syncStopToCrm(item) {
    const match = await espocrm.get("OutreachMatch", item.entity_id);
    if (!isTerminalCampaignStatus(match.campaignStatus)) {
      await updateMatchConditional(match, {
        campaignStatus: "Stopped",
        activeSequence: false,
        stopReason: item.payload.reason
      });
    }
    await repository.releaseAllocation({
      matchId: item.entity_id,
      cooldownUntil: addDays(new Date(), config.policy.cooldownDays),
      reason: item.payload.reason
    });
    await upsertCrmEvent("Skipped", `skipped:${item.payload.sendQueueId}:${item.payload.reason}`, {
      name: `Skipped: ${item.payload.reason}`.slice(0, 180),
      outreachMatchId: item.entity_id,
      eventDate: toEspoDateTime(new Date()),
      errorCode: item.payload.reason,
      details: JSON.stringify(item.payload.details ?? {})
    });
  }

  async function updateMatchConditional(match, payload) {
    if (typeof espocrm.updateConditional === "function") {
      return espocrm.updateConditional("OutreachMatch", match.id, payload, match.versionNumber);
    }
    return espocrm.update("OutreachMatch", match.id, payload);
  }

  async function upsertCrmEvent(eventType, externalEventId, payload) {
    return espocrm.upsertByUnique("OutreachEvent", "externalEventId", externalEventId, {
      ...payload,
      eventType,
      externalEventId
    });
  }

  return Object.freeze({
    sendOne,
    sendResponseOne,
    syncStopToCrm
  });
}

function preflightDelaySeconds(code) {
  if (["PREVIOUS_SEQUENCE_STEP_NOT_CONFIRMED", "SEND_AUTHORIZATION_IDENTITY_CHANGED"].includes(code)) return 60;
  if (["circuit_open", "circuit_state_unavailable"].includes(code)) return 900;
  return 3_600;
}

function identityFromRecords(contactRaw, outletRaw) {
  const contact = normalizeContact(contactRaw);
  const outlet = outletRaw ? normalizeOutlet(outletRaw) : undefined;
  return Object.freeze({
    contactId: contact.id,
    outletId: outlet?.id,
    email: contact.email,
    domain: outlet?.domain
  });
}

function assertAuthorizationIdentityUnchanged(expected, contact, outlet) {
  if (
    expected.contactId !== contact.id ||
    expected.outletId !== outlet?.id ||
    expected.email !== contact.email ||
    expected.domain !== outlet?.domain
  ) {
    throw Object.assign(new Error("The send authorization identity changed during preflight"), {
      code: "SEND_AUTHORIZATION_IDENTITY_CHANGED",
      retryable: true
    });
  }
}

function addDays(value, days) {
  return new Date(new Date(value).getTime() + Number(days) * 24 * 60 * 60 * 1_000);
}

function toEspoDateTime(value) {
  return new Date(value).toISOString().slice(0, 19).replace("T", " ");
}
