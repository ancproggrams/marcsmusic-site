import test from "node:test";
import assert from "node:assert/strict";

import { Metrics } from "../src/infrastructure/metrics.mjs";
import { normalizePlunkEventPayload } from "../src/application/event-service.mjs";
import { buildServer } from "../src/interfaces/http/build-server.mjs";

const SECRET = "plunk-webhook-secret-for-tests";

test("Plunk event normalization maps documented lifecycle names without trusting recipient identity", () => {
  const normalized = normalizePlunkEventPayload({
    eventType: "email.bounce",
    event: {
      emailId: "plunk-email-1",
      bounceType: "Permanent",
      bouncedAt: "2026-07-15T10:00:00.000Z",
      from: "editor@example.test"
    }
  });
  assert.equal(normalized.event, "failed");
  assert.equal(normalized.severity, "permanent");
  assert.equal(normalized["message-id"], "plunk-email-1");
  assert.equal(normalized.sender, "editor@example.test");
  assert.equal(normalized.timestamp, "2026-07-15T10:00:00.000Z");
  assert.throws(() => normalizePlunkEventPayload({ eventType: "email.delivery", event: {} }), /IDENTITY/u);
});

test("Plunk normalization accepts a data envelope and never treats outbound content as an inbound reply", () => {
  const normalized = normalizePlunkEventPayload({
    data: {
      type: "email.sent",
      emailId: "plunk-email-2",
      body: "The outbound message body",
      from: "noreply@marcsmusic.nl"
    }
  });
  assert.equal(normalized.event, "accepted");
  assert.equal(normalized["message-id"], "plunk-email-2");
  assert.equal(normalized["body-plain"], undefined);
  assert.equal(normalized.sender, "noreply@marcsmusic.nl");
});

class Repository {
  constructor() {
    this.received = [];
    this.ids = new Set();
    this.pool = { query: async () => ({ rows: [{ healthy: 1 }] }) };
  }

  async receiveEvent(event) {
    this.received.push(event);
    const inserted = !this.ids.has(event.externalId);
    this.ids.add(event.externalId);
    return { inserted };
  }

  async suppress() {}
  async cancelPendingForMatch() {}
}

function config() {
  return {
    espocrm: { webhookSecrets: { webhook: "test" } },
    mailgun: { webhookSigningKey: "mailgun-signing-key-for-tests" },
    plunk: { webhookSecret: SECRET },
    crypto: { unsubscribeSigning: { active: { key: "unsubscribe-key-for-tests" } } },
    metricsToken: "metrics-token-for-plunk-tests",
    safety: { killSwitch: true, sendEnabled: false }
  };
}

test("Plunk webhook authenticates, queues once and preserves provider identity", async (t) => {
  const repository = new Repository();
  const server = await buildServer({ config: config(), repository, metrics: new Metrics(), readinessCheck: async () => ({ ready: true }) });
  t.after(() => server.close());
  const payload = {
    eventType: "email.bounce",
    event: { emailId: "plunk-email-1", bounceType: "Permanent", bouncedAt: "2026-07-15T10:00:00.000Z" }
  };
  const headers = {
    authorization: `Bearer ${SECRET}`,
    "content-type": "application/json"
  };
  const first = await server.inject({ method: "POST", url: "/webhooks/plunk", headers, payload });
  const replay = await server.inject({ method: "POST", url: "/webhooks/plunk", headers, payload });
  assert.equal(first.statusCode, 202);
  assert.deepEqual(first.json(), { accepted: true, queued: true });
  assert.equal(replay.statusCode, 202);
  assert.deepEqual(replay.json(), { accepted: true, queued: false });
  assert.equal(repository.received.length, 2);
  assert.equal(repository.received[0].source, "plunk");
  assert.equal(repository.received[0].eventType, "email.bounce");
  assert.equal(repository.received[0].workKind, "process_plunk_event");
  assert.equal(repository.received[0].entityId, "plunk-email-1");
});

test("Plunk webhook rejects missing or forged bearer secrets before persistence", async (t) => {
  const repository = new Repository();
  const server = await buildServer({ config: config(), repository, metrics: new Metrics(), readinessCheck: async () => ({ ready: true }) });
  t.after(() => server.close());
  const payload = { eventType: "email.delivery", event: { emailId: "plunk-email-2" } };
  for (const authorization of [undefined, "Bearer wrong", "Basic wrong"]) {
    const response = await server.inject({
      method: "POST",
      url: "/webhooks/plunk",
      ...(authorization ? { headers: { authorization } } : {}),
      payload
    });
    assert.equal(response.statusCode, 401);
  }
  assert.equal(repository.received.length, 0);
});
