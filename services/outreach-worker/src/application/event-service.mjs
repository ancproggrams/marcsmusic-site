import { createHash } from "node:crypto";
import { isTerminalCampaignStatus } from "../domain/campaign-state.mjs";
import { inferOutOfOfficeResume } from "../domain/out-of-office.mjs";
import { classifyReply, extractReplyText, replyAction } from "../domain/reply-classifier.mjs";
import { deterministicMessageId } from "./match-service.mjs";
import { normalizeContact, normalizeDomain, normalizeEmail, normalizeOutlet, normalizeRelease } from "../domain/normalization.mjs";

const POSITIVE_CLASSIFICATIONS = new Set(["Interested", "Send MP3/WAV", "Send Clean Version", "Placement Confirmed", "Will Consider", "Future Releases"]);

export { inferOutOfOfficeResume } from "../domain/out-of-office.mjs";

export function createEventService({ espocrm, repository, outcomeReconcileRepository, config, logger, metrics, clock = () => new Date() }) {
  async function processEspoEvent(workItem) {
    const inbox = await requiredInbox(workItem);
    const payload = inbox.payload ?? {};
    const eventName = String(payload.event ?? inbox.event_type ?? "");
    const record = payload.record ?? payload.data ?? payload;
    const entityType = inbox.entity_type ?? entityTypeFromEvent(eventName) ?? record.entityType;
    const entityId = inbox.entity_id ?? record.id;

    if (entityType === "MusicRelease" && entityId) await enqueueMatch("match_release", entityType, entityId, record.modifiedAt);
    else if (entityType === "MediaContact" && entityId) await enqueueMatch("validate_contact", entityType, entityId, record.modifiedAt);
    else if (entityType === "MediaOutlet" && entityId) await enqueueMatch("validate_outlet", entityType, entityId, record.modifiedAt);
    else if (entityType === "OutreachSuppression" && entityId) await syncSuppression(entityId, record);
    else if (entityType === "OutreachMatch" && entityId && isTerminalCampaignStatus(record.campaignStatus)) {
      await syncMatchState(entityId, record);
    } else if (entityType === "Email" && entityId) {
      await processEspoEmail(entityId, inbox.external_id, inbox.created_at);
    }

    await repository.markEventProcessed(inbox.id);
    metrics.increment("outreach_webhook_events_processed_total", { source: "espocrm", entityType: entityType ?? "unknown" });
  }

  async function processMailgunEvent(workItem) {
    return processProviderEvent(workItem, "mailgun");
  }

  async function processPlunkEvent(workItem) {
    return processProviderEvent(workItem, "plunk");
  }

  async function processProviderEvent(workItem, source) {
    const inbox = await requiredInbox(workItem);
    const data = source === "mailgun"
      ? inbox.payload?.["event-data"] ?? inbox.payload ?? {}
      : normalizePlunkEventPayload(inbox.payload);
    const eventName = String(data.event ?? inbox.event_type ?? "inbound").toLowerCase();
    const occurredAt = providerDate(data.timestamp, inbox.created_at);

    if (isInboundReply(data, eventName)) {
      await processInboundReply(data, inbox.external_id, occurredAt, { projectIncomingEmail: true, providerSource: source });
      await repository.markEventProcessed(inbox.id);
      metrics.increment("outreach_webhook_events_processed_total", { source, eventType: "reply" });
      return;
    }

    let queueItem = await findOriginatingSend(data);
    if (!queueItem) {
      logger.warn({ externalEventId: inbox.external_id, eventName }, "Provider event did not correlate to an outreach send");
      await repository.markEventProcessed(inbox.id);
      metrics.increment("outreach_provider_events_unmatched_total", { eventType: eventName });
      return;
    }

    if (eventName === "accepted") {
      const messageId = firstMessageId(data.message?.headers?.["message-id"] ?? data["message-id"]);
      const recovered = await outcomeReconcileRepository?.confirmDeliveryUnknownAccepted({
        messageIds: [messageId].filter(Boolean),
        providerMessageId: messageId,
        providerEventId: inbox.external_id,
        occurredAt
      });
      if (recovered?.recovered) {
        queueItem = await repository.getSend(recovered.sendQueueId) ?? queueItem;
        metrics.increment("outreach_delivery_unknown_recovered_total", { source: `${source}_accepted` });
      }
    } else if (eventName === "delivered") {
      await recordProviderOutcome(queueItem, inbox.external_id, "delivered", "Delivered", occurredAt);
    } else if (eventName === "opened") {
      await recordProviderOutcome(queueItem, inbox.external_id, "opened", "Opened", occurredAt);
    } else if (eventName === "clicked") {
      await recordProviderOutcome(queueItem, inbox.external_id, "clicked", "Clicked", occurredAt);
    } else if (eventName === "failed") {
      const permanent = data.severity === "permanent" || String(data["delivery-status"]?.code ?? "").startsWith("5");
      await recordProviderOutcome(queueItem, inbox.external_id, permanent ? "hard_bounce" : "soft_bounce", permanent ? "Hard Bounced" : "Soft Bounced", occurredAt);
      if (permanent) {
        await suppressContactForQueue(queueItem, "hard_bounce", inbox.external_id, { hardBounced: true, emailValidationStatus: "Invalid" }, occurredAt, source);
      } else {
        await stopForSoftBounce(queueItem, inbox.external_id, occurredAt);
      }
    } else if (eventName === "complained") {
      await recordProviderOutcome(queueItem, inbox.external_id, "complained", "Spam Complaint", occurredAt);
      await suppressContactForQueue(queueItem, "spam_complaint", inbox.external_id, { doNotContact: true }, occurredAt, source);
    } else if (eventName === "unsubscribed") {
      await recordProviderOutcome(queueItem, inbox.external_id, "unsubscribed", "Opted Out", occurredAt);
      await suppressContactForQueue(queueItem, "unsubscribed", inbox.external_id, { optedOut: true, doNotContact: true }, occurredAt, source);
    }

    await repository.markEventProcessed(inbox.id);
    metrics.increment("outreach_webhook_events_processed_total", { source, eventType: eventName });
  }

  async function processUnsubscribeEvent(workItem) {
    const inbox = await requiredInbox(workItem);
    const { contactId, matchId, reason = "unsubscribe_link" } = inbox.payload ?? {};
    if (!contactId || !matchId) throw permanentError("UNSUBSCRIBE_EVENT_INVALID");
    const occurredAt = requiredEventDate(inbox.created_at, "UNSUBSCRIBE_EVENT_DATE_MISSING");
    const [contactRaw, match] = await Promise.all([
      espocrm.get("MediaContact", contactId),
      espocrm.get("OutreachMatch", matchId)
    ]);
    const contact = normalizeContact(contactRaw);
    await createAuthoritativeSuppression({
      subjectType: "contact",
      subject: contactId,
      reason,
      source: "unsubscribe_link",
      providerEventId: inbox.external_id,
      contact,
      matchId,
      occurredAt
    });
    await updateEntityConditional("MediaContact", contactRaw, { optedOut: true, doNotContact: true, status: "Blocked" });
    await updateMatchConditional(match, { campaignStatus: "Unsubscribed", activeSequence: false, stopReason: reason });
    await repository.releaseAllocation?.({ matchId, cooldownUntil: addDays(occurredAt, config.policy?.cooldownDays ?? 21), reason });
    await createOutreachEvent({ matchId, eventType: "Opted Out", externalEventId: inbox.external_id, details: { reason }, eventDate: occurredAt });
    await repository.recordOutcome({ matchId, eventType: "unsubscribed", providerEventId: `unsubscribe:${inbox.external_id}`, occurredAt });
    await repository.markEventProcessed(inbox.id);
  }

  async function processEspoEmail(emailId, externalEventId, inboxCreatedAt) {
    const email = await espocrm.get("Email", emailId);
    // Only an explicit inbound Espo status is authoritative. Absence of a
    // sender field is not evidence of direction and therefore fails closed.
    const incoming = email.status === "Archived" || email.status === "Received";
    if (!incoming) return;
    const occurredAt = requiredEventDate(email.dateSent ?? email.createdAt ?? inboxCreatedAt, "ESPO_REPLY_EVENT_DATE_MISSING");
    await processInboundReply({
      subject: email.name,
      "body-plain": email.body,
      sender: firstAddress(email.from ?? email.fromString),
      "In-Reply-To": email.inReplyToString ?? email.inReplyTo,
      "Message-Id": email.messageId
    }, externalEventId, occurredAt);
  }

  async function processInboundReply(data, externalEventId, occurredAt, { projectIncomingEmail = false, providerSource = "mailgun" } = {}) {
    const stableOccurredAt = requiredEventDate(occurredAt, "REPLY_EVENT_DATE_MISSING");
    const inReplyTo = firstMessageId(data["In-Reply-To"] ?? data["in-reply-to"] ?? data.message?.headers?.["in-reply-to"]);
    let queueItem = await repository.findSendByMessageId(inReplyTo);
    const variables = data["user-variables"] ?? data.message?.headers?.["X-Mailgun-Variables"] ?? {};
    if (!queueItem && variables["send-queue-id"]) queueItem = await repository.getSend(variables["send-queue-id"]);
    if (!queueItem) {
      await queueReplyReview({
        reviewType: "unmatched_reply",
        sourceEventId: externalEventId,
        reason: "reply_could_not_be_correlated",
        proposedAction: "identify_originating_send",
        evidence: replyEvidence(data)
      });
      logger.warn({ externalEventId }, "incoming reply could not be correlated; no automated response sent");
      metrics.increment("outreach_replies_unmatched_total");
      return;
    }

    if (queueItem.status !== "sent") {
      logger.warn({ externalEventId, sendQueueId: queueItem.id, status: queueItem.status }, "incoming reply references a send that was not confirmed as sent");
      metrics.increment("outreach_replies_unmatched_total", { reason: "origin_not_sent" });
      return;
    }

    const [match, releaseRaw, contactRaw, outletRaw] = await Promise.all([
      espocrm.get("OutreachMatch", queueItem.match_id),
      espocrm.get("MusicRelease", queueItem.release_id),
      espocrm.get("MediaContact", queueItem.contact_id),
      queueItem.outlet_id ? espocrm.get("MediaOutlet", queueItem.outlet_id) : undefined
    ]);
    const release = normalizeRelease(releaseRaw);
    const contact = normalizeContact(contactRaw);
    const outlet = outletRaw ? normalizeOutlet(outletRaw) : undefined;
    const sender = normalizeEmail(firstAddress(data.sender ?? data.from));
    if (!sender || sender !== contact.email) {
      await queueReplyReview({
        reviewType: "sender_identity_mismatch",
        sourceEventId: externalEventId,
        matchId: queueItem.match_id,
        contactId: queueItem.contact_id,
        outletId: queueItem.outlet_id,
        reason: "reply_sender_did_not_match_authorized_contact",
        proposedAction: "verify_sender_identity_and_recipient_authorization",
        evidence: replyEvidence(data)
      });
      logger.warn({ externalEventId, matchId: queueItem.match_id, contactId: contact.id }, "reply sender does not match the authorized contact; no state or asset response changed");
      metrics.increment("outreach_replies_unmatched_total", { reason: "sender_mismatch" });
      return;
    }
    const incomingMessageId = firstMessageId(data["Message-Id"] ?? data["message-id"] ?? data.message?.headers?.["message-id"]);
    const replyText = extractReplyText({
      strippedText: data["stripped-text"],
      plainText: data["body-plain"] ?? data.body
    });
    if (projectIncomingEmail) {
      await projectIncomingMailgunEmail({
        data,
        queueItem,
        match,
        contact,
        sender,
        incomingMessageId,
        replyText,
        externalEventId,
        occurredAt: stableOccurredAt,
        providerSource
      });
    }
    const suppressed = await repository.isSuppressed({
      contactId: contact.id,
      outletId: outlet?.id,
      email: contact.email,
      domain: outlet?.domain
    });
    if (
      suppressed ||
      contact.doNotContact ||
      contact.optedOut ||
      contact.hardBounced ||
      contact.status === "Blocked" ||
      match.campaignStatus === "Unsubscribed"
    ) {
      logger.warn({ externalEventId, matchId: queueItem.match_id, contactId: contact.id }, "reply ignored because deny-wins authorization is active");
      metrics.increment("outreach_replies_ignored_total", { reason: "deny_wins_active" });
      return;
    }
    const replyIdentity = incomingMessageId ?? createHash("sha256")
      .update(`${sender}\x1f${String(data.subject ?? "").slice(0, 500)}\x1f${replyText}`)
      .digest("hex");
    const canonicalEventId = `reply:${queueItem.id}:${createHash("sha256").update(replyIdentity).digest("hex")}`;
    const replyAt = stableOccurredAt.toISOString();
    const classification = classifyReply({ subject: data.subject ?? data.message?.headers?.subject, body: replyText });
    const action = replyAction(classification.classification, release);
    let outOfOfficeResume;
    const humanReviewId = action.reviewType
      ? await queueReplyReview({
        reviewType: action.reviewType,
        sourceEventId: canonicalEventId,
        matchId: queueItem.match_id,
        contactId: queueItem.contact_id,
        outletId: queueItem.outlet_id,
        reason: classification.classification,
        proposedAction: action.proposedAction,
        evidence: {
          subject: String(data.subject ?? data.message?.headers?.subject ?? "").slice(0, 500),
          replySnippet: replyText.slice(0, 2_000),
          messageId: incomingMessageId
        }
      })
      : undefined;

    if (classification.classification === "Not Suitable") {
      if (typeof repository.recordContactGenreDenials !== "function") {
        throw permanentError("CONTACT_GENRE_DENIAL_STORE_UNAVAILABLE");
      }
      const persistDenial = () => repository.recordContactGenreDenials({
        contactId: contact.id,
        genres: release.genres.length ? release.genres : ["other"],
        sourceEventId: canonicalEventId,
        matchId: queueItem.match_id,
        releaseId: release.id
      });
      if (typeof repository.withSendAuthorizationFence === "function") {
        await repository.withSendAuthorizationFence({
          contactId: contact.id,
          outletId: outlet?.id,
          email: contact.email,
          domain: outlet?.domain
        }, persistDenial);
      } else {
        await persistDenial();
      }
    }

    if (classification.classification === "Out Of Office") {
      outOfOfficeResume = inferOutOfOfficeResume({
        body: replyText,
        occurredAt: stableOccurredAt,
        now: clock(),
        timezones: [contactRaw.timezone, outletRaw?.timezone],
        idempotencyKey: canonicalEventId
      });
      const { resumeAt } = outOfOfficeResume;
      if (resumeAt) await repository.pausePendingForMatch(queueItem.match_id, resumeAt, "out_of_office");
      else await repository.cancelPendingForMatch(queueItem.match_id, "out_of_office_indefinite");
      await updateMatchConditional(match, {
        campaignStatus: "Paused",
        activeSequence: true,
        replyStatus: "Out Of Office",
        nextActionAt: resumeAt ? toEspoDateTime(resumeAt) : null,
        stopReason: resumeAt ? "out_of_office" : "out_of_office_indefinite"
      });
      if (resumeAt) {
        await repository.enqueueWork({
          kind: "resume_sequence",
          entityType: "OutreachMatch",
          entityId: queueItem.match_id,
          dedupeKey: `resume:${queueItem.match_id}:${resumeAt.toISOString()}`,
          payload: {
            previousStatus: statusForStep(queueItem.sequence_step),
            resumeTimezone: outOfOfficeResume.timezone,
            resumeDateSource: outOfOfficeResume.dateSource
          },
          availableAt: resumeAt,
          priority: 30
        });
      }
    } else if (classification.classification === "Auto Reply") {
      await repository.cancelPendingForMatch(queueItem.match_id, "auto_reply_indefinite");
      await updateMatchConditional(match, {
        campaignStatus: "Paused",
        activeSequence: true,
        replyStatus: "Auto Reply",
        nextActionAt: null,
        stopReason: "auto_reply_indefinite"
      });
    } else {
      await repository.cancelPendingForMatch(queueItem.match_id, `reply_${classification.classification.toLowerCase().replace(/[^a-z0-9]+/gu, "_")}`);
      await updateMatchConditional(match, {
        campaignStatus: action.matchStatus,
        activeSequence: false,
        replyStatus: classification.classification,
        stopReason: classification.classification
      });
      await repository.releaseAllocation?.({
        matchId: queueItem.match_id,
        cooldownUntil: addDays(stableOccurredAt, config.policy?.cooldownDays ?? 21),
        reason: `reply_${classification.classification.toLowerCase().replace(/[^a-z0-9]+/gu, "_")}`
      });
    }

    if (action.suppressContact) {
      await suppressForReply({ queueItem, match, action, classification: classification.classification, externalEventId: canonicalEventId, occurredAt: stableOccurredAt });
    }
    await repository.recordOutcome({ matchId: queueItem.match_id, sendQueueId: queueItem.id, eventType: "replied", providerEventId: canonicalEventId, occurredAt: stableOccurredAt });
    if (POSITIVE_CLASSIFICATIONS.has(classification.classification)) {
      await repository.recordOutcome({ matchId: queueItem.match_id, sendQueueId: queueItem.id, eventType: classification.classification === "Placement Confirmed" ? "placement_confirmed" : "positive_reply", providerEventId: `positive:${canonicalEventId}`, occurredAt: stableOccurredAt });
    }
    await createOutreachEvent({
      matchId: queueItem.match_id,
      eventType: "Replied",
      externalEventId: canonicalEventId,
      providerMessageId: incomingMessageId,
      responseClassification: classification.classification,
      eventDate: stableOccurredAt,
      details: {
        confidence: classification.confidence,
        automated: classification.automated,
        sourceEventId: externalEventId,
        humanReviewId,
        decisionMode: action.reviewType
          ? "human_review"
          : classification.classification === "Unsubscribe"
            ? "explicit_opt_out"
            : ["Out Of Office", "Auto Reply"].includes(classification.classification)
              ? "automated_pause"
              : "deterministic_reversible",
        ...(outOfOfficeResume ? {
          ...(outOfOfficeResume.resumeAt ? { resumeAt: outOfOfficeResume.resumeAt.toISOString() } : {}),
          resumeTimezone: outOfOfficeResume.timezone,
          resumeDateSource: outOfOfficeResume.dateSource,
          pauseMode: outOfOfficeResume.pauseMode
        } : {})
      }
    });

    if (
      classification.classification === "Not Suitable" ||
      classification.classification === "Future Releases" ||
      POSITIVE_CLASSIFICATIONS.has(classification.classification)
    ) {
      await repository.enqueueWork({
        kind: "project_reply_business_action",
        entityType: "OutreachMatch",
        entityId: queueItem.match_id,
        dedupeKey: `reply-business:${canonicalEventId}`,
        payload: {
          sendQueueId: queueItem.id,
          sourceEventId: canonicalEventId,
          classification: classification.classification,
          replyAt
        },
        priority: 12
      });
    }

    if (action.response) {
      const responseKey = createHash("sha256").update(`${canonicalEventId}\x1f${classification.classification}`).digest("hex");
      await repository.enqueueResponse({
        matchId: queueItem.match_id,
        releaseId: queueItem.release_id,
        contactId: queueItem.contact_id,
        outletId: queueItem.outlet_id,
        idempotencyKey: responseKey,
        deterministicMessageId: deterministicMessageId(responseKey, providerDomain(config)),
        payload: {
          to: contact.email,
          subject: replySubject(data.subject ?? data.message?.headers?.subject),
          bodyText: `${action.response}\n\nBest,\nMarc Rene\nMarcsMusic`,
          inReplyTo: incomingMessageId && /^<[^<>\s@]+@[^<>\s@]+>$/u.test(incomingMessageId) ? incomingMessageId : undefined,
          originatingSendQueueId: queueItem.id,
          sourceMessageIdentity: replyIdentity
        }
      });
    }
  }

  async function projectIncomingMailgunEmail({
    data,
    queueItem,
    match,
    contact,
    sender,
    incomingMessageId,
    replyText,
    externalEventId,
    occurredAt,
    providerSource = "mailgun"
  }) {
    const stableIdentity = incomingMessageId ?? externalEventId;
    const digest = createHash("sha256")
      .update(`${queueItem.id}\x1f${stableIdentity}`)
      .digest("hex");
    const projectionKey = `inbound:${digest}`;
    const recipient = normalizeEmail(firstAddress(
      data.recipient ?? data.To ?? data.to ?? data.envelope?.targets?.[0]
    )) ?? normalizeEmail(config.plunk?.replyTo ?? config.mailgun.replyTo);
    if (!recipient) throw permanentError("INBOUND_EMAIL_RECIPIENT_INVALID");
    const providerMessageId = incomingMessageId ?? `${providerSource}-event:${externalEventId}`;
    await espocrm.upsertByUnique("Email", "outreachProjectionKey", projectionKey, {
      name: safeIncomingSubject(data.subject ?? data.message?.headers?.subject),
      status: "Received",
      dateSent: toEspoDateTime(occurredAt),
      from: sender,
      fromString: sender,
      to: recipient,
      body: String(replyText ?? "").slice(0, 100_000),
      isHtml: false,
      parentType: "OutreachMatch",
      parentId: match.id,
      messageId: incomingMessageId,
      inReplyToString: firstMessageId(data["In-Reply-To"] ?? data["in-reply-to"] ?? data.message?.headers?.["in-reply-to"]),
      outreachProjectionKey: projectionKey,
      outreachCorrelationId: projectionKey,
      outreachProviderMessageId: providerMessageId,
      outreachDeterministicMessageId: queueItem.deterministic_message_id,
      outreachAcceptedAt: toEspoDateTime(occurredAt),
      outreachAutomaticResponse: false,
      outreachMatchId: match.id,
      ...(match.campaignId ? { outreachCampaignId: match.campaignId } : {}),
      musicReleaseId: queueItem.release_id,
      mediaContactId: contact.id,
      ...(queueItem.outlet_id ? { mediaOutletId: queueItem.outlet_id } : {})
    });
    metrics.increment("outreach_inbound_email_projections_total", { source: providerSource });
  }

  async function recordProviderOutcome(queueItem, externalEventId, outcomeType, crmEventType, occurredAt) {
    await repository.recordOutcome({ matchId: queueItem.match_id, sendQueueId: queueItem.id, eventType: outcomeType, providerEventId: externalEventId, occurredAt });
    await createOutreachEvent({ matchId: queueItem.match_id, eventType: crmEventType, externalEventId, providerMessageId: queueItem.provider_message_id, eventDate: occurredAt });
  }

  async function suppressContactForQueue(queueItem, reason, providerEventId, contactPatch, occurredAt, providerSource = "mailgun") {
    const [contactRaw, match] = await Promise.all([
      espocrm.get("MediaContact", queueItem.contact_id),
      espocrm.get("OutreachMatch", queueItem.match_id)
    ]);
    const contact = normalizeContact(contactRaw);
    await createAuthoritativeSuppression({ subjectType: "contact", subject: contact.id, reason, source: providerSource, providerEventId, contact, matchId: queueItem.match_id, occurredAt });
    if (contact.email) await repository.suppress({ subjectType: "email", subject: contact.email, reason, source: providerSource });
    await repository.cancelPendingForContact(contact.id, reason);
    await updateEntityConditional("MediaContact", contactRaw, { ...contactPatch, status: "Blocked" });
    await updateMatchConditional(match, {
      campaignStatus: reason === "unsubscribed" ? "Unsubscribed" : "Stopped",
      activeSequence: false,
      stopReason: reason
    });
    await repository.releaseAllocation?.({
      matchId: queueItem.match_id,
      cooldownUntil: addDays(occurredAt, config.policy?.cooldownDays ?? 21),
      reason
    });
  }

  async function stopForSoftBounce(queueItem, providerEventId, occurredAt) {
    await repository.cancelPendingForMatch(queueItem.match_id, "soft_bounce");
    await repository.cancelPendingForContact(queueItem.contact_id, "soft_bounce");
    const [match, contact] = await Promise.all([
      espocrm.get("OutreachMatch", queueItem.match_id),
      espocrm.get("MediaContact", queueItem.contact_id)
    ]);
    if (!isTerminalCampaignStatus(match.campaignStatus)) {
      await updateMatchConditional(match, { campaignStatus: "Stopped", activeSequence: false, stopReason: "soft_bounce" });
    }
    await updateEntityConditional("MediaContact", contact, { status: "Needs Validation", emailValidationStatus: "Risky" });
    await repository.releaseAllocation?.({
      matchId: queueItem.match_id,
      cooldownUntil: addDays(occurredAt, config.policy?.cooldownDays ?? 21),
      reason: "soft_bounce"
    });
    logger.warn({ matchId: queueItem.match_id, contactId: queueItem.contact_id, providerEventId }, "soft bounce stopped the complete sequence pending revalidation");
  }

  async function suppressForReply({ queueItem, action, classification, externalEventId, occurredAt }) {
    const contactRaw = await espocrm.get("MediaContact", queueItem.contact_id);
    const contact = normalizeContact(contactRaw);
    if (action.suppressContact) {
      await createAuthoritativeSuppression({ subjectType: "contact", subject: contact.id, reason: classification, source: "reply", providerEventId: externalEventId, contact, matchId: queueItem.match_id, occurredAt });
      if (contact.email) await repository.suppress({ subjectType: "email", subject: contact.email, reason: classification, source: "reply" });
      await updateEntityConditional("MediaContact", contactRaw, {
        doNotContact: true,
        optedOut: classification === "Unsubscribe",
        status: "Blocked"
      });
    }
  }

  async function queueReplyReview(value) {
    if (typeof repository.enqueueHumanReview !== "function") return undefined;
    return repository.enqueueHumanReview({
      ...value,
      source: "inbound_reply",
      createdBy: "reply-policy-v2"
    });
  }

  async function createAuthoritativeSuppression({ subjectType, subject, reason, source, providerEventId, contact, matchId, occurredAt }) {
    const stableOccurredAt = requiredEventDate(occurredAt, "SUPPRESSION_EVENT_DATE_MISSING");
    const subjectHash = await repository.suppress({ subjectType, subject, reason, source });
    await repository.cancelPendingForContact(contact.id, reason);
    await espocrm.upsertByUnique("OutreachSuppression", "subjectHash", subjectHash, {
      name: `${reason}: ${contact.name ?? contact.id}`.slice(0, 180),
      subjectHash,
      subjectType,
      reason: String(reason).slice(0, 80),
      source: String(source).slice(0, 80),
      active: true,
      suppressedAt: toEspoDateTime(stableOccurredAt),
      providerEventId,
      mediaContactId: contact.id
    });
    if (matchId) await repository.cancelPendingForMatch(matchId, reason);
    if (matchId) {
      await repository.releaseAllocation?.({
        matchId,
        cooldownUntil: addDays(stableOccurredAt, config.policy?.cooldownDays ?? 21),
        reason
      });
    }
  }

  async function syncSuppression(id, suppliedRecord) {
    const record = suppliedRecord?.subjectType ? suppliedRecord : await espocrm.get("OutreachSuppression", id);
    if (!record.active) return;
    const subjects = {
      contact: record.mediaContactId,
      outlet: record.mediaOutletId,
      email: normalizeEmail(record.emailAddress),
      domain: normalizeDomain(record.domain)
    };
    const present = Object.entries(subjects).filter(([, value]) => Boolean(value));
    const subject = subjects[record.subjectType];
    if (!subject || present.length !== 1 || present[0][0] !== record.subjectType) {
      throw permanentError("SUPPRESSION_SUBJECT_CONTRACT_INVALID");
    }
    if (typeof repository.suppressionHash === "function" && repository.suppressionHash(record.subjectType, subject) !== record.subjectHash) {
      throw permanentError("SUPPRESSION_HASH_CONTRACT_INVALID");
    }
    await repository.suppress({ subjectType: record.subjectType, subject, reason: record.reason, source: record.source ?? "espocrm" });
    if (record.mediaContactId) await repository.cancelPendingForContact(record.mediaContactId, record.reason);
  }

  async function syncMatchState(id, suppliedRecord) {
    const match = suppliedRecord?.campaignStatus ? suppliedRecord : await espocrm.get("OutreachMatch", id);
    if (!isTerminalCampaignStatus(match.campaignStatus)) return;
    const reason = `match_${String(match.campaignStatus).toLowerCase().replace(/\s+/gu, "_")}`;
    await repository.cancelPendingForMatch(id, reason);
    await repository.releaseAllocation?.({
      matchId: id,
      cooldownUntil: addDays(new Date(), config.policy?.cooldownDays ?? 21),
      reason
    });
  }

  async function createOutreachEvent({ matchId, eventType, externalEventId, providerMessageId, responseClassification, details = {}, eventDate }) {
    const stableEventDate = requiredEventDate(eventDate, "OUTREACH_EVENT_DATE_MISSING");
    await espocrm.upsertByUnique("OutreachEvent", "externalEventId", externalEventId, {
      name: `${eventType} ${externalEventId}`.slice(0, 180),
      outreachMatchId: matchId,
      eventType,
      eventDate: toEspoDateTime(stableEventDate),
      externalEventId,
      providerMessageId,
      responseClassification,
      details: JSON.stringify(details)
    });
  }

  async function updateMatchConditional(match, payload) {
    return updateEntityConditional("OutreachMatch", match, payload);
  }

  async function updateEntityConditional(entityType, record, payload) {
    if (typeof espocrm.updateConditional === "function") {
      return espocrm.updateConditional(entityType, record.id, payload, record.versionNumber);
    }
    return espocrm.update(entityType, record.id, payload);
  }

  async function findOriginatingSend(data) {
    const variables = data["user-variables"] ?? {};
    const messageId = firstMessageId(data.message?.headers?.["message-id"] ?? data["message-id"]);
    if (variables["send-queue-id"]) {
      const byId = await repository.getSend(variables["send-queue-id"]);
      if (byId && sendOwnsMessageId(byId, messageId)) return byId;
      if (byId) {
        logger.warn({ sendQueueId: byId.id }, "Mailgun event queue identity did not match its message id");
        return undefined;
      }
    }
    return repository.findSendByMessageId(messageId);
  }

  async function requiredInbox(workItem) {
    const inbox = await repository.readEvent(workItem.payload?.eventInboxId);
    if (!inbox) throw permanentError("EVENT_INBOX_NOT_FOUND");
    return inbox;
  }

  function enqueueMatch(kind, entityType, entityId, revision = "webhook") {
    return repository.enqueueWork({
      kind,
      entityType,
      entityId,
      dedupeKey: `webhook-match:${entityType}:${entityId}:${revision ?? "unknown"}`,
      priority: 40
    });
  }

  return Object.freeze({ processEspoEvent, processMailgunEvent, processPlunkEvent, processUnsubscribeEvent, syncSuppression, syncMatchState });
}

