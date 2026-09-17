import { isTerminalCampaignStatus } from "../domain/campaign-state.mjs";
import { normalizeContact, normalizeEmail, normalizeOutlet, normalizeRelease } from "../domain/normalization.mjs";
import { createCrmTargetProjectionService } from "./crm-target-projection-service.mjs";

const POSITIVE_CLASSIFICATIONS = new Set([
  "Interested",
  "Send MP3/WAV",
  "Send Clean Version",
  "Placement Confirmed",
  "Will Consider"
]);

const OPPORTUNITY_INTEREST_RANK = Object.freeze({
  Warm: 1,
  Interested: 2,
  "Asset Requested": 3,
  "Placement Confirmed": 4
});

const ESPO_GENRES = Object.freeze([
  "Ambient",
  "Dance",
  "Electronic",
  "Hip Hop",
  "Indie",
  "Latin",
  "Pop",
  "Reggae",
  "Rock",
  "World",
  "Other"
]);
const ESPO_GENRE_BY_NORMALIZED = new Map(ESPO_GENRES.map((genre) => [genre.toLowerCase(), genre]));

/**
 * Projects authoritative PostgreSQL outcomes to EspoCRM. All creates use
 * deterministic database-enforced keys; retries may repeat every operation.
 */
export function createCrmProjectionService({ espocrm, repository, config, logger, metrics }) {
  const { ensureTargetProjection } = createCrmTargetProjectionService({ espocrm, repository, metrics });

  async function syncDeliveryToCrm(item) {
    const sendQueueId = requiredText(item.payload?.sendQueueId, "CRM_SEND_QUEUE_ID_MISSING");
    const projection = await repository.beginCrmDeliveryProjection?.(sendQueueId);
    if (!projection) throw permanentError("CRM_DELIVERY_PROJECTION_STATE_MISSING");
    if (projection.status === "completed") return projection;

    const queueItem = await repository.getSend(sendQueueId);
    assertConfirmedDelivery(queueItem, projection, item);
    const [match, releaseRaw, contactRaw, outletRaw, copy] = await Promise.all([
      espocrm.get("OutreachMatch", projection.match_id),
      espocrm.get("MusicRelease", projection.release_id),
      espocrm.get("MediaContact", projection.contact_id),
      projection.outlet_id ? espocrm.get("MediaOutlet", projection.outlet_id) : undefined,
      repository.readCopyArtifact(queueItem.copy_artifact_id)
    ]);
    if (!copy || !outletRaw) throw permanentError("CRM_DELIVERY_REFERENCE_MISSING");
    assertEntityIdentity({ match, releaseRaw, contactRaw, outletRaw, queueItem });

    const release = normalizeRelease(releaseRaw);
    const contact = normalizeContact(contactRaw);
    const outlet = normalizeOutlet(outletRaw);
    if (!contact.email) throw permanentError("CRM_DELIVERY_RECIPIENT_INVALID");
    const targetProjection = await ensureTargetProjection({
      release,
      projectedAt: projection.accepted_at,
      candidate: { contact, outlet }
    });
    const { campaign } = targetProjection;
    const email = await upsertSentEmail({
      projectionKey: projection.email_projection_key,
      subject: copy.subject,
      bodyText: copy.bodyText,
      sentAt: projection.accepted_at,
      providerMessageId: projection.provider_message_id,
      deterministicMessageId: projection.deterministic_message_id,
      correlationId: projection.correlation_id,
      match,
      release,
      contact,
      outlet,
      campaign
    });
    const event = await espocrm.upsertByUnique(
      "OutreachEvent",
      "externalEventId",
      projection.event_projection_key,
      {
        name: `Sent sequence step ${Number(queueItem.sequence_step)}`.slice(0, 180),
        outreachMatchId: match.id,
        musicReleaseId: release.id,
        mediaContactId: contact.id,
        mediaOutletId: outlet.id,
        campaignId: campaign.id,
        emailId: email.id,
        eventType: "Sent",
        eventDate: toEspoDateTime(projection.accepted_at),
        messageId: projection.deterministic_message_id,
        providerMessageId: projection.provider_message_id,
        correlationId: projection.correlation_id,
        externalEventId: projection.event_projection_key,
        subject: safeHeader(copy.subject, "Outreach message"),
        templateVersion: safeVersion(copy.templateVersion, "CRM_COPY_TEMPLATE_VERSION_MISSING"),
        aiPromptVersion: optionalVersion(copy.promptVersion),
        details: JSON.stringify({
          sendQueueId,
          sequenceStep: Number(queueItem.sequence_step),
          projectionVersion: 1,
          targetListId: targetProjection.targetList.id,
          targetListStatus: targetProjection.eligibility.eligible ? "included" : "excluded",
          targetListMembershipCount: targetProjection.membershipCount,
          targetListEligibilityReasons: targetProjection.eligibility.reasons.map(({ code }) => code)
        })
      }
    );
    await transitionMatchAfterDelivery({ match, campaign, queueItem, acceptedAt: projection.accepted_at });
    const completed = await repository.completeCrmDeliveryProjection({
      sendQueueId,
      campaignId: campaign.id,
      emailId: email.id,
      eventId: event.id
    });
    metrics.increment("outreach_crm_projections_total", { kind: "delivery", outcome: "completed" });
    return completed;
  }

  async function syncResponseToCrm(item) {
    const responseQueueId = requiredText(item.payload?.responseQueueId, "CRM_RESPONSE_QUEUE_ID_MISSING");
    const queueItem = await repository.getResponse?.(responseQueueId);
    if (!queueItem || queueItem.status !== "sent" || !queueItem.provider_message_id || !queueItem.sent_at) {
      throw permanentError("CRM_RESPONSE_NOT_CONFIRMED_SENT");
    }
    if (item.payload?.providerMessageId && item.payload.providerMessageId !== queueItem.provider_message_id) {
      throw permanentError("CRM_RESPONSE_PROVIDER_ID_MISMATCH");
    }
    const response = repository.readResponsePayload(queueItem);
    const [match, releaseRaw, contactRaw, outletRaw] = await Promise.all([
      espocrm.get("OutreachMatch", queueItem.match_id),
      queueItem.release_id ? espocrm.get("MusicRelease", queueItem.release_id) : undefined,
      espocrm.get("MediaContact", queueItem.contact_id),
      queueItem.outlet_id ? espocrm.get("MediaOutlet", queueItem.outlet_id) : undefined
    ]);
    if (!releaseRaw || !outletRaw) throw permanentError("CRM_RESPONSE_REFERENCE_MISSING");
    const release = normalizeRelease(releaseRaw);
    const contact = normalizeContact(contactRaw);
    const outlet = normalizeOutlet(outletRaw);
    if (!contact.email || normalizeEmail(response.to) !== contact.email) {
      throw permanentError("CRM_RESPONSE_RECIPIENT_MISMATCH");
    }
    const { campaign } = await ensureTargetProjection({
      release,
      projectedAt: queueItem.sent_at
    });
    const correlationId = requiredText(item.payload?.correlationId, "CRM_RESPONSE_CORRELATION_ID_MISSING");
    const email = await upsertSentEmail({
      projectionKey: `response:${responseQueueId}`,
      subject: response.subject,
      bodyText: response.bodyText,
      sentAt: queueItem.sent_at,
      providerMessageId: queueItem.provider_message_id,
      deterministicMessageId: queueItem.deterministic_message_id,
      correlationId,
      match,
      release,
      contact,
      outlet,
      campaign,
      automaticResponse: true
    });
    await espocrm.upsertByUnique("OutreachEvent", "externalEventId", `response:${responseQueueId}`, {
      name: "Automatic allow-listed reply sent",
      outreachMatchId: match.id,
      musicReleaseId: release.id,
      mediaContactId: contact.id,
      mediaOutletId: outlet.id,
      campaignId: campaign.id,
      emailId: email.id,
      eventType: "Sent",
      eventDate: toEspoDateTime(queueItem.sent_at),
      messageId: queueItem.deterministic_message_id,
      providerMessageId: queueItem.provider_message_id,
      correlationId,
      externalEventId: `response:${responseQueueId}`,
      subject: safeHeader(response.subject, "Automatic outreach reply"),
      templateVersion: "reply-policy-v2",
      details: JSON.stringify({ responseQueueId, projectionVersion: 1 })
    });
    metrics.increment("outreach_crm_projections_total", { kind: "response", outcome: "completed" });
  }

  async function syncDeliveryUnknownToCrm(item) {
    const sendQueueId = requiredText(item.payload?.sendQueueId, "CRM_SEND_QUEUE_ID_MISSING");
    const queueItem = await repository.getSend(sendQueueId);
    if (!queueItem) throw permanentError("CRM_DELIVERY_QUEUE_ITEM_MISSING");
    if (queueItem.status === "sent") {
      await repository.reconcileCrmProjectionWork?.({ limit: 100 });
      return;
    }
    if (queueItem.status !== "delivery_unknown") return;
    const unknownEvidence = await repository.getDeliveryUnknownEvidence?.(sendQueueId);
    if (!unknownEvidence?.occurred_at || !unknownEvidence?.correlation_id) {
      throw permanentError("CRM_DELIVERY_UNKNOWN_EVIDENCE_MISSING");
    }
    const reviewId = await repository.enqueueHumanReview({
      reviewType: "delivery_unknown_reconciliation",
      source: "crm_projection",
      sourceEventId: `delivery-unknown:${sendQueueId}`,
      matchId: queueItem.match_id,
      contactId: queueItem.contact_id,
      outletId: queueItem.outlet_id,
      reason: queueItem.last_error_code ?? "provider_delivery_outcome_unknown",
      proposedAction: "verify_provider_delivery_before_marking_sent_or_retrying",
      evidence: {
        sendQueueId,
        deterministicMessageId: queueItem.deterministic_message_id,
        providerMessageId: queueItem.provider_message_id,
        attempts: queueItem.attempts,
        attemptNumber: unknownEvidence.attempt_number,
        attemptAt: toEspoDateTime(unknownEvidence.occurred_at),
        correlationId: unknownEvidence.correlation_id
      },
      createdBy: "crm-projection-v1"
    });
    await espocrm.upsertByUnique("OutreachEvent", "externalEventId", `delivery-unknown:${sendQueueId}`, {
      name: `Delivery outcome unknown ${sendQueueId}`.slice(0, 180),
      outreachMatchId: queueItem.match_id,
      musicReleaseId: queueItem.release_id,
      mediaContactId: queueItem.contact_id,
      mediaOutletId: queueItem.outlet_id,
      eventType: "Delivery Unknown",
      eventDate: toEspoDateTime(unknownEvidence.occurred_at),
      messageId: queueItem.deterministic_message_id,
      providerMessageId: queueItem.provider_message_id,
      correlationId: unknownEvidence.correlation_id,
      externalEventId: `delivery-unknown:${sendQueueId}`,
      errorCode: unknownEvidence.error_code ?? queueItem.last_error_code,
      details: JSON.stringify({
        sendQueueId,
        reviewId,
        attemptNumber: unknownEvidence.attempt_number,
        sentEmailProjected: false
      })
    });
    metrics.increment("outreach_crm_projections_total", { kind: "delivery_unknown", outcome: "review_required" });
  }

  async function projectReplyBusinessAction(item) {
    const payload = item.payload ?? {};
    const classification = requiredText(payload.classification, "CRM_REPLY_CLASSIFICATION_MISSING");
    const sourceEventId = requiredText(payload.sourceEventId, "CRM_REPLY_EVENT_ID_MISSING");
    const sendQueueId = requiredText(payload.sendQueueId, "CRM_REPLY_SEND_ID_MISSING");
    const queueItem = await repository.getSend(sendQueueId);
    if (!queueItem || queueItem.match_id !== item.entity_id || queueItem.status !== "sent") {
      throw permanentError("CRM_REPLY_ORIGIN_INVALID");
    }
    const [match, releaseRaw, contactRaw, outletRaw, sourceEvent] = await Promise.all([
      espocrm.get("OutreachMatch", queueItem.match_id),
      espocrm.get("MusicRelease", queueItem.release_id),
      espocrm.get("MediaContact", queueItem.contact_id),
      queueItem.outlet_id ? espocrm.get("MediaOutlet", queueItem.outlet_id) : undefined,
      espocrm.findOne("OutreachEvent", "externalEventId", sourceEventId, ["id", "eventDate"])
    ]);
    if (!outletRaw || !sourceEvent) throw retryableError("CRM_REPLY_PROJECTION_REFERENCE_MISSING");
    const release = normalizeRelease(releaseRaw);
    const contact = normalizeContact(contactRaw);
    const outlet = normalizeOutlet(outletRaw);
    const eventAt = requiredText(sourceEvent.eventDate, "CRM_REPLY_EVENT_DATE_MISSING");

    if (classification === "Not Suitable") {
      await withContactFence({ contact, outlet }, async () => {
        const canonicalGenres = canonicalEspoGenres(releaseRaw.genres);
        await repository.recordContactGenreDenials({
          contactId: contact.id,
          genres: canonicalGenres,
          sourceEventId,
          matchId: match.id,
          releaseId: release.id
        });
        const latest = await espocrm.get("MediaContact", contact.id);
        await updateConditional("MediaContact", latest, {
          rejectedGenres: mergeEspoGenres(latest.rejectedGenres, canonicalGenres),
          rejectedGenresUpdatedAt: toEspoDateTime(eventAt),
          rejectedGenresSourceEventId: sourceEvent.id
        });
      });
    }

    if (classification === "Future Releases") {
      await withContactFence({ contact, outlet }, async () => {
        const latest = await espocrm.get("MediaContact", contact.id);
        const canonicalGenres = canonicalEspoGenres(releaseRaw.genres);
        await updateConditional("MediaContact", latest, {
          previousPositiveReply: true,
          futureReleaseInterest: "Interested",
          futureReleaseGenres: mergeEspoGenres(latest.futureReleaseGenres, canonicalGenres),
          futureReleaseInterestAt: toEspoDateTime(eventAt),
          futureReleaseInterestEventId: sourceEvent.id
        });
      });
    }

    if (POSITIVE_CLASSIFICATIONS.has(classification)) {
      const { campaign } = await ensureTargetProjection({
        release,
        projectedAt: eventAt
      });
      const interestStatus = opportunityInterestStatus(classification);
      await projectOpportunitySignal({
        match,
        release,
        contact,
        outlet,
        campaign,
        sourceEvent,
        interestStatus,
        eventAt
      });
      metrics.increment("outreach_crm_projections_total", { kind: "opportunity", outcome: "completed" });
    }
  }

  async function projectOpportunitySignal({ match, release, contact, outlet, campaign, sourceEvent, interestStatus, eventAt }) {
    const projectionKey = `match:${match.id}`;
    const immutableIdentity = {
      outreachProjectionKey: projectionKey,
      outreachMatchId: match.id,
      musicReleaseId: release.id,
      mediaContactId: contact.id,
      mediaOutletId: outlet.id,
      campaignId: campaign.id
    };
    const createPayload = {
      name: `${release.artistName ?? "Artist"} – ${release.name ?? "Release"} / ${outlet.name ?? contact.name ?? "contact"}`.slice(0, 180),
      stage: "Prospecting",
      ...immutableIdentity,
      sourceOutreachEventId: sourceEvent.id,
      latestOutreachEventId: sourceEvent.id,
      outreachInterestStatus: interestStatus,
      outreachInterestAt: toEspoDateTime(eventAt),
      outreachRevenueState: "Unspecified",
      description: "Positive outreach signal. Revenue and close date are intentionally unspecified."
    };
    const select = [
      "id",
      "versionNumber",
      ...Object.keys(immutableIdentity),
      "sourceOutreachEventId",
      "latestOutreachEventId",
      "outreachInterestStatus",
      "outreachInterestAt",
      "outreachRevenueState"
    ];

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const existing = await espocrm.findOne("Opportunity", "outreachProjectionKey", projectionKey, select);
      if (!existing) {
        try {
          return await espocrm.create("Opportunity", createPayload);
        } catch (error) {
          if (error.deliveryUnknown) {
            const reconciled = await espocrm.findOne("Opportunity", "outreachProjectionKey", projectionKey, select);
            if (reconciled) {
              const state = reconcileOpportunitySignal(reconciled, immutableIdentity, sourceEvent, interestStatus, eventAt);
              if (!state.update) return state.record;
              try {
                return await updateConditional("Opportunity", reconciled, state.update);
              } catch (updateError) {
                if (isVersionConflict(updateError)) continue;
                throw updateError;
              }
            }
            throw retryableError("CRM_OPPORTUNITY_CREATE_UNCONFIRMED");
          }
          if (!isVersionConflict(error)) throw error;
          continue;
        }
      }

      const reconciled = await reconcileOpportunitySignal(existing, immutableIdentity, sourceEvent, interestStatus, eventAt);
      if (!reconciled.update) return reconciled.record;
      try {
        return await updateConditional("Opportunity", existing, reconciled.update);
      } catch (error) {
        if (!isVersionConflict(error)) throw error;
      }
    }
    throw retryableError("CRM_OPPORTUNITY_CONCURRENT_UPDATE_EXHAUSTED");
  }

  function reconcileOpportunitySignal(existing, immutableIdentity, sourceEvent, interestStatus, eventAt) {
    if (!Object.entries(immutableIdentity).every(([field, expected]) => existing?.[field] === expected)) {
      throw permanentError("CRM_OPPORTUNITY_IDENTITY_MISMATCH");
    }
    if (!existing.sourceOutreachEventId || !["Unspecified", "Human Confirmed"].includes(existing.outreachRevenueState)) {
      throw permanentError("CRM_OPPORTUNITY_PROVENANCE_INVALID");
    }
    const currentRank = OPPORTUNITY_INTEREST_RANK[existing.outreachInterestStatus];
    const incomingRank = OPPORTUNITY_INTEREST_RANK[interestStatus];
    if (!incomingRank || !currentRank) throw permanentError("CRM_OPPORTUNITY_INTEREST_INVALID");
    if (incomingRank <= currentRank || existing.latestOutreachEventId === sourceEvent.id) {
      return { record: existing };
    }
    return {
      record: existing,
      update: {
        outreachInterestStatus: interestStatus,
        outreachInterestAt: toEspoDateTime(eventAt),
        latestOutreachEventId: sourceEvent.id
      }
    };
  }

  async function reconcile() {
    const result = await repository.reconcileCrmProjectionWork({ limit: 1_000 });
    logger.info({ result }, "CRM projection backlog reconciled");
    return result;
  }

  async function upsertSentEmail({
    projectionKey,
    subject,
    bodyText,
    sentAt,
    providerMessageId,
    deterministicMessageId,
    correlationId,
    match,
    release,
    contact,
    outlet,
    campaign,
    automaticResponse = false
  }) {
    const from = safeMailbox(config.plunk?.from ?? config.mailgun.from, "CRM_SENDER_ADDRESS_INVALID");
    const to = safeMailbox(contact.email, "CRM_RECIPIENT_ADDRESS_INVALID");
    return espocrm.upsertByUnique("Email", "outreachProjectionKey", projectionKey, {
      name: safeHeader(subject, "Outreach message"),
      status: "Sent",
      dateSent: toEspoDateTime(sentAt),
      from,
      fromString: from,
      to,
      body: String(bodyText ?? "").slice(0, 100_000),
      isHtml: false,
      parentType: "OutreachMatch",
      parentId: match.id,
      outreachProjectionKey: projectionKey,
      outreachProviderMessageId: requiredText(providerMessageId, "CRM_PROVIDER_MESSAGE_ID_MISSING"),
      outreachDeterministicMessageId: requiredText(deterministicMessageId, "CRM_DETERMINISTIC_MESSAGE_ID_MISSING"),
      outreachCorrelationId: requiredText(correlationId, "CRM_CORRELATION_ID_MISSING"),
      outreachAcceptedAt: toEspoDateTime(sentAt),
      outreachAutomaticResponse: automaticResponse,
      outreachMatchId: match.id,
      outreachCampaignId: campaign.id,
      musicReleaseId: release.id,
      mediaContactId: contact.id,
      mediaOutletId: outlet.id
    });
  }

  async function transitionMatchAfterDelivery({ match, campaign, queueItem, acceptedAt }) {
    const sequenceStep = Number(queueItem.sequence_step);
    const expectedStatus = ["Ready", "Sent 1", "Follow-Up 1"][sequenceStep];
    const intermediateStatus = ["Sent 1", "Follow-Up 1", "Follow-Up 2"][sequenceStep];
    if (!expectedStatus || !intermediateStatus) throw permanentError("CRM_SEQUENCE_STEP_INVALID");
    const finalStep = sequenceStep >= config.policy.maxFollowUps;
    const nextStatus = finalStep ? "Completed" : intermediateStatus;
    const commonPatch = { campaignId: campaign.id };
    let transitioned = false;
    if (match.campaignStatus === expectedStatus) {
      const cooldownUntil = finalStep ? addDays(acceptedAt, config.policy.cooldownDays) : undefined;
      await updateConditional("OutreachMatch", match, {
        ...commonPatch,
        campaignStatus: nextStatus,
        currentSequenceStep: sequenceStep,
        activeSequence: !finalStep,
        lastSentAt: toEspoDateTime(acceptedAt),
        lastProviderMessageId: queueItem.provider_message_id,
        ...(finalStep ? { cooldownUntil: toEspoDateTime(cooldownUntil), nextActionAt: null } : {})
      });
      transitioned = true;
      if (finalStep) {
        await repository.releaseAllocation({ matchId: match.id, cooldownUntil, reason: "sequence_completed" });
      }
    } else if (match.campaignStatus === nextStatus || isTerminalCampaignStatus(match.campaignStatus)) {
      if (match.campaignId !== campaign.id) await updateConditional("OutreachMatch", match, commonPatch);
    } else {
      throw permanentError("CRM_SEQUENCE_TRANSITION_REJECTED");
    }
    if (!finalStep && (transitioned || match.campaignStatus === nextStatus)) {
      await repository.enqueueWork({
        kind: "schedule_sequence_step",
        entityType: "OutreachMatch",
        entityId: match.id,
        dedupeKey: `schedule-step:${match.id}:${sequenceStep + 1}`,
        payload: { sequenceStep: sequenceStep + 1 },
        priority: 30
      });
    }
  }

  async function updateConditional(entityType, record, payload) {
    if (typeof espocrm.updateConditional === "function") {
      return espocrm.updateConditional(entityType, record.id, payload, record.versionNumber);
    }
    return espocrm.update(entityType, record.id, payload);
  }

  function withContactFence({ contact, outlet }, work) {
    if (typeof repository.withSendAuthorizationFence === "function") {
      return repository.withSendAuthorizationFence({
        contactId: contact.id,
        outletId: outlet.id,
        email: contact.email,
        domain: outlet.domain
      }, work);
    }
    return work();
  }

  return Object.freeze({
    syncDeliveryToCrm,
    syncResponseToCrm,
    syncDeliveryUnknownToCrm,
    projectReplyBusinessAction,
    reconcile
  });
}

