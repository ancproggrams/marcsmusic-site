import assert from "node:assert/strict";
import test from "node:test";

import { createOutcomeReconcileService } from "../src/application/outcome-reconcile-service.mjs";
import { createEventService } from "../src/application/event-service.mjs";
import { ConfigurationError, loadConfig } from "../src/config.mjs";
import { canonicalEspoEventId, canonicalMailgunEventId } from "../src/domain/provider-event-identity.mjs";
import { MailgunClient } from "../src/infrastructure/mailgun-client.mjs";
import { Metrics } from "../src/infrastructure/metrics.mjs";

const logger = Object.freeze({ info() {}, warn() {}, error() {} });

test("outcome reconciliation configuration is opt-in and requires a fail-closed reply recovery path", () => {
  const disabled = loadConfig(validEnvironment());
  assert.equal(disabled.outcomeReconcile.enabled, false);
  assert.equal(disabled.outcomeReconcile.replyRecoveryCapability, "external");

  assert.throws(
    () => loadConfig({
      ...validEnvironment(),
      OUTREACH_OUTCOME_RECONCILE_ENABLED: "true",
      OUTREACH_OUTCOME_RECONCILE_ESPO_EMAIL_ENABLED: "false",
      OUTREACH_OUTCOME_RECONCILE_MAILGUN_STORED_REPLIES_ENABLED: "false"
    }),
    (error) => error instanceof ConfigurationError
      && error.issues.some(({ path }) => path[0] === "OUTREACH_OUTCOME_RECONCILE_ESPO_EMAIL_ENABLED")
  );
  assert.throws(
    () => loadConfig({
      ...validEnvironment(),
      OUTREACH_OUTCOME_RECONCILE_ENABLED: "true",
      OUTREACH_OUTCOME_RECONCILE_MAILGUN_STORED_REPLIES_ENABLED: "true"
    }),
    (error) => error instanceof ConfigurationError
      && error.issues.some(({ path }) => path[0] === "MAILGUN_INBOUND_ROUTE_EVIDENCE")
  );
  assert.throws(
    () => loadConfig({
      ...validEnvironment(),
      OUTREACH_OUTCOME_RECONCILE_OVERLAP_SECONDS: "301"
    }),
    (error) => error instanceof ConfigurationError
  );

  const enabled = loadConfig({
    ...validEnvironment(),
    OUTREACH_OUTCOME_RECONCILE_ENABLED: "true",
    OUTREACH_OUTCOME_RECONCILE_MAILGUN_MODE: "logs"
  });
  assert.equal(enabled.outcomeReconcile.enabled, true);
  assert.equal(enabled.outcomeReconcile.overlapSeconds, 300);
  assert.equal(enabled.outcomeReconcile.replyRecoveryCapability, "espocrm_incoming_email");
});

