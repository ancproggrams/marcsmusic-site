import test from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";

import { createCopyService } from "../src/application/copy-service.mjs";
import { createEventService, inferOutOfOfficeResume } from "../src/application/event-service.mjs";
import { createSendService } from "../src/application/send-service.mjs";
import { buildCopyFacts, validateProviderSelection } from "../src/domain/copy-policy.mjs";
import { evaluateContactEvidence, evaluateOutletEvidence } from "../src/domain/evidence-policy.mjs";
import { normalizeContact, normalizeOutlet, normalizeRelease } from "../src/domain/normalization.mjs";
import { sendAuthorizationSnapshotDigest } from "../src/domain/send-authorization-snapshot.mjs";
import { EspoCrmClient } from "../src/infrastructure/espocrm-client.mjs";
import { HttpCopyProvider } from "../src/infrastructure/copy-provider.mjs";
import { MailgunClient } from "../src/infrastructure/mailgun-client.mjs";
import { Metrics } from "../src/infrastructure/metrics.mjs";

const logger = Object.freeze({
  info() {},
  warn() {},
  error() {}
});

test("out-of-office resume parses explicit multilingual dates and otherwise pauses indefinitely", () => {
  const occurredAt = new Date("2026-07-15T08:00:00.000Z");
  const examples = [
    ["Automatic reply. I return on 2026-07-20.", "explicit_iso_date"],
    ["Automatisch antwoord. Ik ben terug op 20 juli 2026.", "explicit_named_date"],
    ["Automatische Antwort. Wieder da am 20. Juli 2026.", "explicit_named_date"],
    ["Réponse automatique. De retour le 20 juillet 2026.", "explicit_named_date"],
    ["Respuesta automática. Regreso el 20 de julio de 2026.", "explicit_named_date"],
    ["Resposta automática. Regresso em 20 de julho de 2026.", "explicit_named_date"]
  ];
  for (const [body, dateSource] of examples) {
    const explicit = inferOutOfOfficeResume({
      body,
      occurredAt,
      now: occurredAt,
      timezones: ["Mars/Olympus", "Europe/Amsterdam"],
      idempotencyKey: "reply-ooo-multilingual"
    });
    const local = DateTime.fromJSDate(explicit.resumeAt, { zone: "utc" }).setZone(explicit.timezone);
    assert.equal(explicit.timezone, "Europe/Amsterdam");
    assert.equal(explicit.dateSource, dateSource);
    assert.equal(explicit.pauseMode, "scheduled");
    assert.equal(local.toISODate(), "2026-07-21", "Monday return rolls to the next allowed weekday");
    assert.ok([2, 3, 4].includes(local.weekday));
    assert.ok(local.hour * 60 + local.minute >= 9 * 60 + 30);
    assert.ok(local.hour * 60 + local.minute <= 11 * 60 + 30);
  }

  for (const [body, timezones, expectedReason] of [
    ["Back on 2026-02-30.", ["Europe/Amsterdam"], "return_date_invalid_or_ambiguous"],
    ["Back on 03/04/2026.", ["Europe/Amsterdam"], "return_date_invalid_or_ambiguous"],
    ["Away until 03/04/2026; I return on 2026-04-03.", ["Europe/Amsterdam"], "return_date_invalid_or_ambiguous"],
    ["Back on 2026-07-20 or 2026-07-21.", ["Europe/Amsterdam"], "return_date_invalid_or_ambiguous"],
    [Array.from({ length: 13 }, (_, index) => `Back on 2026-08-${String(index + 1).padStart(2, "0")}.`).join(" "), ["Europe/Amsterdam"], "return_date_invalid_or_ambiguous"],
    ["Automatic reply. Thank you for your message.", ["Europe/Amsterdam"], "return_date_missing_or_untrusted"],
    ["I return on 2026-07-20.", ["Invalid/Zone"], "recipient_timezone_invalid"]
  ]) {
    const paused = inferOutOfOfficeResume({ body, occurredAt, now: occurredAt, timezones, idempotencyKey: `reply-${body}` });
    assert.equal(paused.pauseMode, "indefinite");
    assert.equal(paused.resumeAt, undefined);
    assert.equal(paused.dateSource, expectedReason);
  }
  assert.throws(() => inferOutOfOfficeResume({
    body: "I return on 2026-07-20.",
    occurredAt: null,
    timezones: ["Europe/Amsterdam"]
  }), (error) => error.code === "REPLY_RESUME_BASE_DATE_MISSING");
});

test("a late out-of-office replay never creates a past resume timestamp", () => {
  const now = new Date("2026-07-22T14:00:00.000Z");
  const result = inferOutOfOfficeResume({
    body: "Automatic reply. I return on 2026-07-20.",
    occurredAt: new Date("2026-07-15T08:00:00.000Z"),
    now,
    timezones: ["Europe/Amsterdam"],
    idempotencyKey: "late-ooo-replay"
  });
  assert.ok(result.resumeAt > now);
  const local = DateTime.fromJSDate(result.resumeAt, { zone: "utc" }).setZone("Europe/Amsterdam");
  assert.equal(local.toISODate(), "2026-07-23");
});

function configFixture() {
  return {
    publicBaseUrl: "https://outreach.example.test",
    crypto: {
      unsubscribeSigning: {
        schemaVersion: 2,
        active: { kid: "unsub-adversarial-2026-07", key: "unsubscribe-signing-key-for-tests-32-chars" },
        verifyOnly: []
      }
    },
    copyProvider: { enabled: true, minConfidence: 0.8 },
    safety: {
      killSwitch: false,
      sendEnabled: true,
      dailySendLimit: 25,
      domainDailyLimit: 2,
      automaticResponseDailyLimit: 10,
      automaticResponseContactLimit: 1
    },
    policy: { maxFollowUps: 2, cooldownDays: 21, outletCooldownDays: 14, matchThreshold: 80 },
    sourceIngestion: { maxEvidenceAgeSeconds: 7_776_000 },
    mailgun: { domain: "mail.example.test" }
  };
}

function authoritativeRecords(campaignStatus = "Sent 1") {
  return {
    OutreachMatch: {
      id: "match-1",
      musicReleaseId: "release-1",
      mediaContactId: "contact-1",
      mediaOutletId: "outlet-1",
      activeSequence: true,
      campaignStatus,
      versionNumber: 7
    },
    MusicRelease: {
      id: "release-1",
      name: "Northern Lights",
      artistName: "Marc Rene",
      status: "Active",
      genres: ["Indie"],
      subGenres: ["Dream Pop"],
      languages: ["en"],
      territories: ["NL"],
      epkUrl: "https://artist.example.test/epk"
    },
    MediaContact: {
      id: "contact-1",
      firstName: "Sam",
      name: "Sam Editor",
      status: "Active",
      mediaOutletId: "outlet-1",
      emailAddress: "editor@radio.example.test",
      preferredLanguage: "en",
      timezone: "Europe/Amsterdam",
      lastValidatedAt: "2026-07-01T00:00:00.000Z",
      previousPositiveReply: true,
      emailValidationStatus: "Valid",
      contactPurpose: "Explicit Music Submission",
      contactBasis: "Explicit Submission Address",
      contactSourceUrl: "https://radio.example.test/submissions",
      contactEvidence: "This address is published for music submissions.",
      proofCapturedAt: new Date(Date.now() - 86_400_000).toISOString(),
      versionNumber: 4
    },
    MediaOutlet: {
      id: "outlet-1",
      name: "Example Radio",
      type: "Radio Station",
      website: "https://radio.example.test",
      activityStatus: "Active",
      submissionPolicy: "Explicit",
      submissionUrl: "https://radio.example.test/submissions",
      submissionEvidence: "The station accepts music submissions by email.",
      sourceUrl: "https://radio.example.test/submissions",
      acceptsEmail: true,
      genres: ["Indie"],
      subGenres: ["Dream Pop"],
      formatGenres: ["Indie"],
      language: "en",
      country: "NL",
      timezone: "Europe/Amsterdam",
      lastValidatedAt: new Date(Date.now() - 86_400_000).toISOString(),
      versionNumber: 3
    }
  };
}