export function normalizePlunkEventPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw permanentError("PLUNK_EVENT_PAYLOAD_INVALID");
  }
  const rawType = payload.eventType
    ?? payload.type
    ?? payload.name
    ?? payload.event?.type
    ?? payload.data?.eventType
    ?? payload.data?.type
    ?? payload.data?.name;
  const eventType = String(rawType ?? "").trim().toLowerCase();
  const event = payload.event && typeof payload.event === "object" && !Array.isArray(payload.event)
    ? payload.event
    : payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
      ? payload.data
      : payload;
  const id = scalar(event.emailId ?? event.email_id ?? event.id ?? event.messageId ?? payload.id, 500);
  if (!eventType || !id) throw permanentError("PLUNK_EVENT_IDENTITY_INVALID");
  const mappedEvent = {
    "email.sent": "accepted",
    "email.delivery": "delivered",
    "email.delivered": "delivered",
    "email.open": "opened",
    "email.opened": "opened",
    "email.click": "clicked",
    "email.clicked": "clicked",
    "email.bounce": "failed",
    "email.bounced": "failed",
    "email.complaint": "complained",
    "email.complained": "complained",
    "contact.unsubscribed": "unsubscribed",
    "email.unsubscribed": "unsubscribed",
    "email.received": "inbound"
  }[eventType];
  if (!mappedEvent) throw permanentError("PLUNK_EVENT_TYPE_UNSUPPORTED");
  const messageId = scalar(event.messageId ?? event.message_id, 500);
  const inbound = mappedEvent === "inbound";
  const body = inbound ? scalar(event.body ?? event.bodyPlain ?? event.text, 524_288) : undefined;
  return {
    ...event,
    event: mappedEvent,
    timestamp: event.timestamp
      ?? event.sentAt
      ?? event.deliveredAt
      ?? event.openedAt
      ?? event.clickedAt
      ?? event.bouncedAt
      ?? event.complainedAt,
    ...(eventType === "email.bounce" || eventType === "email.bounced"
      ? { severity: String(event.bounceType ?? "").toLowerCase() === "permanent" ? "permanent" : "temporary" }
      : {}),
    ...(messageId ? { "message-id": messageId } : {}),
    // Plunk's email id is the stable provider identity returned by /v1/send.
    // Binding it as message-id lets the existing repository lookup correlate
    // webhook receipts without relying on recipient addresses or timestamps.
    "user-variables": event.data && typeof event.data === "object" ? event.data : {},
    ...(body ? { "body-plain": body } : {}),
    // Sender/subject are safe context on lifecycle events, but body and
    // In-Reply-To remain inbound-only above so an outbound body cannot be
    // mistaken for a received reply by isInboundReply().
    ...(event.from ? { sender: event.from } : {}),
    ...(event.subject ? { subject: event.subject } : {}),
    "message-id": id,
    ...(inbound && (event.inReplyTo || event.in_reply_to)
      ? { "In-Reply-To": event.inReplyTo ?? event.in_reply_to }
      : {})
  };
}