test("Mailgun Logs recovery uses a fixed bounded domain+tag query and an opaque next token", async () => {
  const requests = [];
  const client = mailgunClient(async (url, init) => {
    requests.push({ url, init });
    return jsonResponse({
      items: [{
        id: "provider-event-1",
        event: "delivered",
        "@timestamp": "2026-07-15T10:00:00.000Z",
        domain: { name: "mail.example.test" },
        tags: ["marcsmusic-outreach"],
        message: { headers: { "message-id": "<send-1@mail.example.test>" } }
      }],
      pagination: { next: "opaque_token-2" }
    });
  });

  const page = await client.listOutcomeEvents({
    from: new Date("2026-07-15T09:55:00.000Z"),
    to: new Date("2026-07-15T10:05:00.000Z"),
    pageSize: 50,
    mode: "logs"
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://api.eu.mailgun.net/v1/analytics/logs");
  assert.equal(requests[0].init.redirect, "error");
  const body = JSON.parse(requests[0].init.body);
  assert.equal(body.start, "Wed, 15 Jul 2026 09:55:00 GMT");
  assert.equal(body.end, "Wed, 15 Jul 2026 10:05:00 GMT");
  assert.deepEqual(body.filter.AND.map(({ attribute, values }) => [attribute, values[0].value]), [
    ["domain", "mail.example.test"],
    ["tag", "marcsmusic-outreach"]
  ]);
  assert.deepEqual(body.events, ["accepted", "delivered", "failed", "complained", "unsubscribed", "stored"]);
  assert.equal(body.pagination.sort, "timestamp:asc");
  assert.equal(page.events.length, 1);
  assert.equal(page.nextPageToken, "opaque_token-2");
});

test("Mailgun recovery rejects cross-domain/tag events client-side before persistence", async () => {
  const client = mailgunClient(async () => jsonResponse({
    items: [
      {
        id: "wrong-domain",
        event: "delivered",
        "@timestamp": "2026-07-15T10:00:00.000Z",
        domain: { name: "other.example.test" },
        tags: ["marcsmusic-outreach"]
      },
      {
        id: "wrong-tag",
        event: "failed",
        "@timestamp": "2026-07-15T10:00:01.000Z",
        domain: { name: "mail.example.test" },
        tags: ["other-traffic"]
      }
    ],
    pagination: {}
  }));
  const page = await client.listOutcomeEvents({
    from: new Date("2026-07-15T09:00:00Z"),
    to: new Date("2026-07-15T11:00:00Z")
  });
  assert.equal(page.events.length, 0);
  assert.equal(page.rejected, 2);
});

test("stored reply retrieval rejects a malicious provider URL without making a request", async () => {
  let requests = 0;
  const client = mailgunClient(async () => {
    requests += 1;
    throw new Error("must not fetch an untrusted URL");
  });
  await assert.rejects(
    client.retrieveStoredMessage({
      id: "stored-1",
      event: "stored",
      storage: {
        key: "safe-key",
        url: "https://attacker.example/v3/domains/mail.example.test/messages/safe-key"
      }
    }),
    (error) => error.code === "MAILGUN_STORAGE_URL_REJECTED" && error.retryable === false
  );
  assert.equal(requests, 0);
});

test("stored reply retrieval is same-host/path bounded and normalizes only inbound processing fields", async () => {
  const requests = [];
  const client = mailgunClient(async (url, init) => {
    requests.push({ url, init });
    return jsonResponse({
      sender: "Editor <editor@radio.example>",
      recipient: "replies@mail.example.test",
      subject: "Re: New track",
      "body-plain": "Please send the WAV.",
      "message-headers": JSON.stringify([
        ["Message-Id", "<reply-1@radio.example>"],
        ["In-Reply-To", "<send-1@mail.example.test>"]
      ])
    });
  });
  const event = {
    id: "stored-1",
    event: "stored",
    timestamp: 1_784_111_400,
    domain: { name: "mail.example.test" },
    tags: ["marcsmusic-outreach"],
    storage: {
      key: "safe-key",
      url: "https://storage-europe-west1.api.mailgun.net/v3/domains/mail.example.test/messages/safe-key"
    }
  };
  const payload = await client.retrieveStoredMessage(event);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].init.redirect, "error");
  assert.equal(payload.event, "inbound");
  assert.equal(payload["In-Reply-To"], "<send-1@mail.example.test>");
  assert.equal(payload["Message-Id"], "<reply-1@radio.example>");
  assert.equal(payload.storage.key, "safe-key");
  assert.equal(Object.hasOwn(payload.storage, "url"), false);
});

test("missed Mailgun outcomes enter the same inbox and replay with the webhook identity", async () => {
  const event = Object.freeze({
    id: "mailgun-event-1",
    event: "delivered",
    timestamp: Date.parse("2026-07-15T11:00:00Z") / 1_000,
    domain: { name: "mail.example.test" },
    tags: ["marcsmusic-outreach"],
    message: { headers: { "message-id": "<send-1@mail.example.test>" } },
    "user-variables": {}
  });
  const harness = serviceHarness({
    runtime: { mailgunEnabled: true },
    mailgun: { async listOutcomeEvents() { return { events: [event], rejected: 0 }; } },
    findOutboundIdentity: async () => ({ queue_type: "send", id: "queue-1" })
  });
  await harness.service.run({ now: new Date("2026-07-15T11:10:00Z") });

  assert.equal(harness.inbox.length, 1);
  assert.equal(harness.inbox[0].externalId, canonicalMailgunEventId(event));
  assert.equal(harness.inbox[0].workKind, "process_mailgun_event");
  assert.equal(canonicalMailgunEventId(event), canonicalMailgunEventId({ id: event.id }, { timestamp: "forged", token: "ignored" }));
  assert.equal(harness.completions.length, 1);
});