function evidenceAttestationReader(records) {
  const contactEvaluation = evaluateContactEvidence({
    entityId: records.MediaContact.id,
    entityVersion: records.MediaContact.versionNumber,
    email: records.MediaContact.emailAddress,
    purpose: records.MediaContact.contactPurpose,
    basis: records.MediaContact.contactBasis,
    sourceUrl: records.MediaContact.contactSourceUrl,
    evidenceText: records.MediaContact.contactEvidence,
    capturedAt: records.MediaContact.proofCapturedAt,
    expectedDomain: records.MediaOutlet.website
  });
  const outletEvaluation = evaluateOutletEvidence({
    entityId: records.MediaOutlet.id,
    entityVersion: records.MediaOutlet.versionNumber,
    submissionPolicy: records.MediaOutlet.submissionPolicy,
    sourceUrl: records.MediaOutlet.sourceUrl,
    evidenceText: records.MediaOutlet.submissionEvidence,
    capturedAt: records.MediaOutlet.lastValidatedAt,
    expectedDomain: records.MediaOutlet.website
  });
  assert.equal(contactEvaluation.allowed, true, contactEvaluation.reasons.join(","));
  assert.equal(outletEvaluation.allowed, true, outletEvaluation.reasons.join(","));
  const attestations = new Map([
    ["MediaContact", activeEvidenceAttestation(contactEvaluation)],
    ["MediaOutlet", activeEvidenceAttestation(outletEvaluation)]
  ]);
  return Object.freeze({
    async getEvidenceAttestation(entityType, entityId) {
      const attestation = attestations.get(entityType);
      return attestation?.entityId === entityId ? attestation : undefined;
    }
  });
}

function activeEvidenceAttestation(evaluation) {
  return Object.freeze({
    ...evaluation.attestation,
    evidenceDigest: evaluation.digest,
    sourceKind: "direct_crm",
    originCompleted: true,
    status: "active"
  });
}

function authorizedCopy(records, overrides = {}) {
  return {
    subject: "Follow-up",
    bodyText: "Safe follow-up body",
    authorizationSnapshotDigest: sendAuthorizationSnapshotDigest({
      match: records.OutreachMatch,
      release: normalizeRelease(records.MusicRelease),
      contact: normalizeContact(records.MediaContact),
      outlet: normalizeOutlet(records.MediaOutlet)
    }),
    authorizationSnapshotVersion: 1,
    ...overrides
  };
}

function sendQueueItem(sequenceStep = 1) {
  return Object.freeze({
    id: `send-${sequenceStep}`,
    match_id: "match-1",
    release_id: "release-1",
    contact_id: "contact-1",
    outlet_id: "outlet-1",
    copy_artifact_id: `copy-${sequenceStep}`,
    deterministic_message_id: `<send-${sequenceStep}@mail.example.test>`,
    recipient_hash: "a".repeat(64),
    sequence_step: sequenceStep,
    attempts: 1
  });
}

function activeAllocation(item) {
  return {
    match_id: item.match_id,
    release_id: item.release_id,
    contact_id: item.contact_id,
    outlet_id: item.outlet_id,
    status: "active",
    cooldown_until: null
  };
}

test("provider acceptance commits projection work but the sender never schedules a follow-up itself", async () => {
  const item = sendQueueItem(1);
  const records = authoritativeRecords("Sent 1");
  const calls = { work: [], updates: [], accepted: [], preflightFailures: [], provider: 0 };
  const repository = {
    async claimSend() { return item; },
    async withSendAuthorizationFence(_identity, work) { return work(); },
    async readCopyArtifact() { return authorizedCopy(records); },
    async getClaimedSendAllocation(queueItem) { return activeAllocation(queueItem); },
    async isSuppressed() { return false; },
    async reserveSendCapacity() { return { allowed: true }; },
    async beginDeliveryAttempt() { return "correlation-1"; },
    async markPreflightFailure(queueItem, failure) { calls.preflightFailures.push({ queueItem, failure }); },
    async markSendAccepted(queueItem, correlationId, providerMessageId) {
      calls.accepted.push({ queueItem, correlationId, providerMessageId });
      // Production commits this projection work in the same transaction as
      // provider acceptance; the fake models that repository boundary.
      calls.work.push({
        kind: "sync_delivery_to_crm",
        entityId: queueItem.match_id,
        payload: {
          sendQueueId: queueItem.id,
          providerMessageId,
          sequenceStep: queueItem.sequence_step,
          correlationId,
          acceptedAt: "2026-07-15T09:30:00.000Z"
        }
      });
    },
    async enqueueWork(work) { calls.work.push(work); },
    async releaseAllocation() { throw new Error("a non-final step must not release its allocation"); }
  };
  const espocrm = {
    async get(entityType) { return records[entityType]; },
    async updateConditional(entityType, id, patch, versionNumber) {
      calls.updates.push({ entityType, id, patch, versionNumber });
      records.OutreachMatch = { ...records.OutreachMatch, ...patch, versionNumber: versionNumber + 1 };
      return records.OutreachMatch;
    },
    async upsertByUnique() { return { id: "event-1" }; }
  };
  const service = createSendService({
    espocrm,
    repository,
    contactIntakeRepository: evidenceAttestationReader(records),
    mailgun: {
      async send() {
        calls.provider += 1;
        assert.equal(calls.work.length, 0, "no follow-up work may exist before provider acceptance");
        return { id: "provider-message-1" };
      }
    },
    config: configFixture(),
    logger,
    metrics: new Metrics()
  });

  assert.deepEqual(await service.sendOne("worker-1"), { processed: true, sent: true });
  assert.equal(calls.provider, 1);
  assert.deepEqual(calls.preflightFailures, []);
  assert.equal(calls.accepted.length, 1);
  assert.deepEqual(calls.work.map(({ kind }) => kind), ["sync_delivery_to_crm"]);
  assert.equal(calls.work.some(({ kind }) => kind === "schedule_sequence_step"), false);

  assert.equal(calls.updates.length, 0);
  assert.equal(calls.work[0].payload.sequenceStep, 1);
});

