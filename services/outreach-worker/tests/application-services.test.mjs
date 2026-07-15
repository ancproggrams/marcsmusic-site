import test from "node:test";
import assert from "node:assert/strict";

import { createDailyReportService } from "../src/application/daily-report-service.mjs";
import { createEventService } from "../src/application/event-service.mjs";
import { createHealthService } from "../src/application/health-service.mjs";
import { createReconcileService } from "../src/application/reconcile-service.mjs";
import { createSendService } from "../src/application/send-service.mjs";
import { createWorkService } from "../src/application/work-service.mjs";
import { Metrics } from "../src/infrastructure/metrics.mjs";

const logger = Object.freeze({
  info() {},
  warn() {},
  error() {}
});

function sendConfig(overrides = {}) {
  return Object.freeze({
    safety: Object.freeze({
      killSwitch: false,
      sendEnabled: true,
      dailySendLimit: 25,
      domainDailyLimit: 2,
      ...overrides
    }),
    mailgun: Object.freeze({ domain: "mail.example.test" })
  });
}

test("send and automatic-response queues fail closed before claiming work", async () => {
  for (const safety of [
    { killSwitch: true, sendEnabled: true },
    { killSwitch: false, sendEnabled: false }
  ]) {
    const calls = { claimSend: 0, claimResponse: 0, mailgun: 0 };
    const repository = {
      async claimSend() {
        calls.claimSend += 1;
        throw new Error("a disabled sender must not claim a message");
      },
      async claimResponse() {
        calls.claimResponse += 1;
        throw new Error("a disabled sender must not claim a response");
      }
    };
    const service = createSendService({
      espocrm: {},
      repository,
      mailgun: { async send() { calls.mailgun += 1; } },
      config: sendConfig(safety),
      logger,
      metrics: new Metrics()
    });

    assert.deepEqual(await service.sendOne("worker-1"), { processed: false, reason: "sending_disabled" });
    assert.deepEqual(await service.sendResponseOne("worker-1"), { processed: false, reason: "sending_disabled" });
    assert.deepEqual(calls, { claimSend: 0, claimResponse: 0, mailgun: 0 });
  }
});

test("a follow-up cannot send until the previous CRM sequence state is confirmed", async () => {
  const queueItem = Object.freeze({
    id: "send-1",
    match_id: "match-1",
    release_id: "release-1",
    contact_id: "contact-1",
    outlet_id: "outlet-1",
    copy_artifact_id: "copy-1",
    deterministic_message_id: "<send-1@mail.example.test>",
    sequence_step: 1,
    attempts: 1
  });
  const deferrals = [];
  let providerCalls = 0;
  let capacityCalls = 0;
  const records = {
    OutreachMatch: { id: "match-1", campaignStatus: "Ready" },
    MusicRelease: { id: "release-1", status: "Active", epkUrl: "https://artist.example.test/epk" },
    MediaContact: {
      id: "contact-1",
      status: "Active",
      emailAddress: "editor@radio.example.test",
      emailValidationStatus: "Valid",
      contactPurpose: "Explicit Music Submission",
      contactBasis: "Explicit Submission Address",
      contactSourceUrl: "https://radio.example.test/submissions",
      contactEvidence: "Music submissions are accepted by email."
    },
    MediaOutlet: {
      id: "outlet-1",
      website: "https://radio.example.test",
      activityStatus: "Active",
      submissionPolicy: "Explicit",
      acceptsEmail: true
    }
  };
  const repository = {
    async claimSend() { return queueItem; },
    async withSendAuthorizationFence(_identity, work) { return work(); },
    async readCopyArtifact() { return { subject: "Follow-up", bodyText: "A safe follow-up." }; },
    async reserveSendCapacity() { capacityCalls += 1; return { allowed: true }; },
    async beginDeliveryAttempt() { throw new Error("preflight must not create a provider attempt"); },
    async deferClaimedSend(item, details) { deferrals.push({ item, details }); },
    async markPreflightFailure(_item, failure) { throw new Error(`unexpected preflight ${failure.code}`); }
  };
  const service = createSendService({
    espocrm: { async get(entityType) { return records[entityType]; } },
    repository,
    contactIntakeRepository: { async getEvidenceAttestation() { return undefined; } },
    mailgun: { async send() { providerCalls += 1; return { id: "provider-1" }; } },
    config: sendConfig(),
    logger,
    metrics: new Metrics()
  });

  const result = await service.sendOne("worker-1");

  assert.deepEqual(result, { processed: true, sent: false, error: "PREVIOUS_SEQUENCE_STEP_NOT_CONFIRMED" });
  assert.equal(providerCalls, 0);
  assert.equal(capacityCalls, 0);
  assert.equal(deferrals.length, 1);
  assert.equal(deferrals[0].item, queueItem);
  assert.deepEqual(deferrals[0].details, {
    code: "PREVIOUS_SEQUENCE_STEP_NOT_CONFIRMED",
    delaySeconds: 60
  });
});