function providerDomain(config) {
  const from = String(config.plunk?.from ?? "").match(/@([^>\s]+)>?$/u)?.[1];
  return from || config.mailgun.domain;
}

function entityTypeFromEvent(eventName) {
  const value = String(eventName).split(/[.:]/u)[0];
  return value || undefined;
}

function providerDate(value, persistedFallback) {
  const providerTimestamp = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim() !== ""
      ? Number(value)
      : Number.NaN;
  const milliseconds = providerTimestamp * 1_000;
  if (Number.isFinite(milliseconds) && milliseconds > 0) return new Date(milliseconds);
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed;
  }
  return requiredEventDate(persistedFallback, "PROVIDER_EVENT_DATE_MISSING");
}

function isInboundReply(data, eventName) {
  return eventName === "inbound" || Boolean(data["body-plain"] || data["stripped-text"] || data["In-Reply-To"]);
}

function firstMessageId(value) {
  const match = String(value ?? "").match(/<[^<>\s]+@[^<>\s]+>/u);
  return match?.[0] ?? (typeof value === "string" && value.trim() ? value.trim() : undefined);
}

function firstAddress(value) {
  if (Array.isArray(value)) return firstAddress(value[0]);
  const text = String(value ?? "");
  return text.match(/<([^<>\s]+@[^<>\s]+)>/u)?.[1] ?? text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu)?.[0];
}