test("missed stored replies are fetched only after provider filtering and a known outbound identity", async () => {
  const stored = Object.freeze({
    id: "stored-event-1",
    event: "stored",
    timestamp: Date.parse("2026-07-15T11:00:00Z") / 1_000,
    domain: { name: "mail.example.test" },
    tags: ["marcsmusic-outreach"],
    storage: { key: "safe-key" }
  });
  const harness = serviceHarness({
    runtime: { mailgunEnabled: true, mailgunStoredRepliesEnabled: true },
    mailgun: {
      async listOutcomeEvents() { return { events: [stored], rejected: 0 }; },
      async retrieveStoredMessage() {
        return {
          event: "inbound",
          id: stored.id,
          timestamp: stored.timestamp,
          "In-Reply-To": "<send-1@mail.example.test>",
          "Message-Id": "<reply-1@radio.example>",
          sender: "editor@radio.example",
          "body-plain": "Interested"
        };
      }
    },
    findOutboundIdentity: async () => ({ queue_type: "send", id: "queue-1" })
  });
  const result = await harness.service.run({ now: new Date("2026-07-15T11:10:00Z") });
  assert.equal(harness.inbox.length, 1);
  assert.equal(harness.inbox[0].eventType, "inbound");
  assert.equal(result.counters.storedRepliesRecovered, 1);
});

test("Espo Email.created uses one stable identity across webhook and poll", () => {
  const record = { id: "email-42", modifiedAt: "2026-07-15 11:00:00" };
  assert.equal(
    canonicalEspoEventId({ eventName: "Email.created", record, webhookId: "hook-a", bodyDigest: "digest-a", index: 1 }),
    canonicalEspoEventId({ eventName: "Email.created", record, webhookId: "poll", bodyDigest: "different", index: 99 })
  );
});

test("due non-terminal matches reconstruct missing schedule work but never terminal/replied work", async () => {
  const records = [
    dueMatch({ id: "due-1" }),
    dueMatch({ id: "replied", replyStatus: "Interested" }),
    dueMatch({ id: "terminal", campaignStatus: "Completed", currentSequenceStep: 2 })
  ];
  const recovered = [];
  const harness = serviceHarness({
    runtime: { dueMatchesEnabled: true },
    espocrm: {
      async *iterateModifiedBetween(entityType) {
        if (entityType === "OutreachMatch") yield records;
      },
      async get(entityType) {
        if (entityType === "MediaContact") return {
          id: "contact-1",
          emailAddress: "editor@radio.example",
          emailValidationStatus: "Valid",
          status: "Active"
        };
        return { id: "outlet-1", domain: "radio.example", activityStatus: "Active" };
      }
    },
    recoverDueSequenceStep: async (value) => { recovered.push(value); return { queued: true }; }
  });
  await harness.service.run({ now: new Date("2026-07-15T11:10:00Z") });
  assert.deepEqual(recovered, [{ matchId: "due-1", sequenceStep: 1 }]);
});