test("a failed provider attempt cannot unlock follow-up scheduling", async () => {
  const item = sendQueueItem(1);
  const records = authoritativeRecords("Sent 1");
  const calls = { work: [], failures: [], preflightFailures: [] };
  const repository = {
    async claimSend() { return item; },
    async withSendAuthorizationFence(_identity, work) { return work(); },
    async readCopyArtifact() { return authorizedCopy(records); },
    async getClaimedSendAllocation(queueItem) { return activeAllocation(queueItem); },
    async isSuppressed() { return false; },
    async reserveSendCapacity() { return { allowed: true }; },
    async beginDeliveryAttempt() { return "correlation-1"; },
    async markPreflightFailure(queueItem, failure) { calls.preflightFailures.push({ queueItem, failure }); },
    async enqueueWork(work) { calls.work.push(work); },
    async markSendFailure(queueItem, correlationId, details) { calls.failures.push({ queueItem, correlationId, details }); }
  };
  const providerError = Object.assign(new Error("provider rejected the request"), {
    code: "MAILGUN_HTTP_400",
    retryable: false,
    deliveryUnknown: false
  });
  const service = createSendService({
    espocrm: { async get(entityType) { return records[entityType]; } },
    repository,
    contactIntakeRepository: evidenceAttestationReader(records),
    mailgun: { async send() { throw providerError; } },
    config: configFixture(),
    logger,
    metrics: new Metrics()
  });

  assert.deepEqual(await service.sendOne("worker-1"), {
    processed: true,
    sent: false,
    error: "MAILGUN_HTTP_400"
  });
  assert.deepEqual(calls.work, []);
  assert.deepEqual(calls.preflightFailures, []);
  assert.equal(calls.failures.length, 1);
  assert.equal(calls.failures[0].details.deliveryUnknown, false);
});

test("provider authorization fence cancels release, link and relation drift before capacity or provider use", async () => {
  const scenarios = [
    {
      name: "paused release",
      mutate(records) { records.MusicRelease = { ...records.MusicRelease, status: "Paused" }; },
      reason: "release_not_active"
    },
    {
      name: "ended campaign",
      mutate(records) { records.MusicRelease = { ...records.MusicRelease, campaignEndDate: "2020-01-01" }; },
      reason: "campaign_ended"
    },
    {
      name: "changed but still valid release link",
      mutate(records) { records.MusicRelease = { ...records.MusicRelease, epkUrl: "https://artist.example.test/replaced" }; },
      reason: "copy_authorization_snapshot_changed"
    },
    {
      name: "match relation changed",
      mutate(records) { records.OutreachMatch = { ...records.OutreachMatch, musicReleaseId: "release-other" }; },
      reason: "send_reference_link_changed"
    },
    {
      name: "active sequence ownership changed",
      mutate(records) { records.OutreachMatch = { ...records.OutreachMatch, activeSequence: false }; },
      reason: "sequence_allocation_changed"
    },
    {
      name: "match cooldown became active",
      mutate(records) { records.OutreachMatch = { ...records.OutreachMatch, cooldownUntil: "2099-01-01T00:00:00.000Z" }; },
      reason: "cooldown_active"
    }
  ];
  for (const scenario of scenarios) {
    const item = sendQueueItem(0);
    const records = authoritativeRecords("Ready");
    const copy = authorizedCopy(records, { subject: "Initial" });
    const calls = { canceled: [], work: [], capacity: 0, provider: 0 };
    const repository = {
      async claimSend() { return item; },
      async withSendAuthorizationFence(_identity, work) {
        scenario.mutate(records);
        return work();
      },
      async readCopyArtifact() { return copy; },
      async getClaimedSendAllocation(queueItem) { return activeAllocation(queueItem); },
      async isSuppressed() { return false; },
      async cancelClaimedSend(id, reason) { calls.canceled.push({ scope: "queue", id, reason }); },
      async cancelPendingForMatch(id, reason) { calls.canceled.push({ scope: "match", id, reason }); },
      async enqueueWork(work) { calls.work.push(work); },
      async markPreflightFailure() { throw new Error("authorization denials must use the deterministic cancellation path"); },
      async reserveSendCapacity() { calls.capacity += 1; throw new Error("capacity must remain untouched"); }
    };
    const service = createSendService({
      espocrm: { async get(entityType) { return records[entityType]; } },
      repository,
      contactIntakeRepository: evidenceAttestationReader(records),
      mailgun: { async send() { calls.provider += 1; } },
      config: configFixture(),
      logger,
      metrics: new Metrics()
    });

    assert.deepEqual(await service.sendOne(`worker-${scenario.name}`), {
      processed: true,
      sent: false,
      reason: scenario.reason
    }, scenario.name);
    assert.equal(calls.capacity, 0, scenario.name);
    assert.equal(calls.provider, 0, scenario.name);
    assert.deepEqual(calls.canceled.map(({ reason }) => reason), [scenario.reason, scenario.reason], scenario.name);
    assert.equal(calls.work[0].kind, "sync_stop_to_crm", scenario.name);
    assert.equal(calls.work[0].payload.reason, scenario.reason, scenario.name);
  }
});

test("current score drift below the auto threshold cancels a queued send inside the provider fence", async () => {
  const item = sendQueueItem(0);
  const records = authoritativeRecords("Ready");
  const copy = authorizedCopy(records, { subject: "Initial" });
  const calls = { canceled: [], work: [], provider: 0 };
  const repository = {
    async claimSend() { return item; },
    async withSendAuthorizationFence(_identity, work) {
      records.MediaOutlet = {
        ...records.MediaOutlet,
        genres: [],
        subGenres: [],
        formatGenres: [],
        language: "en",
        country: "NL"
      };
      records.MediaContact = { ...records.MediaContact, previousPositiveReply: false };
      return work();
    },
    async readCopyArtifact() { return copy; },
    async getClaimedSendAllocation(queueItem) { return activeAllocation(queueItem); },
    async isSuppressed() { return false; },
    async cancelClaimedSend(id, reason) { calls.canceled.push({ id, reason }); },
    async cancelPendingForMatch(id, reason) { calls.canceled.push({ id, reason }); },
    async enqueueWork(work) { calls.work.push(work); },
    async markPreflightFailure() { throw new Error("score drift must use the deterministic cancellation path"); },
    async reserveSendCapacity() { throw new Error("score drift must precede capacity reservation"); }
  };
  const service = createSendService({
    espocrm: { async get(entityType) { return records[entityType]; } },
    repository,
    contactIntakeRepository: evidenceAttestationReader(records),
    mailgun: { async send() { calls.provider += 1; } },
    config: configFixture(),
    logger,
    metrics: new Metrics()
  });

  assert.deepEqual(await service.sendOne("worker-score-drift"), {
    processed: true,
    sent: false,
    reason: "match_score_below_auto_threshold"
  });
  assert.equal(calls.provider, 0);
  assert.equal(calls.work[0].payload.details.score < calls.work[0].payload.details.threshold, true);
  assert.deepEqual(calls.canceled.map(({ reason }) => reason), [
    "match_score_below_auto_threshold",
    "match_score_below_auto_threshold"
  ]);
});