function sendOwnsMessageId(queueItem, messageId) {
  if (!messageId) return false;
  return [queueItem.provider_message_id, queueItem.deterministic_message_id]
    .map(firstMessageId)
    .filter(Boolean)
    .includes(messageId);
}

function replySubject(subject) {
  const clean = String(subject ?? "Your message").replace(/[\r\n]+/gu, " ").trim().slice(0, 140);
  return /^re:/iu.test(clean) ? clean : `Re: ${clean}`;
}

function safeIncomingSubject(subject) {
  const clean = String(subject ?? "Incoming outreach reply")
    .replace(/[\r\n]+/gu, " ")
    .trim()
    .slice(0, 180);
  return clean || "Incoming outreach reply";
}

function replyEvidence(data) {
  return Object.freeze({
    subject: String(data?.subject ?? data?.message?.headers?.subject ?? "").slice(0, 500),
    sender: firstAddress(data?.sender ?? data?.from),
    inReplyTo: firstMessageId(data?.["In-Reply-To"] ?? data?.["in-reply-to"] ?? data?.message?.headers?.["in-reply-to"]),
    replySnippet: extractReplyText({
      strippedText: data?.["stripped-text"],
      plainText: data?.["body-plain"] ?? data?.body,
      maxLength: 2_000
    })
  });
}

function statusForStep(sequenceStep) {
  return ["Sent 1", "Follow-Up 1", "Follow-Up 2"][Number(sequenceStep)] ?? "Sent 1";
}

function permanentError(code) {
  return Object.assign(new Error(code), { code, retryable: false });
}

function scalar(value, maximum) {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const normalized = String(value).trim();
  return normalized ? normalized.slice(0, maximum) : undefined;
}

function requiredEventDate(value, code) {
  if (
    value === null
    || value === undefined
    || typeof value === "boolean"
    || (typeof value === "string" && value.trim() === "")
    || (typeof value === "number" && !Number.isFinite(value))
    || (!(value instanceof Date) && typeof value !== "string" && typeof value !== "number")
  ) {
    throw permanentError(code);
  }
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) throw permanentError(code);
  return date;
}

function toEspoDateTime(value) {
  return new Date(value).toISOString().slice(0, 19).replace("T", " ");
}

function addDays(value, days) {
  return new Date(new Date(value).getTime() + Number(days) * 24 * 60 * 60 * 1_000);
}