test("an accepted event only reconciles delivery_unknown through a second identity-bound repository fence", async () => {
  const queue = {
    id: "queue-unknown",
    match_id: "match-1",
    release_id: "release-1",
    contact_id: "contact-1",
    outlet_id: "outlet-1",
    deterministic_message_id: "<send-unknown@mail.example.test>",
    provider_message_id: null,
    status: "delivery_unknown"
  };
  const confirmations = [];
  const processed = [];
  const repository = {
    async readEvent() {
      return {
        id: "inbox-accepted",
        external_id: "accepted-event-hash",
        event_type: "accepted",
        created_at: "2026-07-15T11:00:00Z",
        payload: {
          event: "accepted",
          timestamp: Date.parse("2026-07-15T11:00:00Z") / 1_000,
          message: { headers: { "message-id": queue.deterministic_message_id } },
          "user-variables": { "send-queue-id": queue.id }
        }
      };
    },
    async getSend() { return queue; },
    async findSendByMessageId() { throw new Error("explicit queue identity should be sufficient"); },
    async markEventProcessed(id) { processed.push(id); }
  };
  const service = createEventService({
    espocrm: {},
    repository,
    outcomeReconcileRepository: {
      async confirmDeliveryUnknownAccepted(value) {
        confirmations.push(value);
        return { recovered: true, sendQueueId: queue.id };
      }
    },
    config: { mailgun: { domain: "mail.example.test", replyTo: "replies@mail.example.test" } },
    logger,
    metrics: new Metrics()
  });
  await service.processMailgunEvent({ payload: { eventInboxId: "inbox-accepted" } });
  assert.equal(confirmations.length, 1);
  assert.deepEqual(confirmations[0].messageIds, [queue.deterministic_message_id]);
  assert.equal(confirmations[0].providerEventId, "accepted-event-hash");
  assert.deepEqual(processed, ["inbox-accepted"]);
});

test("provider event dates reject nullish, boolean and blank boundary values", async (t) => {
  const cases = [
    ["null", null, undefined],
    ["undefined", undefined, undefined],
    ["false", false, undefined],
    ["true", true, undefined],
    ["empty", "", undefined],
    ["blank", "   ", undefined],
    ["boolean provider timestamp", null, true]
  ];

  for (const [label, createdAt, providerTimestamp] of cases) {
    await t.test(label, async () => {
      let processed = false;
      const service = createEventService({
        espocrm: {},
        repository: {
          async readEvent() {
            return {
              id: `invalid-date-${label}`,
              external_id: `invalid-date-${label}`,
              event_type: "delivered",
              created_at: createdAt,
              payload: { event: "delivered", timestamp: providerTimestamp }
            };
          },
          async findSendByMessageId() {
            throw new Error("date validation must run before correlation");
          },
          async markEventProcessed() { processed = true; }
        },
        config: { mailgun: { domain: "mail.example.test" } },
        logger,
        metrics: new Metrics()
      });

      await assert.rejects(
        service.processMailgunEvent({ payload: { eventInboxId: `invalid-date-${label}` } }),
        (error) => error.code === "PROVIDER_EVENT_DATE_MISSING" && error.retryable === false
      );
      assert.equal(processed, false);
    });
  }
});