test("inbound replies with an unconfirmed origin or foreign sender are inert", async () => {
  for (const scenario of [
    { name: "unconfirmed origin", status: "queued", sender: "editor@radio.example.test" },
    { name: "foreign sender", status: "sent", sender: "attacker@evil.example.test" }
  ]) {
    const inbox = {
      id: `inbox-${scenario.name}`,
      created_at: "2026-07-15T09:30:00.000Z",
      external_id: `external-${scenario.name}`,
      event_type: "inbound",
      payload: {
        "event-data": {
          event: "inbound",
          sender: scenario.sender,
          subject: "Re: Northern Lights",
          "body-plain": "Please send the WAV file.",
          "In-Reply-To": "<send-0@mail.example.test>",
          "Message-Id": `<reply-${scenario.status}@radio.example.test>`
        }
      }
    };
    const stateChanges = [];
    const processed = [];
    const queueItem = { ...sendQueueItem(0), status: scenario.status };
    const records = authoritativeRecords("Sent 1");
    const repository = {
      async readEvent() { return inbox; },
      async findSendByMessageId() { return queueItem; },
      async getSend() { return queueItem; },
      async markEventProcessed(id) { processed.push(id); },
      async cancelPendingForMatch(...args) { stateChanges.push(["cancel-match", ...args]); },
      async recordOutcome(...args) { stateChanges.push(["outcome", ...args]); },
      async enqueueResponse(...args) { stateChanges.push(["response", ...args]); },
      async releaseAllocation(...args) { stateChanges.push(["release", ...args]); }
    };
    const espocrm = {
      async get(entityType) { return records[entityType]; },
      async updateConditional(...args) { stateChanges.push(["update", ...args]); },
      async upsertByUnique(...args) { stateChanges.push(["upsert", ...args]); }
    };
    const service = createEventService({
      espocrm,
      repository,
      config: configFixture(),
      logger,
      metrics: new Metrics()
    });

    await service.processMailgunEvent({ payload: { eventInboxId: inbox.id } });

    assert.deepEqual(stateChanges, [], scenario.name);
    assert.deepEqual(processed, [inbox.id], scenario.name);
  }
});

test("inbound reply replay keeps the persisted inbox time after a post-projection crash", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2030-01-01T00:00:00.000Z") });
  const inbox = {
    id: "inbox-replay-stable-time",
    external_id: "mailgun-replay-stable-time",
    event_type: "inbound",
    created_at: "2026-07-15T09:30:00.000Z",
    payload: {
      "event-data": {
        event: "inbound",
        sender: "editor@radio.example.test",
        recipient: "replies@mail.example.test",
        subject: "Re: Northern Lights",
        "stripped-text": "We added the track to rotation.",
        "In-Reply-To": "<send-0@mail.example.test>",
        "Message-Id": "<reply-replay@radio.example.test>"
      }
    }
  };
  const queueItem = { ...sendQueueItem(0), status: "sent" };
  const records = authoritativeRecords("Sent 1");
  let failCompletion = true;
  let immutableEvent;
  let immutableIncomingEmail;
  const work = new Map();
  const repository = {
    async readEvent() { return inbox; },
    async findSendByMessageId() { return queueItem; },
    async isSuppressed() { return false; },
    async cancelPendingForMatch() {},
    async releaseAllocation() {},
    async recordOutcome() {},
    async enqueueWork(value) { work.set(value.dedupeKey, value); },
    async markEventProcessed() {
      if (failCompletion) {
        failCompletion = false;
        throw Object.assign(new Error("simulated crash after CRM projection"), { code: "SIMULATED_CRASH" });
      }
    }
  };
  const espocrm = {
    async get(entityType) { return records[entityType]; },
    async updateConditional(entityType, id, patch, versionNumber) {
      assert.equal(entityType, "OutreachMatch");
      records.OutreachMatch = { ...records.OutreachMatch, ...patch, id, versionNumber: versionNumber + 1 };
      return records.OutreachMatch;
    },
    async upsertByUnique(entityType, _attribute, _value, payload) {
      if (entityType === "Email") {
        if (immutableIncomingEmail) {
          assert.deepEqual(payload, immutableIncomingEmail, "replay must reproduce the inbound Email projection byte-for-byte");
        } else {
          immutableIncomingEmail = structuredClone(payload);
        }
        return { id: "email-replay", ...payload };
      }
      assert.equal(entityType, "OutreachEvent");
      if (immutableEvent) assert.deepEqual(payload, immutableEvent, "replay must reproduce the immutable receipt byte-for-byte");
      else immutableEvent = structuredClone(payload);
      return { id: "event-replay", ...payload };
    }
  };
  const service = createEventService({ espocrm, repository, config: configFixture(), logger, metrics: new Metrics() });

  await assert.rejects(
    () => service.processMailgunEvent({ payload: { eventInboxId: inbox.id } }),
    (error) => error.code === "SIMULATED_CRASH"
  );
  t.mock.timers.tick(86_400_000);
  await service.processMailgunEvent({ payload: { eventInboxId: inbox.id } });

  assert.equal(immutableEvent.eventDate, "2026-07-15 09:30:00");
  assert.equal(immutableIncomingEmail.to, "replies@mail.example.test");
  assert.equal(immutableIncomingEmail.dateSent, "2026-07-15 09:30:00");
  const businessProjection = [...work.values()].find(({ kind }) => kind === "project_reply_business_action");
  assert.equal(businessProjection.payload.replyAt, "2026-07-15T09:30:00.000Z");
});

test("an out-of-order reply cannot overwrite an existing deny-wins opt-out", async () => {
  const inbox = {
    id: "inbox-after-opt-out",
    created_at: "2026-07-15T09:30:00.000Z",
    external_id: "reply-after-opt-out",
    event_type: "inbound",
    payload: {
      "event-data": {
        event: "inbound",
        sender: "editor@radio.example.test",
        recipient: "replies@mail.example.test",
        subject: "Re: Northern Lights",
        "stripped-text": "Love this track.",
        "In-Reply-To": "<send-0@mail.example.test>",
        "Message-Id": "<reply-after-opt-out@radio.example.test>"
      }
    }
  };
  const queueItem = { ...sendQueueItem(0), status: "sent" };
  const records = authoritativeRecords("Unsubscribed");
  records.MediaContact = { ...records.MediaContact, optedOut: true, doNotContact: true, status: "Blocked" };
  const mutations = [];
  const incomingProjections = [];
  const repository = {
    async readEvent() { return inbox; },
    async findSendByMessageId() { return queueItem; },
    async isSuppressed() { return true; },
    async markEventProcessed(id) { mutations.push(["processed", id]); },
    async cancelPendingForMatch(...args) { mutations.push(["cancel", ...args]); },
    async recordOutcome(...args) { mutations.push(["outcome", ...args]); },
    async enqueueResponse(...args) { mutations.push(["response", ...args]); }
  };
  const service = createEventService({
    espocrm: {
      async get(entityType) { return records[entityType]; },
      async updateConditional(...args) { mutations.push(["update", ...args]); },
      async upsertByUnique(entityType, attribute, value, payload) {
        if (entityType === "Email") {
          incomingProjections.push({ entityType, attribute, value, payload });
          return { id: "incoming-email-1", ...payload };
        }
        mutations.push(["upsert", entityType, attribute, value, payload]);
      }
    },
    repository,
    config: configFixture(),
    logger,
    metrics: new Metrics()
  });

  await service.processMailgunEvent({ payload: { eventInboxId: inbox.id } });

  assert.deepEqual(mutations, [["processed", inbox.id]]);
  assert.equal(incomingProjections.length, 1);
  assert.equal(incomingProjections[0].payload.to, "replies@mail.example.test");
});