test("terminal match and suppression webhooks cancel pending sends before acknowledging the inbox event", async () => {
  const inboxes = new Map([
    ["terminal-event", {
      id: "terminal-event",
      external_id: "espo-terminal-1",
      event_type: "OutreachMatch.updated",
      entity_type: "OutreachMatch",
      entity_id: "match-1",
      payload: { event: "OutreachMatch.updated", record: { id: "match-1", campaignStatus: "Replied" } }
    }],
    ["suppression-event", {
      id: "suppression-event",
      external_id: "espo-suppression-1",
      event_type: "OutreachSuppression.created",
      entity_type: "OutreachSuppression",
      entity_id: "suppression-1",
      payload: {
        event: "OutreachSuppression.created",
        record: {
          id: "suppression-1",
          active: true,
          subjectType: "contact",
          mediaContactId: "contact-1",
          reason: "manual_block",
          source: "espocrm"
        }
      }
    }]
  ]);
  const calls = { matchCancellations: [], contactCancellations: [], suppressions: [], processed: [] };
  const repository = {
    async readEvent(id) { return inboxes.get(id); },
    async cancelPendingForMatch(matchId, reason) { calls.matchCancellations.push({ matchId, reason }); },
    async cancelPendingForContact(contactId, reason) { calls.contactCancellations.push({ contactId, reason }); },
    async suppress(value) { calls.suppressions.push(value); return "privacy-hash"; },
    async markEventProcessed(id) { calls.processed.push(id); },
    async enqueueWork() { throw new Error("these event types must not enqueue matching work"); }
  };
  const service = createEventService({
    espocrm: {},
    repository,
    config: { mailgun: { domain: "mail.example.test" } },
    logger,
    metrics: new Metrics()
  });

  await service.processEspoEvent({ payload: { eventInboxId: "terminal-event" } });
  await service.processEspoEvent({ payload: { eventInboxId: "suppression-event" } });

  assert.deepEqual(calls.matchCancellations, [{ matchId: "match-1", reason: "match_replied" }]);
  assert.deepEqual(calls.suppressions, [{
    subjectType: "contact",
    subject: "contact-1",
    reason: "manual_block",
    source: "espocrm"
  }]);
  assert.deepEqual(calls.contactCancellations, [{ contactId: "contact-1", reason: "manual_block" }]);
  assert.deepEqual(calls.processed, ["terminal-event", "suppression-event"]);
});

