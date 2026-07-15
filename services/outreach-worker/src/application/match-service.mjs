import { createHash } from "node:crypto";
import { isTerminalCampaignStatus } from "../domain/campaign-state.mjs";
import { evaluateEligibility } from "../domain/eligibility-policy.mjs";
import { calculateMatchScore, classifyMatch } from "../domain/match-score.mjs";
import { allocateBestMatches } from "../domain/campaign-allocator.mjs";
import { normalizeContact, normalizeOutlet, normalizeRelease } from "../domain/normalization.mjs";
import { scheduleSequenceStep } from "../domain/scheduler.mjs";
import { subtractDays } from "./date-utils.mjs";

const ACTIVE_CAMPAIGN_STATUSES = ["Ready", "Active", "Sent 1", "Follow-Up 1", "Follow-Up 2", "Paused"];
const RECALCULABLE_CAMPAIGN_STATUSES = new Set(["New", "Eligible", "Waitlist", "Skipped", "Blocked"]);
const MAX_ACTIVE_RELEASES_PER_CONTACT_EVALUATION = 10_000;

export function createMatchService({ espocrm, repository, contactIntakeService, copyService, config, logger, metrics }) {
  if (typeof repository?.withContactAllocationFence !== "function") {
    throw new TypeError("repository.withContactAllocationFence is required for deterministic contact allocation");
  }
  if (typeof contactIntakeService?.processContact !== "function"
      || typeof contactIntakeService?.processOutlet !== "function") {
    throw new TypeError("contactIntakeService is required before matching");
  }

  async function processContact(contactId, options = {}) {
    const intake = await contactIntakeService.processContact(contactId, { enqueueMatch: false });
    return repository.withContactAllocationFence(
      intake.canonicalId,
      () => processContactFenced(intake, options)
    );
  }

  async function processContactFenced(intake, options = {}) {
    const contactId = intake.canonicalId;
    const contactRecord = { ...intake.record, evidenceAttestation: intake.attestation };
    const contact = normalizeContact(contactRecord);
    if (!contact.mediaOutletId) {
      await recordBlockedWithoutOutlet(contact);
      return Object.freeze({ matched: 0, allocated: 0, blocked: 1 });
    }
    const outletIntake = await contactIntakeService.processOutlet(contact.mediaOutletId, { enqueueMatch: false });
    const outlet = normalizeOutlet({ ...outletIntake.record, evidenceAttestation: outletIntake.attestation });
    const releaseRecords = await listActiveReleaseRecords();
    const releases = releaseRecords.map(normalizeRelease).filter((release) => release.status === "Active");
    const existingMatches = await espocrm.list("OutreachMatch", {
      where: [{ type: "equals", attribute: "mediaContactId", value: contact.id }],
      maxRecords: 1_000
    });
    // Build lookup state once. Matching is intentionally O(releases + matches):
    // this path is exercised for every contact and must not degrade into a
    // release-by-match scan as either collection grows.
    const existingByReleaseId = new Map(existingMatches.map((match) => [match.musicReleaseId, match]));
    const activeMatches = existingMatches.filter((match) => ACTIVE_CAMPAIGN_STATUSES.includes(match.campaignStatus));
    const activeMatchIds = new Set(activeMatches.map((match) => match.id));
    const recentOutletMatches = await espocrm.list("OutreachMatch", {
      where: [
        { type: "equals", attribute: "mediaOutletId", value: outlet.id },
        { type: "greaterThanOrEquals", attribute: "lastSentAt", value: toEspoDateTime(subtractDays(new Date(), config.policy.outletCooldownDays)) }
      ],
      maxRecords: 1_000
    });
    const [suppressed, persistedGenreDenials] = await Promise.all([
      repository.isSuppressed({ contactId: contact.id, outletId: outlet.id, email: contact.email, domain: outlet.domain }),
      repository.getContactGenreDenials?.(contact.id) ?? []
    ]);
    const persistedGenreDenialSet = new Set(persistedGenreDenials);
    const candidates = [];

    for (const release of releases) {
      const existing = existingByReleaseId.get(release.id);
      const activeOtherSequence = activeMatches.length > (existing && activeMatchIds.has(existing.id) ? 1 : 0);
      const eligibility = evaluateEligibility({
        contact,
        outlet,
        release,
        activeSequence: activeOtherSequence,
        cooldownUntil: existing?.cooldownUntil,
        suppressed,
        genreDenied: release.genres.some((genre) => persistedGenreDenialSet.has(genre)),
        maxEvidenceAgeSeconds: config.sourceIngestion?.maxEvidenceAgeSeconds
      });
      const scoring = calculateMatchScore({ release, contact, outlet });
      const scoreState = classifyMatch(scoring.score, {
        autoThreshold: config.policy.matchThreshold,
        waitlistThreshold: config.policy.waitlistThreshold
      });
      const eligibilityStatus = !eligibility.eligible ? "Blocked" : scoreState;
      const idempotencyKey = matchKey(release.id, contact.id);
      const record = await espocrm.upsertByUnique("OutreachMatch", "idempotencyKey", idempotencyKey, {
        name: `${release.artistName} – ${release.name} / ${outlet.name}`.slice(0, 180),
        musicReleaseId: release.id,
        mediaContactId: contact.id,
        mediaOutletId: outlet.id,
        matchScore: scoring.score,
        matchReasons: JSON.stringify({ rulesVersion: "match-2026-01", score: scoring.reasons, eligibility: eligibility.reasons }),
        eligibilityStatus,
        campaignStatus: existing?.campaignStatus && !RECALCULABLE_CAMPAIGN_STATUSES.has(existing.campaignStatus)
          ? existing.campaignStatus
          : eligibilityStatus,
        idempotencyKey
      });
      candidates.push(Object.freeze({
        match: record,
        release,
        contact,
        outlet,
        releaseId: release.id,
        contactId: contact.id,
        outletId: outlet.id,
        score: scoring.score,
        releasePriority: release.priority,
        eligible: eligibility.eligible && scoreState === "Eligible" && !isTerminalCampaignStatus(existing?.campaignStatus),
        existing
      }));
      metrics.increment("outreach_match_evaluations_total", { status: eligibilityStatus });
    }

    const allocation = allocateBestMatches(candidates, {
      activeContactIds: activeMatches.length ? [contact.id] : [],
      recentlyContactedOutletIds: recentOutletMatches.length ? [outlet.id] : [],
      alreadySentPairs: existingMatches.filter((match) => match.lastSentAt).map((match) => `${match.musicReleaseId}:${contact.id}`),
      maxContactsPerOutlet: 2
    });

    for (const candidate of allocation.allocations) {
      await scheduleCandidate(candidate);
    }

    logger.info({
      contactId,
      triggerReleaseId: options.releaseId,
      matches: candidates.length,
      allocations: allocation.allocations.length
    }, "contact matching completed");
    return Object.freeze({ matched: candidates.length, allocated: allocation.allocations.length, blocked: candidates.filter((item) => !item.eligible).length });
  }

  async function listActiveReleaseRecords() {
    const query = {
      where: [{ type: "equals", attribute: "status", value: "Active" }],
      maxRecords: MAX_ACTIVE_RELEASES_PER_CONTACT_EVALUATION + 1
    };
    const records = [];
    if (typeof espocrm.iterate === "function") {
      for await (const page of espocrm.iterate("MusicRelease", query)) {
        records.push(...page);
        if (records.length > MAX_ACTIVE_RELEASES_PER_CONTACT_EVALUATION) {
          throw activeReleaseLimitExceeded();
        }
      }
      return records;
    }
    const page = await espocrm.list("MusicRelease", query);
    if (page.length > MAX_ACTIVE_RELEASES_PER_CONTACT_EVALUATION) throw activeReleaseLimitExceeded();
    return page;
  }

  async function processRelease(releaseId) {
    const releaseRecord = await espocrm.get("MusicRelease", releaseId);
    const release = normalizeRelease(releaseRecord);
    if (release.status !== "Active") return Object.freeze({ matched: 0, allocated: 0, skipped: "release_not_active" });
    const revision = releaseRecord.modifiedAt ?? releaseRecord.createdAt ?? "unknown";
    const pages = typeof espocrm.iterate === "function"
      ? espocrm.iterate("MediaContact", { maxRecords: 10_000_000, select: ["id"] })
      : [await espocrm.list("MediaContact", { maxRecords: 10_000 })];
    let contacts = 0;
    let enqueued = 0;
    for await (const page of pages) {
      contacts += page.length;
      enqueued += await repository.enqueueWorkBatch(page.map((contact) => ({
        kind: "match_contact_release",
        entityType: "MediaContact",
        entityId: contact.id,
        dedupeKey: `match-release:${releaseId}:${contact.id}:${revision}`,
        payload: { releaseId },
        priority: 50
      })));
    }
    return Object.freeze({ matched: 0, allocated: 0, contacts, enqueued });
  }

  async function processOutlet(outletId) {
    const options = {
      where: [{ type: "equals", attribute: "mediaOutletId", value: outletId }],
      maxRecords: 10_000_000,
      select: ["id", "modifiedAt"]
    };
    const pages = typeof espocrm.iterate === "function"
      ? espocrm.iterate("MediaContact", options)
      : [await espocrm.list("MediaContact", { ...options, maxRecords: 5_000 })];
    let contacts = 0;
    let enqueued = 0;
    for await (const page of pages) {
      contacts += page.length;
      enqueued += await repository.enqueueWorkBatch(page.map((contact) => ({
        kind: "match_contact",
        entityType: "MediaContact",
        entityId: contact.id,
        dedupeKey: `match-outlet:${outletId}:${contact.id}:${contact.modifiedAt ?? "unknown"}`,
        priority: 50
      })));
    }
    return Object.freeze({ contacts, enqueued });
  }

  async function scheduleCandidate(candidate) {
    const currentStatus = candidate.match.campaignStatus;
    if (!["Ready", "New", "Eligible"].includes(currentStatus)) return;
    const allocation = await repository.tryAcquireAllocation({
      email: candidate.contact.email,
      matchId: candidate.match.id,
      releaseId: candidate.release.id,
      contactId: candidate.contact.id,
      outletId: candidate.outlet.id,
      maxActivePerOutlet: 1,
      outletCooldownDays: config.policy.outletCooldownDays
    });
    if (!allocation.acquired) {
      await updateMatchConditional(candidate.match, {
        campaignStatus: "Eligible",
        activeSequence: false,
        stopReason: `allocation_${allocation.reason}`.slice(0, 80)
      });
      metrics.increment("outreach_allocation_skipped_total", { reason: allocation.reason });
      return;
    }

    const sequenceStep = 0;
    const idempotencyKey = sendKey(candidate.release.id, candidate.contact.id, sequenceStep);
    let artifactId;
    let templateVersion;
    try {
      ({ artifactId, templateVersion } = await copyService.prepare({
        match: candidate.match,
        release: candidate.release,
        contact: candidate.contact,
        outlet: candidate.outlet,
        sequenceStep
      }));
    } catch (error) {
      if (error.retryable === false) {
        await releaseAllocationAfterPermanentCopyFailure(candidate, error);
      }
      throw error;
    }
    const sendAt = scheduleSequenceStep({
      sequenceStep,
      timezone: candidate.contact.timezone || candidate.outlet.timezone,
      idempotencyKey
    });
    const queueId = await repository.enqueueSend({
      matchId: candidate.match.id,
      releaseId: candidate.release.id,
      contactId: candidate.contact.id,
      recipientEmail: candidate.contact.email,
      outletId: candidate.outlet.id,
      sequenceStep,
      idempotencyKey,
      deterministicMessageId: deterministicMessageId(idempotencyKey, config.mailgun.domain),
      copyArtifactId: artifactId,
      sendAt
    });
    const existingQueueItem = queueId ? undefined : await repository.getSendByIdempotencyKey(idempotencyKey);
    if (!queueId && (!existingQueueItem || existingQueueItem.match_id !== candidate.match.id)) {
      throw Object.assign(new Error("Allocated initial send could not be durably queued"), {
        code: "SEND_QUEUE_ALLOCATION_CONFLICT",
        retryable: true
      });
    }
    await updateMatchConditional(candidate.match, {
      campaignStatus: "Ready",
      currentSequenceStep: 0,
      activeSequence: true,
      stopReason: null,
      nextActionAt: toEspoDateTime(sendAt)
    });
    await espocrm.upsertByUnique("OutreachEvent", "externalEventId", `queued:${candidate.match.id}`, {
      name: `Queued ${candidate.release.artistName} – ${candidate.release.name}`.slice(0, 180),
      outreachMatchId: candidate.match.id,
      eventType: "Queued",
      eventDate: toEspoDateTime(new Date()),
      externalEventId: `queued:${candidate.match.id}`,
      templateVersion,
      details: JSON.stringify({ sequenceSteps: config.policy.maxFollowUps + 1, sendQueueId: queueId ?? existingQueueItem.id })
    });
    metrics.increment("outreach_allocations_total");
  }

  async function releaseAllocationAfterPermanentCopyFailure(candidate, copyError) {
    let released;
    try {
      released = await repository.releaseAllocation({
        matchId: candidate.match.id,
        cooldownUntil: null,
        reason: "copy_preparation_permanent_failure"
      });
    } catch (releaseError) {
      throw allocationReleaseFailure(candidate.match.id, copyError, releaseError);
    }
    if (!released) {
      throw allocationReleaseFailure(
        candidate.match.id,
        copyError,
        new Error("The active allocation was not released")
      );
    }
    metrics.increment("outreach_allocations_released_total", { reason: "copy_preparation_permanent_failure" });
  }

  async function scheduleSequenceStepAfterAcceptance(workItem) {
    const sequenceStep = Number(workItem.payload?.sequenceStep);
    if (!Number.isInteger(sequenceStep) || sequenceStep < 1 || sequenceStep > config.policy.maxFollowUps) return;
    const match = await espocrm.get("OutreachMatch", workItem.entity_id);
    const requiredStatus = [undefined, "Sent 1", "Follow-Up 1"][sequenceStep];
    if (isTerminalCampaignStatus(match.campaignStatus)) return;
    if (match.campaignStatus !== requiredStatus || !match.activeSequence) {
      throw Object.assign(new Error(`Cannot schedule sequence step ${sequenceStep} from ${match.campaignStatus}`), {
        code: "SEQUENCE_SCHEDULE_PRECONDITION_FAILED",
        retryable: true
      });
    }

    const [releaseRaw, contactRaw, outletRaw, sequenceStart] = await Promise.all([
      espocrm.get("MusicRelease", match.musicReleaseId),
      espocrm.get("MediaContact", match.mediaContactId),
      espocrm.get("MediaOutlet", match.mediaOutletId),
      repository.getSequenceStart(match.id)
    ]);
    if (!sequenceStart) {
      throw Object.assign(new Error("Initial provider acceptance time is unavailable"), {
        code: "SEQUENCE_START_UNAVAILABLE",
        retryable: true
      });
    }
    const release = normalizeRelease(releaseRaw);
    const contact = normalizeContact(contactRaw);
    const outlet = normalizeOutlet(outletRaw);
    const idempotencyKey = sendKey(release.id, contact.id, sequenceStep);
    const existingQueueItem = await repository.getSendByIdempotencyKey(idempotencyKey);
    if (existingQueueItem) return;
    const previousIdempotencyKey = sendKey(release.id, contact.id, sequenceStep - 1);
    const previousQueueItem = await repository.getSendByIdempotencyKey(previousIdempotencyKey);
    if (previousQueueItem?.status !== "sent" || !previousQueueItem.sent_at) {
      throw Object.assign(new Error("Previous provider acceptance time is unavailable"), {
        code: "PREVIOUS_ACCEPTANCE_UNAVAILABLE",
        retryable: true
      });
    }
    const { artifactId } = await copyService.prepare({ match, release, contact, outlet, sequenceStep });
    const sendAt = scheduleSequenceStep({
      sequenceStep,
      timezone: contact.timezone || outlet.timezone,
      idempotencyKey,
      from: new Date(),
      sequenceStart: new Date(sequenceStart),
      previousAcceptedAt: new Date(previousQueueItem.sent_at)
    });
    const queueId = await repository.enqueueSend({
      matchId: match.id,
      releaseId: release.id,
      contactId: contact.id,
      recipientEmail: contact.email,
      outletId: outlet.id,
      sequenceStep,
      idempotencyKey,
      deterministicMessageId: deterministicMessageId(idempotencyKey, config.mailgun.domain),
      copyArtifactId: artifactId,
      sendAt
    });
    if (!queueId) {
      const reconciled = await repository.getSendByIdempotencyKey(idempotencyKey);
      if (!reconciled || reconciled.match_id !== match.id) {
        throw Object.assign(new Error("Follow-up queue insert conflicted with its allocation"), {
          code: "FOLLOW_UP_QUEUE_CONFLICT",
          retryable: true
        });
      }
    }
    const latest = await espocrm.get("OutreachMatch", match.id);
    if (!isTerminalCampaignStatus(latest.campaignStatus)) {
      await updateMatchConditional(latest, { nextActionAt: toEspoDateTime(sendAt) });
    }
  }

  async function recordBlockedWithoutOutlet(contact) {
    logger.info({ contactId: contact.id, reason: "outlet_missing" }, "contact blocked before matching");
    metrics.increment("outreach_match_evaluations_total", { status: "Blocked" });
  }

  async function updateMatchConditional(match, payload) {
    return updateMatchEntityConditional("OutreachMatch", match, payload);
  }

  async function updateMatchEntityConditional(entityType, record, payload) {
    if (typeof espocrm.updateConditional === "function") {
      return espocrm.updateConditional(entityType, record.id, payload, record.versionNumber);
    }
    return espocrm.update(entityType, record.id, payload);
  }

  return Object.freeze({ processContact, processRelease, processOutlet, scheduleSequenceStepAfterAcceptance });
}