test("ambiguous and no-submissions replies create durable human review without suppression or automatic response", async (t) => {
  for (const scenario of [
    { body: "Thanks for writing.", reviewType: "ambiguous_reply", classification: "Ambiguous" },
    { body: "clean instrumental WAV", reviewType: "ambiguous_reply", classification: "Ambiguous" },
    { body: "Please send the WAV, but this is not suitable for us.", reviewType: "ambiguous_reply", classification: "Ambiguous" },
    { body: "We are not accepting music submissions.", reviewType: "outlet_suppression_proposal", classification: "Not Accepting Music" }
  ]) {
    await t.test(scenario.classification, async () => {
      const inbox = {
        id: `inbox-${scenario.reviewType}`,
        created_at: "2026-07-15T09:30:00.000Z",
        external_id: `external-${scenario.reviewType}`,
        event_type: "inbound",
        payload: {
          "event-data": {
            event: "inbound",
            sender: "editor@radio.example.test",
            recipient: "replies@mail.example.test",
            subject: "Re: Northern Lights",
            "stripped-text": scenario.body,
            "In-Reply-To": "<send-0@mail.example.test>",
            "Message-Id": `<${scenario.reviewType}@radio.example.test>`
          }
        }
      };
      const queueItem = { ...sendQueueItem(0), status: "sent" };
      const records = authoritativeRecords("Sent 1");
      const calls = { reviews: [], responses: [], suppressions: [], updates: [], processed: [] };
      const repository = {
        async readEvent() { return inbox; },
        async findSendByMessageId() { return queueItem; },
        async isSuppressed() { return false; },
        async enqueueHumanReview(value) { calls.reviews.push(value); return "review-1"; },
        async cancelPendingForMatch() {},
        async releaseAllocation() {},
        async recordOutcome() {},
        async enqueueResponse(value) { calls.responses.push(value); },
        async suppress(value) { calls.suppressions.push(value); },
        async markEventProcessed(id) { calls.processed.push(id); }
      };
      const service = createEventService({
        espocrm: {
          async get(entityType) { return records[entityType]; },
          async updateConditional(entityType, id, patch) { calls.updates.push({ entityType, id, patch }); return { id, ...patch }; },
          async upsertByUnique() { return { id: "event-1" }; }
        },
        repository,
        config: configFixture(),
        logger,
        metrics: new Metrics()
      });

      await service.processMailgunEvent({ payload: { eventInboxId: inbox.id } });

      assert.equal(calls.reviews.length, 1);
      assert.equal(calls.reviews[0].reviewType, scenario.reviewType);
      assert.equal(calls.reviews[0].createdBy, "reply-policy-v2");
      assert.equal(calls.responses.length, 0);
      assert.equal(calls.suppressions.length, 0);
      assert.equal(calls.updates.some(({ entityType }) => entityType === "MediaOutlet" || entityType === "MediaContact"), false);
      assert.equal(calls.updates.find(({ entityType }) => entityType === "OutreachMatch")?.patch.campaignStatus, "Needs Attention");
      assert.deepEqual(calls.processed, [inbox.id]);
    });
  }
});

test("automatic responses require the exact confirmed originating send", async () => {
  for (const scenario of [
    {
      name: "origin belongs to another match",
      originatingSend: { id: "send-origin", status: "sent", match_id: "other-match" },
      to: "editor@radio.example.test",
      reason: "response_origin_not_confirmed"
    },
    {
      name: "recipient differs from the authoritative contact",
      originatingSend: { id: "send-origin", status: "sent", match_id: "match-1" },
      to: "attacker@evil.example.test",
      reason: "response_recipient_mismatch"
    }
  ]) {
    const responseItem = {
      id: `response-${scenario.reason}`,
      match_id: "match-1",
      release_id: "release-1",
      contact_id: "contact-1",
      outlet_id: "outlet-1",
      deterministic_message_id: `<${scenario.reason}@mail.example.test>`
    };
    const records = authoritativeRecords("Replied");
    const calls = { canceled: [], provider: 0 };
    const repository = {
      async claimResponse() { return responseItem; },
      async withSendAuthorizationFence(_identity, work) { return work(); },
      readResponsePayload() {
        return {
          originatingSendQueueId: "send-origin",
          to: scenario.to,
          subject: "Re: Northern Lights",
          bodyText: "Authorized response"
        };
      },
      async getSend() { return scenario.originatingSend; },
      async isSuppressed() { return false; },
      async cancelClaimedResponse(id, reason) { calls.canceled.push({ id, reason }); }
    };
    const service = createSendService({
      espocrm: { async get(entityType) { return records[entityType]; } },
      repository,
      mailgun: { async send() { calls.provider += 1; } },
      config: configFixture(),
      logger,
      metrics: new Metrics()
    });

    assert.deepEqual(await service.sendResponseOne("worker-1"), {
      processed: true,
      sent: false,
      reason: scenario.reason
    }, scenario.name);
    assert.deepEqual(calls.canceled, [{ id: responseItem.id, reason: scenario.reason }]);
    assert.equal(calls.provider, 0, scenario.name);
  }
});

test("an open durable circuit defers automatic responses without contacting the provider", async () => {
  const responseItem = {
    id: "response-circuit-open",
    match_id: "match-1",
    release_id: "release-1",
    contact_id: "contact-1",
    outlet_id: "outlet-1",
    locked_by: "worker-1",
    deterministic_message_id: "<response-circuit-open@mail.example.test>"
  };
  const records = authoritativeRecords("Replied");
  const calls = { deferred: [], provider: 0 };
  const repository = {
    async claimResponse() { return responseItem; },
    readResponsePayload() {
      return {
        originatingSendQueueId: "send-origin",
        to: "editor@radio.example.test",
        subject: "Re: Northern Lights",
        bodyText: "Authorized response"
      };
    },
    async withSendAuthorizationFence(_identity, work) { return work(); },
    async getSend() { return { id: "send-origin", status: "sent", match_id: "match-1" }; },
    async isSuppressed() { return false; },
    async authorizeClaimedResponse() { return { allowed: false, reason: "circuit_open" }; },
    async deferClaimedResponse(item, details) { calls.deferred.push({ item, details }); },
    async cancelClaimedResponse() { throw new Error("an open circuit must defer, not discard, an automatic response"); }
  };
  const service = createSendService({
    espocrm: { async get(entityType) { return records[entityType]; } },
    repository,
    mailgun: { async send() { calls.provider += 1; } },
    config: configFixture(),
    logger,
    metrics: new Metrics()
  });

  assert.deepEqual(await service.sendResponseOne("worker-1"), {
    processed: true,
    sent: false,
    reason: "circuit_open"
  });
  assert.equal(calls.provider, 0);
  assert.deepEqual(calls.deferred, [{
    item: responseItem,
    details: { code: "circuit_open", delaySeconds: 900 }
  }]);
});