test("a permanent Mailgun failure creates a hard-bounce outcome and deny-wins suppression", async () => {
  const queueItem = Object.freeze({
    id: "send-1",
    match_id: "match-1",
    release_id: "release-1",
    contact_id: "contact-1",
    outlet_id: "outlet-1",
    provider_message_id: "<provider-1@mail.example.test>"
  });
  const inbox = {
    id: "mailgun-event-1",
    external_id: "provider-event-1",
    event_type: "failed",
    payload: {
      "event-data": {
        event: "failed",
        severity: "permanent",
        timestamp: 1_784_112_400,
        "delivery-status": { code: "550" },
        message: { headers: { "message-id": "<provider-1@mail.example.test>" } },
        "user-variables": { "send-queue-id": "send-1" }
      }
    }
  };
  const calls = { outcomes: [], suppressions: [], cancellations: [], processed: [], upserts: [], updates: [] };
  const repository = {
    async readEvent() { return inbox; },
    async getSend(id) { assert.equal(id, "send-1"); return queueItem; },
    async findSendByMessageId() { return undefined; },
    async recordOutcome(value) { calls.outcomes.push(value); },
    async suppress(value) { calls.suppressions.push(value); return `hash-${value.subjectType}`; },
    async cancelPendingForContact(contactId, reason) { calls.cancellations.push({ type: "contact", contactId, reason }); },
    async cancelPendingForMatch(matchId, reason) { calls.cancellations.push({ type: "match", matchId, reason }); },
    async markEventProcessed(id) { calls.processed.push(id); }
  };
  const espocrm = {
    async get(entityType, id) {
      if (entityType === "MediaContact") {
        assert.equal(id, "contact-1");
        return { id, name: "Editor", emailAddress: "editor@radio.example.test" };
      }
      assert.equal(entityType, "OutreachMatch");
      assert.equal(id, "match-1");
      return { id, campaignStatus: "Sent 1" };
    },
    async upsertByUnique(...args) { calls.upserts.push(args); return { id: `${args[0]}-1` }; },
    async update(entityType, id, patch) { calls.updates.push({ entityType, id, patch }); }
  };
  const service = createEventService({
    espocrm,
    repository,
    config: { mailgun: { domain: "mail.example.test" } },
    logger,
    metrics: new Metrics()
  });

  await service.processMailgunEvent({ payload: { eventInboxId: inbox.id } });

  assert.equal(calls.outcomes.length, 1);
  assert.equal(calls.outcomes[0].eventType, "hard_bounce");
  assert.equal(calls.outcomes[0].providerEventId, "provider-event-1");
  assert.deepEqual(calls.suppressions.map(({ subjectType, subject, reason }) => ({ subjectType, subject, reason })), [
    { subjectType: "contact", subject: "contact-1", reason: "hard_bounce" },
    { subjectType: "email", subject: "editor@radio.example.test", reason: "hard_bounce" }
  ]);
  assert.ok(calls.cancellations.some((call) => call.type === "match" && call.reason === "hard_bounce"));
  assert.ok(calls.cancellations.some((call) => call.type === "contact" && call.reason === "hard_bounce"));
  assert.ok(calls.updates.some((call) => call.entityType === "MediaContact" && call.patch.hardBounced === true && call.patch.status === "Blocked"));
  assert.ok(calls.updates.some((call) => call.entityType === "OutreachMatch" && call.patch.campaignStatus === "Stopped" && call.patch.activeSequence === false));
  assert.ok(calls.upserts.some(([entityType, uniqueField, externalId]) => entityType === "OutreachEvent" && uniqueField === "externalEventId" && externalId === "provider-event-1"));
  assert.ok(calls.upserts.some(([entityType]) => entityType === "OutreachSuppression"));
  assert.deepEqual(calls.processed, [inbox.id]);
});