function assertConfirmedDelivery(queueItem, projection, workItem) {
  if (!queueItem || queueItem.status !== "sent" || !queueItem.sent_at) {
    throw permanentError("CRM_DELIVERY_NOT_CONFIRMED_SENT");
  }
  const checks = [
    [queueItem.id, projection.send_queue_id],
    [queueItem.match_id, projection.match_id],
    [queueItem.release_id, projection.release_id],
    [queueItem.contact_id, projection.contact_id],
    [queueItem.outlet_id ?? null, projection.outlet_id ?? null],
    [queueItem.provider_message_id, projection.provider_message_id],
    [queueItem.deterministic_message_id, projection.deterministic_message_id],
    [workItem.entity_id, projection.match_id],
    [workItem.payload?.providerMessageId, projection.provider_message_id],
    [workItem.payload?.correlationId, projection.correlation_id]
  ];
  if (checks.some(([actual, expected]) => actual !== expected)) {
    throw permanentError("CRM_DELIVERY_IDENTITY_MISMATCH");
  }
}

function assertEntityIdentity({ match, releaseRaw, contactRaw, outletRaw, queueItem }) {
  if (
    match.id !== queueItem.match_id ||
    releaseRaw.id !== queueItem.release_id ||
    contactRaw.id !== queueItem.contact_id ||
    outletRaw.id !== queueItem.outlet_id ||
    match.musicReleaseId !== queueItem.release_id ||
    match.mediaContactId !== queueItem.contact_id ||
    match.mediaOutletId !== queueItem.outlet_id
  ) {
    throw permanentError("CRM_DELIVERY_GRAPH_MISMATCH");
  }
}