export function matchKey(releaseId, contactId) {
  return createHash("sha256").update(`${releaseId}\x1f${contactId}`).digest("hex");
}

export function sendKey(releaseId, contactId, sequenceStep) {
  return createHash("sha256").update(`${releaseId}\x1f${contactId}\x1f${sequenceStep}`).digest("hex");
}

export function deterministicMessageId(idempotencyKey, domain) {
  const safeDomain = String(domain ?? "invalid.local").toLowerCase().replace(/[^a-z0-9.-]/gu, "");
  return `<outreach-${String(idempotencyKey).slice(0, 48)}@${safeDomain || "invalid.local"}>`;
}

function toEspoDateTime(value) {
  return new Date(value).toISOString().slice(0, 19).replace("T", " ");
}

function allocationReleaseFailure(matchId, copyError, releaseError) {
  return Object.assign(
    new Error("A permanent copy failure occurred but its active allocation could not be released", {
      cause: new AggregateError([copyError, releaseError], "Copy preparation and allocation release both failed")
    }),
    {
      code: "COPY_ALLOCATION_RELEASE_FAILED",
      retryable: true,
      details: Object.freeze({ matchId, copyErrorCode: copyError.code ?? "unknown" })
    }
  );
}

function activeReleaseLimitExceeded() {
  return Object.assign(new Error("Active release evaluation exceeded its compiled safety bound"), {
    code: "ACTIVE_RELEASE_EVALUATION_LIMIT_EXCEEDED",
    retryable: false
  });
}