test("reconciliation advances the watermark only after every entity route succeeds", async () => {
  const now = new Date("2026-07-15T12:00:00.000Z");
  const previous = "2026-07-15T10:00:00.000Z";

  async function runFixture({ failOn }) {
    const calls = { enqueued: [], watermarks: [], workflows: [] };
    const repository = {
      async getWatermark() { return previous; },
      async startWorkflow(name, correlationId, from, to) {
        calls.workflows.push({ phase: "start", name, correlationId, from, to });
        return "run-1";
      },
      async enqueueWork(value) { calls.enqueued.push(value); },
      async setWatermark(name, value) { calls.watermarks.push({ name, value }); },
      async finishWorkflow(id, result) { calls.workflows.push({ phase: "finish", id, result }); }
    };
    const espocrm = {
      async listModifiedSince(entityType) {
        if (entityType === failOn) throw Object.assign(new Error("Espo temporarily unavailable"), { code: "ESPO_UNAVAILABLE" });
        return entityType === "MusicRelease" ? [{ id: "release-1", modifiedAt: "2026-07-15 11:00:00" }] : [];
      }
    };
    const service = createReconcileService({
      espocrm,
      repository,
      config: { schedules: { reconcileOverlapMinutes: 10 } },
      logger,
      metrics: new Metrics()
    });
    return { service, calls };
  }

  const succeeded = await runFixture({});
  const result = await succeeded.service.run({ now });
  assert.equal(result.succeeded, true);
  assert.deepEqual(succeeded.calls.watermarks, [{ name: "espocrm-business-records", value: now }]);
  assert.equal(succeeded.calls.workflows.at(-1).result.succeeded, true);
  assert.equal(succeeded.calls.enqueued.length, 1);

  const failed = await runFixture({ failOn: "MediaOutlet" });
  await assert.rejects(failed.service.run({ now }), (error) => error.code === "ESPO_UNAVAILABLE");
  assert.deepEqual(failed.calls.watermarks, []);
  assert.equal(failed.calls.workflows.at(-1).result.succeeded, false);
  assert.equal(failed.calls.workflows.at(-1).result.errorCode, "ESPO_UNAVAILABLE");
});

test("health evaluation opens the safety circuit when a sufficiently large window is harmful", async () => {
  const calls = { circuits: [] };
  let circuit = { state: "closed" };
  const repository = {
    async quarantineStaleDeliveryClaims() { return { sends: 1, responses: 2 }; },
    async healthWindow() { return { sent: 20, harmful: 2, failed: 4 }; },
    async setCircuit(value) { calls.circuits.push(value); circuit = { state: value.open ? "open" : "closed" }; },
    async getCircuit() { return circuit; }
  };
  const service = createHealthService({
    repository,
    config: { safety: { minHealthSample: 10, maxBounceRate: 0.05, maxFailureRate: 0.1 } },
    logger,
    metrics: new Metrics()
  });

  const result = await service.evaluate();

  assert.deepEqual(result.reasons, ["harmful_rate_exceeded", "failure_rate_exceeded"]);
  assert.equal(result.circuitState, "open");
  assert.equal(result.harmfulRate, 0.1);
  assert.equal(result.failureRate, 1 / 6);
  assert.deepEqual(calls.circuits, [{
    open: true,
    reason: "harmful_rate_exceeded,failure_rate_exceeded",
    pauseMinutes: 60
  }]);
});

test("a healthy window never closes an open safety circuit automatically", async () => {
  const calls = { circuits: [] };
  const circuit = {
    state: "open",
    reason: "harmful_rate_exceeded",
    paused_until: "2026-07-15T00:00:00.000Z"
  };
  const repository = {
    async quarantineStaleDeliveryClaims() { return { sends: 0, responses: 0, allocations: 0 }; },
    async healthWindow() { return { sent: 100, harmful: 0, failed: 0 }; },
    async operationalSnapshot() { return {}; },
    async setCircuit(value) { calls.circuits.push(value); },
    async getCircuit() { return circuit; }
  };
  const service = createHealthService({
    repository,
    config: { safety: { minHealthSample: 10, maxBounceRate: 0.05, maxFailureRate: 0.1 } },
    logger,
    metrics: new Metrics()
  });

  const result = await service.evaluate();

  assert.equal(result.circuitState, "open");
  assert.deepEqual(result.reasons, []);
  assert.deepEqual(calls.circuits, []);
});