function canonicalEspoGenres(values) {
  const canonical = [...new Set((Array.isArray(values) ? values : [])
    .map((value) => ESPO_GENRE_BY_NORMALIZED.get(String(value ?? "").trim().toLowerCase()))
    .filter(Boolean))];
  return canonical.length ? canonical : ["Other"];
}

function mergeEspoGenres(current, additions) {
  const present = new Set(canonicalEspoGenres(Array.isArray(current) && current.length ? current : []));
  if (!Array.isArray(current) || !current.length) present.delete("Other");
  for (const genre of additions) present.add(genre);
  return ESPO_GENRES.filter((genre) => present.has(genre));
}

function opportunityInterestStatus(classification) {
  if (["Send MP3/WAV", "Send Clean Version"].includes(classification)) return "Asset Requested";
  if (classification === "Will Consider") return "Warm";
  return classification;
}

function safeMailbox(value, code) {
  const text = String(value ?? "").trim();
  if (!text || text.length > 320 || /[\r\n]/u.test(text)) throw permanentError(code);
  const displayForm = text.match(/<([^<>]+)>\s*$/u);
  const candidate = displayForm ? displayForm[1].trim() : text;
  if ((!displayForm && /[<>]/u.test(text)) || (displayForm && /[<>]/u.test(text.slice(0, displayForm.index)))) {
    throw permanentError(code);
  }
  const normalized = normalizeEmail(candidate);
  if (!normalized) throw permanentError(code);
  return normalized;
}