test("a soft bounce stops the entire sequence without creating a permanent suppression", async () => {
  const queueItem = { ...sendQueueItem(1), status: "sent", provider_message_id: "provider-soft" };
  const inbox = {
    id: "soft-bounce-inbox",
    created_at: "2026-07-15T09:30:00.000Z",
    external_id: "soft-bounce-event",
    event_type: "failed",
    payload: {
      "event-data": {
        event: "failed",
        severity: "temporary",
        timestamp: 1_784_112_400,
        "delivery-status": { code: "421" },
        message: { headers: { "message-id": queueItem.provider_message_id } },
        "user-variables": { "send-queue-id": queueItem.id }
      }
    }
  };
  const records = authoritativeRecords("Follow-Up 1");
  const calls = { cancellations: [], updates: [], releases: [], suppressions: [], outcomes: [], processed: [] };
  const repository = {
    async readEvent() { return inbox; },
    async getSend() { return queueItem; },
    async findSendByMessageId() { return undefined; },
    async recordOutcome(value) { calls.outcomes.push(value); },
    async cancelPendingForMatch(id, reason) { calls.cancellations.push({ scope: "match", id, reason }); },
    async cancelPendingForContact(id, reason) { calls.cancellations.push({ scope: "contact", id, reason }); },
    async releaseAllocation(value) { calls.releases.push(value); },
    async suppress(value) { calls.suppressions.push(value); },
    async markEventProcessed(id) { calls.processed.push(id); }
  };
  const espocrm = {
    async get(entityType) { return records[entityType]; },
    async updateConditional(entityType, id, patch, versionNumber) {
      calls.updates.push({ entityType, id, patch, versionNumber });
      return { id, ...patch, versionNumber: versionNumber + 1 };
    },
    async upsertByUnique() { return { id: "soft-bounce-crm-event" }; }
  };
  const service = createEventService({
    espocrm,
    repository,
    config: configFixture(),
    logger,
    metrics: new Metrics()
  });

  await service.processMailgunEvent({ payload: { eventInboxId: inbox.id } });

  assert.equal(calls.outcomes[0].eventType, "soft_bounce");
  assert.deepEqual(calls.cancellations, [
    { scope: "match", id: "match-1", reason: "soft_bounce" },
    { scope: "contact", id: "contact-1", reason: "soft_bounce" }
  ]);
  assert.ok(calls.updates.some(({ entityType, patch }) => entityType === "OutreachMatch" && patch.campaignStatus === "Stopped" && patch.activeSequence === false));
  assert.ok(calls.updates.some(({ entityType, patch }) => entityType === "MediaContact" && patch.status === "Needs Validation" && patch.emailValidationStatus === "Risky"));
  assert.equal(calls.releases.length, 1);
  assert.equal(calls.releases[0].reason, "soft_bounce");
  assert.deepEqual(calls.suppressions, []);
  assert.deepEqual(calls.processed, [inbox.id]);
});

test("a Mailgun event cannot use a foreign queue id to mutate or suppress another delivery", async () => {
  const queueItem = {
    ...sendQueueItem(0),
    status: "sent",
    provider_message_id: "<expected-provider@mail.example.test>"
  };
  const inbox = {
    id: "forged-correlation-inbox",
    created_at: "2026-07-15T09:30:00.000Z",
    external_id: "forged-correlation-event",
    event_type: "failed",
    payload: {
      "event-data": {
        event: "failed",
        severity: "permanent",
        message: { headers: { "message-id": "<different-provider@mail.example.test>" } },
        "user-variables": { "send-queue-id": queueItem.id }
      }
    }
  };
  const calls = { outcomes: 0, suppressions: 0, processed: [] };
  const repository = {
    async readEvent() { return inbox; },
    async getSend() { return queueItem; },
    async findSendByMessageId() { throw new Error("a mismatched explicit queue id must not fall through"); },
    async recordOutcome() { calls.outcomes += 1; },
    async suppress() { calls.suppressions += 1; },
    async markEventProcessed(id) { calls.processed.push(id); }
  };
  const service = createEventService({
    espocrm: { async get() { throw new Error("forged provider correlation must be inert"); } },
    repository,
    config: configFixture(),
    logger,
    metrics: new Metrics()
  });

  await service.processMailgunEvent({ payload: { eventInboxId: inbox.id } });

  assert.deepEqual(calls, { outcomes: 0, suppressions: 0, processed: [inbox.id] });
});

test("structured AI selections outside every fact allowlist fall back to deterministic copy", async (t) => {
  const records = authoritativeRecords("Ready");
  const facts = buildCopyFacts({
    release: records.MusicRelease,
    contact: records.MediaContact,
    outlet: records.MediaOutlet
  });
  const invalidSelections = [
    { name: "invented evidence", selection: { evidenceId: "invented", genre: "Indie", tone: "warm", confidence: 0.99 } },
    { name: "invented genre", selection: { evidenceId: "contact-source", genre: "Synthwave", tone: "warm", confidence: 0.99 } },
    { name: "invented tone", selection: { evidenceId: "contact-source", genre: "Indie", tone: "salesy", confidence: 0.99 } }
  ];

  assert.deepEqual(validateProviderSelection({ evidenceId: "contact-source", genre: "indie", tone: "concise" }, facts), {
    valid: true,
    selection: { evidenceId: "contact-source", genre: "Indie", tone: "concise" }
  });

  for (const { name, selection } of invalidSelections) {
    await t.test(name, async () => {
      assert.equal(validateProviderSelection(selection, facts).valid, false);
      const artifacts = [];
      const service = createCopyService({
        repository: {
          async saveCopyArtifact(artifact) {
            artifacts.push(artifact);
            return `artifact-${name}`;
          }
        },
        copyProvider: { async generate() { return selection; } },
        releaseLinkChecker: { async assertReachable() {} },
        config: configFixture(),
        logger,
        metrics: new Metrics()
      });

      const result = await service.prepare({
        match: { id: "match-1" },
        release: records.MusicRelease,
        contact: records.MediaContact,
        outlet: records.MediaOutlet,
        sequenceStep: 0
      });

      assert.equal(result.providerAccepted, false);
      assert.equal(artifacts.length, 1);
      assert.equal(artifacts[0].templateVersion, "safe-template-v2");
      assert.equal(artifacts[0].validationStatus, "fallback");
      assert.ok(!artifacts[0].copy.bodyText.includes("invented"));
      assert.ok(!artifacts[0].copy.bodyText.includes("Synthwave"));
      assert.ok(!artifacts[0].copy.bodyText.includes("salesy"));
    });
  }
});