test("daily reporting derives unique contact counts and persists one date-keyed CRM report", async () => {
  const calls = { aggregates: [], upserts: [] };
  const espocrm = {
    async aggregateDailyReport(window) {
      calls.aggregates.push(window);
      return {
        newContacts: 2,
        validatedContacts: 1,
        duplicateContacts: 1,
        eligibleContacts: 1,
        blockedContacts: 1,
        matchesCreated: 3
      };
    },
    async upsertByUnique(...args) { calls.upserts.push(args); return { id: "report-1" }; }
  };
  const repository = {
    async withDailyReportProjectionFence(_slot, work) { return { skipped: false, value: await work() }; },
    async summaryForDate() {
      return { initial_emails_sent: "3", follow_ups_sent: "2", replies_received: "2", positive_replies: "1", hard_bounces: "1", soft_bounces: "0", opt_outs: "1", placements: "1" };
    },
    async jobSummaryForDate() { return { failed_jobs: "4" }; }
  };
  const service = createDailyReportService({ espocrm, repository, logger, metrics: new Metrics() });

  const report = await service.generate({
    reportDate: "2026-07-15",
    scheduleSlot: "final-next-day-v1",
    slotRank: 2,
    now: new Date("2026-07-16T12:00:00.000Z")
  });

  assert.equal(report.reportDate, "2026-07-15");
  assert.equal(report.newContacts, 2);
  assert.equal(report.validatedContacts, 1);
  assert.equal(report.duplicateContacts, 1);
  assert.equal(report.eligibleContacts, 1);
  assert.equal(report.blockedContacts, 1);
  assert.equal(report.initialEmailsSent, 3);
  assert.equal(report.followUpsSent, 2);
  assert.equal(report.failedJobs, 4);
  assert.equal(report.status, "Final");
  assert.equal(report.generatedAt, "2026-07-16 12:00:00");
  assert.deepEqual(calls.upserts[0].slice(0, 3), ["OutreachDailyReport", "reportDate", "2026-07-15"]);
  assert.equal(calls.aggregates.length, 1, "daily reporting must use one server-side CRM aggregate");
  assert.deepEqual(calls.upserts[0][3].summary, {
    scheduleSlot: "final-next-day-v1",
    slotRank: 2,
    businessDayStart: "2026-07-14T22:00:00.000Z",
    businessDayEnd: "2026-07-15T22:00:00.000Z"
  });
});

test("work dispatch completes successful handlers and dead-letters unsupported work kinds", async () => {
  const completed = [];
  const failures = [];
  const queue = [
    { id: "work-1", kind: "health_check", attempts: 1, locked_by: "worker-1", lease_version: 1, payload: {} },
    { id: "work-2", kind: "made_up_kind", attempts: 1, locked_by: "worker-1", lease_version: 1, payload: {} }
  ];
  let healthChecks = 0;
  const repository = {
    async claimWork() { return queue.shift(); },
    async completeWork(item) { completed.push(item.id); return true; },
    async failWork(item, code, retryable) { failures.push({ item, code, retryable }); }
  };
  const workService = createWorkService({
    repository,
    matchService: {},
    eventService: {},
    sendService: {},
    dailyReportService: {},
    healthService: { async evaluate() { healthChecks += 1; } },
    espocrm: {},
    logger,
    metrics: new Metrics()
  });

  assert.deepEqual(await workService.processOne("worker-1"), { processed: true, kind: "health_check", succeeded: true });
  assert.deepEqual(await workService.processOne("worker-1"), { processed: true, kind: "made_up_kind", succeeded: false, error: "WORK_KIND_UNSUPPORTED" });
  assert.equal(healthChecks, 1);
  assert.deepEqual(completed, ["work-1"]);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].item.id, "work-2");
  assert.equal(failures[0].code, "WORK_KIND_UNSUPPORTED");
  assert.equal(failures[0].retryable, false);
});