function safeHeader(value, fallback) {
  const text = String(value ?? fallback).replace(/[\r\n]+/gu, " ").trim();
  return (text || fallback).slice(0, 255);
}

function requiredText(value, code) {
  const text = String(value ?? "").trim();
  if (!text) throw permanentError(code);
  return text;
}

function safeVersion(value, code) {
  const text = requiredText(value, code);
  if (text.length > 80 || /[\r\n]/u.test(text)) throw permanentError(code);
  return text;
}

function optionalVersion(value) {
  const text = String(value ?? "").trim();
  if (!text) return undefined;
  if (text.length > 80 || /[\r\n]/u.test(text)) throw permanentError("CRM_COPY_PROMPT_VERSION_INVALID");
  return text;
}

function permanentError(code) {
  return Object.assign(new Error(code), { code, retryable: false });
}

function retryableError(code) {
  return Object.assign(new Error(code), { code, retryable: true });
}

function isVersionConflict(error) {
  return error?.statusCode === 409 || error?.code === "ESPOCRM_VERSION_CONFLICT" || error?.code === "ESPOCRM_HTTP_409";
}

function toEspoDateTime(value) {
  const text = typeof value === "string" ? value.trim() : "";
  const date = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u.test(text)
    ? new Date(`${text.replace(" ", "T")}Z`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) throw permanentError("CRM_DATETIME_INVALID");
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function addDays(value, days) {
  return new Date(new Date(value).getTime() + Number(days) * 24 * 60 * 60 * 1_000);
}