test("Espo conditional updates send an OCC header and reconcile ambiguous writes by reading back", async () => {
  const calls = [];
  const client = new EspoCrmClient({
    baseUrl: "https://crm.example.test",
    apiKey: "api-key",
    timeoutMs: 1_000,
    maxPageSize: 50
  }, {
    async fetch(url, options) {
      calls.push({ url, options });
      if (options.method === "PUT") throw new TypeError("socket closed after request write");
      return new Response(JSON.stringify({ id: "match-1", campaignStatus: "Sent 1", activeSequence: true, versionNumber: 8 }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    },
    async sleep() {}
  });

  const result = await client.updateConditional("OutreachMatch", "match-1", {
    campaignStatus: "Sent 1",
    activeSequence: true
  }, 7);

  assert.equal(result.versionNumber, 8);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.method, "PUT");
  assert.equal(calls[0].options.headers["X-Version-Number"], "7");
  assert.equal(calls[1].options.method, "GET");
  assert.match(calls[1].url, /attributeSelect=campaignStatus%2CactiveSequence%2CversionNumber/u);
});

test("Espo ambiguous writes remain retryable when read-after-write cannot confirm the payload", async () => {
  const client = new EspoCrmClient({
    baseUrl: "https://crm.example.test",
    apiKey: "api-key",
    timeoutMs: 1_000,
    maxPageSize: 50
  }, {
    async fetch(_url, options) {
      if (options.method === "PUT") throw new TypeError("socket closed after request write");
      return new Response(JSON.stringify({ id: "match-1", campaignStatus: "Ready", versionNumber: 8 }), { status: 200 });
    },
    async sleep() {}
  });

  await assert.rejects(
    client.updateConditional("OutreachMatch", "match-1", { campaignStatus: "Sent 1" }, 7),
    (error) => error.code === "ESPOCRM_UPDATE_UNCONFIRMED" && error.retryable === true
  );
});

test("external provider responses are byte-bounded and preserve ambiguous-send safety", async () => {
  const oversizedLength = String(5 * 1_024 * 1_024);
  const espo = new EspoCrmClient({
    baseUrl: "https://crm.example.test",
    apiKey: "api-key",
    timeoutMs: 1_000,
    maxPageSize: 50
  }, {
    async fetch() {
      return new Response("{}", { status: 200, headers: { "content-length": oversizedLength } });
    },
    async sleep() {}
  });
  await assert.rejects(espo.health(), (error) => error.code === "ESPOCRM_RESPONSE_TOO_LARGE" && error.retryable === false);

  const mailgun = new MailgunClient({
    baseUrl: "https://api.mailgun.test",
    domain: "mail.example.test",
    apiKey: "api-key",
    from: "MarcsMusic <music@mail.example.test>",
    replyTo: "reply@mail.example.test"
  }, {
    async fetch() {
      return new Response("{}", { status: 200, headers: { "content-length": "65537" } });
    }
  });
  await assert.rejects(mailgun.send({
    to: "editor@example.test",
    subject: "Subject",
    text: "Body",
    correlationId: "correlation-1",
    messageId: "<message-1@mail.example.test>"
  }), (error) => error.code === "MAILGUN_RESPONSE_TOO_LARGE" && error.deliveryUnknown === true && error.retryable === false);

  const copy = new HttpCopyProvider({
    enabled: true,
    url: "https://copy.example.test/generate",
    timeoutMs: 1_000
  }, {
    async fetch() {
      return new Response("x".repeat(65_537), { status: 200 });
    }
  });
  await assert.rejects(copy.generate({}), (error) => error.code === "COPY_PROVIDER_RESPONSE_TOO_LARGE" && error.retryable === false);
});

test("OutreachEvent unique upsert returns an existing immutable event without updating it", async () => {
  const calls = [];
  const client = new EspoCrmClient({
    baseUrl: "https://crm.example.test",
    apiKey: "api-key",
    timeoutMs: 1_000,
    maxPageSize: 50
  }, {
    async fetch(url, options) {
      calls.push({ url, options });
      assert.equal(options.method, "GET");
      return new Response(JSON.stringify({
        list: [{
          id: "event-1",
          externalEventId: "provider-event-1",
          eventType: "Delivered",
          details: "immutable-receipt",
          versionNumber: 3
        }]
      }), { status: 200 });
    },
    async sleep() {}
  });

  const result = await client.upsertByUnique("OutreachEvent", "externalEventId", "provider-event-1", {
    externalEventId: "provider-event-1",
    eventType: "Delivered",
    details: "immutable-receipt"
  });

  assert.equal(result.id, "event-1");
  assert.equal(result.details, "immutable-receipt");
  assert.equal(calls.length, 1);
  assert.equal(calls.some(({ options }) => ["POST", "PUT", "PATCH", "DELETE"].includes(options.method)), false);

  await assert.rejects(
    () => client.upsertByUnique("OutreachEvent", "externalEventId", "provider-event-1", {
      externalEventId: "provider-event-1",
      eventType: "Delivered",
      details: "attempted-overwrite"
    }),
    (error) => error.code === "ESPOCRM_IMMUTABLE_PROJECTION_MISMATCH" && error.retryable === false
  );
  assert.equal(calls.some(({ options }) => ["POST", "PUT", "PATCH", "DELETE"].includes(options.method)), false);
});

test("mutable unique upsert omits immutable identity fields from an existing record update", async () => {
  const calls = [];
  const client = new EspoCrmClient({
    baseUrl: "https://crm.example.test",
    apiKey: "api-key",
    timeoutMs: 1_000,
    maxPageSize: 50
  }, {
    async fetch(url, options) {
      calls.push({ url, options });
      if (options.method === "GET") {
        return new Response(JSON.stringify({
          list: [{ id: "report-1", reportDate: "2026-07-15", versionNumber: 4 }]
        }), { status: 200 });
      }
      assert.equal(options.method, "PUT");
      assert.deepEqual(JSON.parse(options.body), { status: "Final", failedJobs: 0 });
      return new Response(JSON.stringify({
        id: "report-1",
        reportDate: "2026-07-15",
        status: "Final",
        failedJobs: 0,
        versionNumber: 5
      }), { status: 200 });
    },
    async sleep() {}
  });

  const result = await client.upsertByUnique(
    "OutreachDailyReport",
    "reportDate",
    "2026-07-15",
    { reportDate: "2026-07-15", status: "Final", failedJobs: 0 }
  );

  assert.equal(result.versionNumber, 5);
  assert.equal(calls.length, 2);
});

test("unique upsert selects and rejects conflicting identity for every guarded projection entity", async () => {
  const cases = [
    {
      entityType: "MusicRelease",
      attribute: "isrc",
      value: "NLAAA2699901",
      identityFields: ["isrc"],
      payload: { isrc: "NLAAA2699901", status: "Draft" },
      conflictField: "isrc",
      conflictValue: "NLAAA2699999"
    },
    {
      entityType: "MediaOutlet",
      attribute: "fingerprint",
      value: "outlet-fingerprint-1",
      identityFields: ["fingerprint"],
      payload: { fingerprint: "outlet-fingerprint-1", name: "Expected outlet" },
      conflictField: "fingerprint",
      conflictValue: "outlet-fingerprint-conflict"
    },
    {
      entityType: "OutreachMatch",
      attribute: "idempotencyKey",
      value: "release-1:contact-1",
      identityFields: ["musicReleaseId", "mediaContactId", "mediaOutletId", "idempotencyKey"],
      payload: {
        musicReleaseId: "release-1",
        mediaContactId: "contact-1",
        mediaOutletId: "outlet-1",
        idempotencyKey: "release-1:contact-1",
        matchScore: 90
      },
      conflictField: "mediaContactId",
      conflictValue: "contact-attacker"
    },
    {
      entityType: "OutreachSuppression",
      attribute: "subjectHash",
      value: "subject-hash-1",
      identityFields: ["subjectHash", "subjectType", "emailAddress", "domain", "mediaContactId", "mediaOutletId"],
      payload: {
        subjectHash: "subject-hash-1",
        subjectType: "contact",
        emailAddress: null,
        domain: null,
        mediaContactId: "contact-1",
        mediaOutletId: null,
        active: true
      },
      conflictField: "mediaContactId",
      conflictValue: "contact-attacker"
    },
    {
      entityType: "OutreachDailyReport",
      attribute: "reportDate",
      value: "2026-07-15",
      identityFields: ["reportDate"],
      payload: { reportDate: "2026-07-15", status: "Final" },
      conflictField: "reportDate",
      conflictValue: "2026-07-14"
    },
    {
      entityType: "TargetList",
      attribute: "outreachProjectionKey",
      value: "music-release:release-1",
      identityFields: ["outreachProjectionKey", "musicReleaseId"],
      payload: { outreachProjectionKey: "music-release:release-1", musicReleaseId: "release-1", name: "Target" },
      conflictField: "musicReleaseId",
      conflictValue: "release-attacker"
    },
    {
      entityType: "Campaign",
      attribute: "outreachProjectionKey",
      value: "music-release:release-1",
      identityFields: ["outreachProjectionKey", "musicReleaseId"],
      payload: { outreachProjectionKey: "music-release:release-1", musicReleaseId: "release-1", name: "Campaign" },
      conflictField: "musicReleaseId",
      conflictValue: "release-attacker"
    },
    {
      entityType: "Email",
      attribute: "outreachProjectionKey",
      value: "send:queue-1",
      identityFields: [
        "outreachProjectionKey", "outreachCorrelationId", "outreachProviderMessageId",
        "outreachDeterministicMessageId", "outreachAcceptedAt", "outreachAutomaticResponse",
        "outreachMatchId", "outreachCampaignId", "musicReleaseId", "mediaContactId", "mediaOutletId"
      ],
      payload: {
        outreachProjectionKey: "send:queue-1",
        outreachCorrelationId: "correlation-1",
        outreachProviderMessageId: "provider-1",
        outreachDeterministicMessageId: "<queue-1@example.test>",
        outreachAcceptedAt: "2026-07-15 09:30:00",
        outreachAutomaticResponse: false,
        outreachMatchId: "match-1",
        outreachCampaignId: "campaign-1",
        musicReleaseId: "release-1",
        mediaContactId: "contact-1",
        mediaOutletId: "outlet-1",
        status: "Sent"
      },
      conflictField: "mediaContactId",
      conflictValue: "contact-attacker"
    },
    {
      entityType: "Opportunity",
      attribute: "outreachProjectionKey",
      value: "match:match-1",
      identityFields: [
        "outreachProjectionKey", "outreachMatchId", "musicReleaseId", "mediaContactId",
        "mediaOutletId", "sourceOutreachEventId"
      ],
      payload: {
        outreachProjectionKey: "match:match-1",
        outreachMatchId: "match-1",
        musicReleaseId: "release-1",
        mediaContactId: "contact-1",
        mediaOutletId: "outlet-1",
        sourceOutreachEventId: "event-1",
        stage: "Prospecting"
      },
      conflictField: "outreachMatchId",
      conflictValue: "match-attacker"
    },
    {
      entityType: "OutreachEvent",
      attribute: "externalEventId",
      value: "event-key-1",
      identityFields: [
        "outreachMatchId", "mediaContactId", "musicReleaseId", "mediaOutletId",
        "campaignId", "emailId", "externalEventId"
      ],
      payload: {
        outreachMatchId: "match-1",
        mediaContactId: "contact-1",
        musicReleaseId: "release-1",
        mediaOutletId: "outlet-1",
        campaignId: "campaign-1",
        emailId: "email-1",
        externalEventId: "event-key-1",
        eventType: "Sent"
      },
      conflictField: "outreachMatchId",
      conflictValue: "match-attacker"
    }
  ];

  for (const scenario of cases) {
    let calls = 0;
    const client = new EspoCrmClient({
      baseUrl: "https://crm.example.test",
      apiKey: "api-key",
      timeoutMs: 1_000,
      maxPageSize: 50
    }, {
      async fetch(url, options) {
        calls += 1;
        assert.equal(options.method, "GET", `${scenario.entityType} must fail before a write`);
        const searchParams = JSON.parse(new URL(url).searchParams.get("searchParams"));
        for (const field of scenario.identityFields) {
          assert.ok(searchParams.select.includes(field), `${scenario.entityType} lookup omitted ${field}`);
        }
        return new Response(JSON.stringify({
          list: [{
            id: `${scenario.entityType.toLowerCase()}-1`,
            versionNumber: 3,
            ...scenario.payload,
            [scenario.conflictField]: scenario.conflictValue
          }]
        }), { status: 200 });
      },
      async sleep() {}
    });

    await assert.rejects(
      () => client.upsertByUnique(scenario.entityType, scenario.attribute, scenario.value, scenario.payload),
      (error) => error.code === "ESPOCRM_PROJECTION_IDENTITY_MISMATCH" &&
        error.retryable === false && error.details?.field === scenario.conflictField,
      scenario.entityType
    );
    assert.equal(calls, 1);
  }
});

test("projection identity comparison canonicalizes ISRC, email address and domain without weakening exact IDs", async () => {
  const calls = [];
  const records = [
    {
      id: "release-1",
      isrc: "NLAAA2699902",
      versionNumber: 1
    },
    {
      id: "suppression-1",
      subjectHash: "subject-hash-2",
      subjectType: "email",
      emailAddress: "editor@example.test",
      domain: null,
      mediaContactId: null,
      mediaOutletId: null,
      versionNumber: 2
    }
  ];
  const client = new EspoCrmClient({
    baseUrl: "https://crm.example.test",
    apiKey: "api-key",
    timeoutMs: 1_000,
    maxPageSize: 50
  }, {
    async fetch(_url, options) {
      calls.push(options.method);
      if (options.method === "GET") {
        return new Response(JSON.stringify({ list: [records.shift()] }), { status: 200 });
      }
      return new Response(JSON.stringify({ id: "updated", versionNumber: 3 }), { status: 200 });
    },
    async sleep() {}
  });

  await client.upsertByUnique("MusicRelease", "isrc", "nl-aaa-26-99902", {
    isrc: "NL AAA 26 99902",
    status: "Draft"
  });
  await client.upsertByUnique("OutreachSuppression", "subjectHash", "subject-hash-2", {
    subjectHash: "subject-hash-2",
    subjectType: "email",
    emailAddress: " Editor@Example.Test ",
    domain: null,
    mediaContactId: null,
    mediaOutletId: null,
    active: true
  });

  assert.deepEqual(calls, ["GET", "PUT", "GET", "PUT"]);
});

test("suppression synchronization enforces one exact subject and its privacy hash", async () => {
  const suppressions = [];
  const repository = {
    suppressionHash(subjectType, subject) { return `hash:${subjectType}:${subject}`; },
    async suppress(value) { suppressions.push(value); }
  };
  const service = createEventService({
    espocrm: {},
    repository,
    config: configFixture(),
    logger,
    metrics: new Metrics()
  });

  await service.syncSuppression("suppression-valid", {
    id: "suppression-valid",
    active: true,
    subjectType: "email",
    emailAddress: " Editor@Radio.Example.Test ",
    subjectHash: "hash:email:editor@radio.example.test",
    reason: "manual_block",
    source: "espocrm"
  });
  assert.deepEqual(suppressions, [{
    subjectType: "email",
    subject: "editor@radio.example.test",
    reason: "manual_block",
    source: "espocrm"
  }]);

  await assert.rejects(
    service.syncSuppression("suppression-multiple", {
      active: true,
      subjectType: "contact",
      mediaContactId: "contact-1",
      emailAddress: "editor@radio.example.test",
      subjectHash: "hash:contact:contact-1"
    }),
    (error) => error.code === "SUPPRESSION_SUBJECT_CONTRACT_INVALID" && error.retryable === false
  );
  await assert.rejects(
    service.syncSuppression("suppression-hash-mismatch", {
      active: true,
      subjectType: "domain",
      domain: "radio.example.test",
      subjectHash: "wrong-hash"
    }),
    (error) => error.code === "SUPPRESSION_HASH_CONTRACT_INVALID" && error.retryable === false
  );
  assert.equal(suppressions.length, 1);
});