test("direct Mailgun replies project one stable managed Received Email identity before classification", async () => {
  const emailProjections = [];
  const queue = {
    id: "00000000-0000-4000-8000-000000000111",
    match_id: "match-1",
    release_id: "release-1",
    contact_id: "contact-1",
    outlet_id: "outlet-1",
    deterministic_message_id: "<send-1@mail.example.test>",
    provider_message_id: "<provider-1@mail.example.test>",
    sequence_step: 0,
    status: "sent"
  };
  const inbox = {
    id: "inbox-reply",
    external_id: "reply-provider-event-hash",
    event_type: "inbound",
    created_at: "2026-07-15T11:00:00Z",
    payload: {
      event: "inbound",
      timestamp: Date.parse("2026-07-15T11:00:00Z") / 1_000,
      recipient: "replies@mail.example.test",
      sender: "Editor <editor@radio.example>",
      subject: "Re: New release",
      "body-plain": "Thanks for the note.",
      "In-Reply-To": queue.deterministic_message_id,
      "Message-Id": "<reply-1@radio.example>"
    }
  };
  const repository = {
    async readEvent() { return inbox; },
    async findSendByMessageId() { return queue; },
    async isSuppressed() { return false; },
    async enqueueHumanReview() { return "review-1"; },
    async cancelPendingForMatch() {},
    async releaseAllocation() {},
    async recordOutcome() {},
    async enqueueWork() {},
    async markEventProcessed() {}
  };
  const records = {
    OutreachMatch: { id: "match-1", campaignStatus: "Sent 1", campaignId: "campaign-1", versionNumber: 1 },
    MusicRelease: { id: "release-1", name: "Release", genres: ["Indie"] },
    MediaContact: {
      id: "contact-1",
      name: "Editor",
      emailAddress: "editor@radio.example",
      emailValidationStatus: "Valid",
      status: "Active"
    },
    MediaOutlet: { id: "outlet-1", name: "Radio", domain: "radio.example", activityStatus: "Active" }
  };
  const espocrm = {
    async get(entityType) { return records[entityType]; },
    async updateConditional(entityType, id, patch) { return { ...records[entityType], id, ...patch }; },
    async upsertByUnique(entityType, attribute, value, payload) {
      if (entityType === "Email") emailProjections.push({ attribute, value, payload });
      return { id: `${entityType.toLowerCase()}-1`, ...payload };
    }
  };
  const service = createEventService({
    espocrm,
    repository,
    config: {
      mailgun: { domain: "mail.example.test", replyTo: "replies@mail.example.test" },
      policy: { cooldownDays: 21 }
    },
    logger,
    metrics: new Metrics()
  });
  await service.processMailgunEvent({ payload: { eventInboxId: inbox.id } });
  await service.processMailgunEvent({ payload: { eventInboxId: inbox.id } });

  assert.equal(emailProjections.length, 2, "replay calls the same idempotent Espo upsert");
  assert.equal(emailProjections[0].attribute, "outreachProjectionKey");
  assert.match(emailProjections[0].value, /^inbound:[a-f0-9]{64}$/u);
  assert.equal(emailProjections[1].value, emailProjections[0].value);
  assert.equal(emailProjections[0].payload.status, "Received");
  assert.equal(emailProjections[0].payload.from, "editor@radio.example");
  assert.equal(emailProjections[0].payload.to, "replies@mail.example.test");
  assert.equal(emailProjections[0].payload.outreachMatchId, "match-1");
});

test("Espo contact/outlet events enter validation before matching", async () => {
  const work = [];
  const inboxes = new Map([
    ["contact-inbox", {
      id: "contact-inbox",
      external_id: "contact-event",
      entity_type: "MediaContact",
      entity_id: "contact-1",
      payload: { event: "MediaContact.updated", record: { id: "contact-1", modifiedAt: "2026-07-15 11:00:00" } }
    }],
    ["outlet-inbox", {
      id: "outlet-inbox",
      external_id: "outlet-event",
      entity_type: "MediaOutlet",
      entity_id: "outlet-1",
      payload: { event: "MediaOutlet.updated", record: { id: "outlet-1", modifiedAt: "2026-07-15 11:00:01" } }
    }]
  ]);
  const service = createEventService({
    espocrm: {},
    repository: {
      async readEvent(id) { return inboxes.get(id); },
      async enqueueWork(value) { work.push(value); },
      async markEventProcessed() {}
    },
    config: { mailgun: { domain: "mail.example.test", replyTo: "replies@mail.example.test" } },
    logger,
    metrics: new Metrics()
  });
  await service.processEspoEvent({ payload: { eventInboxId: "contact-inbox" } });
  await service.processEspoEvent({ payload: { eventInboxId: "outlet-inbox" } });
  assert.deepEqual(work.map(({ kind }) => kind), ["validate_contact", "validate_outlet"]);
});

function serviceHarness({ runtime = {}, mailgun = {}, espocrm = {}, findOutboundIdentity, recoverDueSequenceStep } = {}) {
  const inbox = [];
  const checkpoints = [];
  const completions = [];
  const failures = [];
  const configured = {
    enabled: true,
    mailgunEnabled: false,
    espoEmailEnabled: false,
    dueMatchesEnabled: false,
    mailgunStoredRepliesEnabled: false,
    mailgunMode: "logs",
    overlapSeconds: 300,
    settleDelaySeconds: 300,
    initialLookbackHours: 24,
    leaseSeconds: 60,
    pageSize: 100,
    maxPagesPerInvocation: 25,
    maximumBacklog: 10_000,
    ...runtime
  };
  const repository = {
    async getWatermark(fallback) { return fallback; },
    async acquire(input) {
      return {
        acquired: true,
        workflowName: "provider-outcome-reconcile",
        ownerId: input.ownerId,
        fenceToken: 1,
        runId: "run-1",
        watermarkFrom: input.watermarkFrom,
        watermarkTo: input.watermarkTo,
        routeIndex: 0,
        counters: {},
        resumed: false,
        resumeCount: 0
      };
    },
    async renew() { return true; },
    async checkpoint(_lease, value) { checkpoints.push(structuredClone(value)); return checkpoints.length; },
    async complete(_lease, value) { completions.push(structuredClone(value)); },
    async fail(_lease, value) { failures.push(structuredClone(value)); return true; },
    async backlog() { return { events: 0, work: 0 }; },
    async findOutboundIdentity(ids) { return findOutboundIdentity?.(ids); },
    async recoverDueSequenceStep(value) { return recoverDueSequenceStep?.(value) ?? { queued: false }; }
  };
  const inboxRepository = {
    async receiveEvent(value) {
      const existing = inbox.find((item) => item.source === value.source && item.externalId === value.externalId);
      if (existing) return { inserted: false };
      inbox.push(value);
      return { inserted: true, id: `inbox-${inbox.length}` };
    },
    async isSuppressed() { return false; }
  };
  const service = createOutcomeReconcileService({
    mailgun: { async listOutcomeEvents() { return { events: [], rejected: 0 }; }, ...mailgun },
    espocrm: { async *iterateModifiedBetween() {}, ...espocrm },
    repository,
    inboxRepository,
    config: { outcomeReconcile: configured },
    logger,
    metrics: new Metrics()
  });
  return { service, repository, inboxRepository, inbox, checkpoints, completions, failures };
}

function mailgunClient(fetch) {
  return new MailgunClient({
    apiKey: "mailgun-test-key",
    domain: "mail.example.test",
    baseUrl: "https://api.eu.mailgun.net",
    from: "outreach@mail.example.test",
    replyTo: "replies@mail.example.test",
    outcomeReconcile: { maxResponseBytes: 2_097_152, storageMaxResponseBytes: 1_048_576 }
  }, { fetch, timeoutMs: 1_000 });
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function dueMatch(overrides = {}) {
  return {
    id: "due-1",
    modifiedAt: "2026-07-15 11:00:00",
    campaignStatus: "Sent 1",
    activeSequence: true,
    currentSequenceStep: 0,
    nextActionAt: "2026-07-15 10:00:00",
    replyStatus: null,
    stopReason: null,
    mediaContactId: "contact-1",
    mediaOutletId: "outlet-1",
    ...overrides
  };
}

function validEnvironment() {
  return {
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://user:password@localhost:5432/outreach",
    ESPOCRM_BASE_URL: "https://crm.example.test",
    ESPOCRM_API_KEY: "espo-api-key-for-tests",
    MAILGUN_API_KEY: "mailgun-test-key",
    MAILGUN_DOMAIN: "mail.example.test",
    MAILGUN_FROM: "MarcsMusic <music@example.test>",
    MAILGUN_REPLY_TO: "music@example.test",
    MAILGUN_WEBHOOK_SIGNING_KEY: "mailgun-signing-key-for-tests",
    OUTREACH_PUBLIC_BASE_URL: "https://outreach.example.test",
    OUTREACH_DATA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
    OUTREACH_HASH_KEY: "privacy-hash-key-for-tests-at-least-32-characters",
    OUTREACH_UNSUBSCRIBE_KEYRING_JSON: JSON.stringify({
      schemaVersion: 2,
      active: { kid: "unsub-outcome-test", key: "u".repeat(48) },
      verifyOnly: []
    }),
    METRICS_TOKEN: "metrics-token-for-tests-at-least-24"
  };
}
