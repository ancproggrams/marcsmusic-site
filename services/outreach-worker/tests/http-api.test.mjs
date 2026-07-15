import { createHmac } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";

import { createUnsubscribeToken } from "../src/domain/unsubscribe-token.mjs";
import { Metrics } from "../src/infrastructure/metrics.mjs";
import { buildServer } from "../src/interfaces/http/build-server.mjs";

const ESPO_WEBHOOK_ID = "webhook-test";
const ESPO_WEBHOOK_SECRET = "espo-webhook-secret-for-http-tests";
const MAILGUN_SIGNING_KEY = "mailgun-signing-key-for-http-tests";
const UNSUBSCRIBE_SIGNING_KEY = "unsubscribe-signing-key-for-http-tests";
const UNSUBSCRIBE_KEYRING = Object.freeze({
  schemaVersion: 2,
  active: Object.freeze({ kid: "unsub-http-2026-07", key: UNSUBSCRIBE_SIGNING_KEY }),
  verifyOnly: Object.freeze([])
});
const METRICS_TOKEN = "metrics-bearer-token-for-http-tests";

function testConfig() {
  return Object.freeze({
    espocrm: Object.freeze({ webhookSecrets: Object.freeze({ [ESPO_WEBHOOK_ID]: ESPO_WEBHOOK_SECRET }) }),
    mailgun: Object.freeze({ webhookSigningKey: MAILGUN_SIGNING_KEY }),
    crypto: Object.freeze({ unsubscribeSigning: UNSUBSCRIBE_KEYRING }),
    metricsToken: METRICS_TOKEN,
    safety: Object.freeze({ killSwitch: true, sendEnabled: false })
  });
}

class FakeRepository {
  constructor() {
    this.externalIds = new Set();
    this.received = [];
    this.suppressions = [];
    this.cancellations = [];
    this.pool = { query: async () => ({ rows: [{ healthy: 1 }] }) };
  }

  async receiveEvent(event) {
    this.received.push(structuredClone(event));
    const key = `${event.source}:${event.externalId}`;
    const inserted = !this.externalIds.has(key);
    this.externalIds.add(key);
    return Object.freeze({ inserted, ...(inserted ? { id: `event-${this.externalIds.size}` } : {}) });
  }

  async suppress(suppression) {
    this.suppressions.push(structuredClone(suppression));
  }

  async cancelPendingForMatch(matchId, reason) {
    this.cancellations.push({ matchId, reason });
    return 1;
  }
}

async function serverFixture(t, options = {}) {
  const repository = options.repository ?? new FakeRepository();
  const metrics = options.metrics ?? new Metrics();
  const server = await buildServer({
    config: testConfig(),
    repository,
    metrics,
    readinessCheck: options.readinessCheck ?? (async () => ({ ready: true })),
    capabilitiesCheck: options.capabilitiesCheck
  });
  t.after(() => server.close());
  return { server, repository, metrics };
}

function espoSignature(rawBody) {
  const digest = createHmac("sha256", ESPO_WEBHOOK_SECRET).update(rawBody).digest("hex");
  return Buffer.from(`${ESPO_WEBHOOK_ID}:${digest}`, "utf8").toString("base64");
}

function mailgunSignature(timestamp, token) {
  return createHmac("sha256", MAILGUN_SIGNING_KEY).update(`${timestamp}${token}`).digest("hex");
}

function freshMailgunEnvelope(id, overrides = {}) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const token = `token-${id}`;
  return {
    signature: { timestamp, token, signature: mailgunSignature(timestamp, token) },
    "event-data": {
      id,
      event: "delivered",
      message: { headers: { "message-id": `<${id}@mailgun.example.test>` } },
      "user-variables": { matchId: "match-1" },
      ...overrides
    }
  };
}

test("EspoCRM HMAC is calculated over exact raw JSON and replay queues once", async (t) => {
  const { server, repository } = await serverFixture(t);
  const rawBody = '[{"id":"contact-1","status":"Active"}]';
  const headers = {
    "content-type": "application/json",
    signature: espoSignature(rawBody)
  };

  const first = await server.inject({
    method: "POST",
    url: "/webhooks/espocrm/MediaContact.updated",
    headers,
    payload: rawBody
  });
  const replay = await server.inject({
    method: "POST",
    url: "/webhooks/espocrm/MediaContact.updated",
    headers,
    payload: rawBody
  });

  assert.equal(first.statusCode, 202);
  assert.deepEqual(first.json(), { accepted: 1, queued: 1 });
  assert.deepEqual(replay.json(), { accepted: 1, queued: 0 });
  assert.equal(repository.received.length, 2);
  assert.equal(repository.received[0].source, "espocrm");
  assert.equal(repository.received[0].eventType, "MediaContact.updated");
  assert.equal(repository.received[0].entityType, "MediaContact");
  assert.equal(repository.received[0].entityId, "contact-1");
  assert.equal(repository.received[0].workKind, "process_espocrm_event");
});

test("EspoCRM rejects a signature made for a different byte sequence", async (t) => {
  const { server, repository } = await serverFixture(t);
  const signed = '[{"id":"contact-1"}]';
  const changed = '[ {"id":"contact-1"} ]';

  const response = await server.inject({
    method: "POST",
    url: "/webhooks/espocrm/MediaContact.updated",
    headers: { "content-type": "application/json", signature: espoSignature(signed) },
    payload: changed
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, "ESPO_SIGNATURE_INVALID");
  assert.equal(repository.received.length, 0);
});

test("Mailgun nested JSON verifies and event replay is idempotent", async (t) => {
  const { server, repository } = await serverFixture(t);
  const payload = freshMailgunEnvelope("event-json-1");

  const first = await server.inject({
    method: "POST",
    url: "/webhooks/mailgun",
    headers: { "content-type": "application/json" },
    payload: JSON.stringify(payload)
  });
  const replay = await server.inject({
    method: "POST",
    url: "/webhooks/mailgun",
    headers: { "content-type": "application/json" },
    payload: JSON.stringify(payload)
  });

  assert.deepEqual(first.json(), { accepted: true, queued: true });
  assert.deepEqual(replay.json(), { accepted: true, queued: false });
  assert.equal(repository.received[0].source, "mailgun");
  assert.equal(repository.received[0].eventType, "delivered");
  assert.equal(repository.received[0].entityId, "event-json-1");
  assert.equal(repository.received[0].workKind, "process_mailgun_event");
});

test("Mailgun URL-encoded fields verify and queue", async (t) => {
  const { server } = await serverFixture(t);
  const envelope = freshMailgunEnvelope("event-form-1");
  const body = new URLSearchParams({
    signature: JSON.stringify(envelope.signature),
    "event-data": JSON.stringify(envelope["event-data"])
  }).toString();

  const response = await server.inject({
    method: "POST",
    url: "/webhooks/mailgun",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    payload: body
  });

  assert.equal(response.statusCode, 202);
  assert.deepEqual(response.json(), { accepted: true, queued: true });
});

test("Mailgun multipart fields verify and queue while accepting no files", async (t) => {
  const { server } = await serverFixture(t);
  const envelope = freshMailgunEnvelope("event-multipart-1");
  const boundary = "----outreach-http-test-boundary";
  const payload = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="signature"',
    "",
    JSON.stringify(envelope.signature),
    `--${boundary}`,
    'Content-Disposition: form-data; name="event-data"',
    "",
    JSON.stringify(envelope["event-data"]),
    `--${boundary}--`,
    ""
  ].join("\r\n");

  const response = await server.inject({
    method: "POST",
    url: "/webhooks/mailgun",
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload
  });

  assert.equal(response.statusCode, 202);
  assert.deepEqual(response.json(), { accepted: true, queued: true });
});

test("Mailgun rejects stale or forged signatures before persistence", async (t) => {
  const { server, repository } = await serverFixture(t);
  const envelope = freshMailgunEnvelope("event-forged-1");
  envelope.signature.signature = "0".repeat(64);

  const response = await server.inject({
    method: "POST",
    url: "/webhooks/mailgun",
    headers: { "content-type": "application/json" },
    payload: JSON.stringify(envelope)
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, "MAILGUN_SIGNATURE_INVALID");
  assert.equal(repository.received.length, 0);
});

test("a signed complaint opens the durable circuit synchronously before webhook acknowledgement", async (t) => {
  const { server, repository } = await serverFixture(t);
  const payload = freshMailgunEnvelope("event-complaint-1", { event: "complained" });

  const response = await server.inject({
    method: "POST",
    url: "/webhooks/mailgun",
    headers: { "content-type": "application/json" },
    payload: JSON.stringify(payload)
  });

  assert.equal(response.statusCode, 202);
  assert.match(repository.received[0].openCircuitReason, /^signed_mailgun_complaint:/u);
  assert.equal(repository.received[0].priority, 0);
});

test("a signed CRM confirmation of an unauthorized recipient opens the circuit before acknowledgement", async (t) => {
  const { server, repository } = await serverFixture(t);
  const rawBody = '[{"id":"incident-1","eventType":"Unauthorized Recipient Confirmed"}]';
  const response = await server.inject({
    method: "POST",
    url: "/webhooks/espocrm/OutreachEvent.created",
    headers: { "content-type": "application/json", signature: espoSignature(rawBody) },
    payload: rawBody
  });

  assert.equal(response.statusCode, 202);
  assert.match(repository.received[0].openCircuitReason, /^confirmed_unauthorized_recipient:/u);
  assert.equal(repository.received[0].priority, 0);
});

test("unsubscribe GET is non-mutating; POST suppresses, cancels and queues once", async (t) => {
  const { server, repository } = await serverFixture(t);
  const token = createUnsubscribeToken({
    contactId: "contact-1",
    matchId: "match-1",
    keyring: UNSUBSCRIBE_KEYRING,
    expiresAt: new Date(Date.now() + 60_000)
  });

  const get = await server.inject({ method: "GET", url: `/unsubscribe?token=${encodeURIComponent(token)}` });

  assert.equal(get.statusCode, 200);
  assert.match(get.headers["content-type"], /^text\/html/u);
  assert.match(get.body, /method="post"/u);
  assert.equal(repository.suppressions.length, 0);
  assert.equal(repository.cancellations.length, 0);
  assert.equal(repository.received.length, 0);

  const form = new URLSearchParams({ token }).toString();
  const firstPost = await server.inject({
    method: "POST",
    url: "/unsubscribe",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    payload: form
  });
  const replayPost = await server.inject({
    method: "POST",
    url: "/unsubscribe",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    payload: form
  });

  assert.equal(firstPost.statusCode, 200);
  assert.equal(replayPost.statusCode, 200);
  assert.deepEqual(repository.suppressions[0], {
    subjectType: "contact",
    subject: "contact-1",
    reason: "unsubscribed",
    source: "self_service"
  });
  assert.deepEqual(repository.cancellations[0], { matchId: "match-1", reason: "contact_unsubscribed" });
  assert.equal(repository.received[0].source, "unsubscribe");
  assert.equal(repository.received[0].eventType, "unsubscribed");
  assert.equal(repository.received[0].workKind, "process_unsubscribe_event");
  assert.equal(repository.externalIds.size, 1);
});

test("metrics requires exact bearer authentication", async (t) => {
  const { server, metrics } = await serverFixture(t);
  metrics.increment("outreach_test_total", { result: "ok" }, 2);

  const anonymous = await server.inject({ method: "GET", url: "/metrics" });
  const wrong = await server.inject({ method: "GET", url: "/metrics", headers: { authorization: "Bearer wrong" } });
  const allowed = await server.inject({
    method: "GET",
    url: "/metrics",
    headers: { authorization: `Bearer ${METRICS_TOKEN}` }
  });

  assert.equal(anonymous.statusCode, 401);
  assert.equal(wrong.statusCode, 401);
  assert.equal(allowed.statusCode, 200);
  assert.match(allowed.headers["content-type"], /^text\/plain/u);
  assert.match(allowed.body, /outreach_test_total\{result="ok"\} 2/u);
});

test("readiness reports only durable ingress state and capabilities diagnose downstream degradation", async (t) => {
  const ready = await serverFixture(t, { readinessCheck: async () => ({ ready: true }) });
  const unavailable = await serverFixture(t, { readinessCheck: async () => ({ ready: false }) });
  const degraded = await serverFixture(t, {
    capabilitiesCheck: async () => ({
      ingress: { available: true },
      crmProjection: { available: false, reason: "espocrm_unavailable" },
      matching: { available: false, reason: "espocrm_unavailable" },
      sending: { available: false, reason: "kill_switch_enabled" },
      observability: {
        configured: true,
        available: true,
        policyVersion: "must-not-be-public",
        approvedPolicyReference: "must-not-be-public",
        outbox: { cursor: 9_999_999, backlog: 123, deadLetters: 4 },
        alertRouter: {
          mode: "external",
          configured: false,
          available: false,
          reason: "external_alert_router_unconfigured",
          endpoint: "https://must-not-be-public.example.test"
        },
        dashboard: {
          mode: "external",
          configured: false,
          available: false,
          reason: "external_dashboard_unconfigured",
          tenant: "must-not-be-public"
        }
      },
      providers: {
        mailgun: {
          configured: true,
          available: false,
          health: "unavailable",
          reason: "mailgun_auth_rejected",
          checkedAt: "2026-07-15T10:00:00.000Z",
          inboundRoute: { status: "unknown", reason: "inbound_route_evidence_unknown" }
        },
        emailValidation: {
          configured: true,
          available: true,
          health: "available",
          type: "http",
          checkedAt: "2026-07-15T10:00:00.000Z"
        }
      }
    })
  });

  const liveResponse = await ready.server.inject({ method: "GET", url: "/livez" });
  const readyResponse = await ready.server.inject({ method: "GET", url: "/readyz" });
  const failedResponse = await unavailable.server.inject({ method: "GET", url: "/readyz" });
  const capabilityResponse = await degraded.server.inject({ method: "GET", url: "/capabilities" });

  assert.deepEqual(liveResponse.json(), { status: "alive" });
  assert.deepEqual(readyResponse.json(), { status: "ready", ingress: { database: "up", schema: "current" } });
  assert.equal(failedResponse.statusCode, 503);
  assert.deepEqual(failedResponse.json(), {
    status: "not_ready",
    ingress: { database: "unavailable", schema: "unknown" }
  });
  assert.deepEqual(capabilityResponse.json(), {
    status: "degraded",
    ingress: { available: true },
    capabilities: {
      crm_projection: { available: false, reason: "espocrm_unavailable" },
      matching: { available: false, reason: "espocrm_unavailable" },
      sending: { available: false, reason: "kill_switch_enabled" },
      outcome_recovery: {
        configured: false,
        available: false,
        reason: "outcome_reconciliation_disabled",
        reply_recovery: {
          mode: "external",
          available: false,
          reason: "provider_recovery_unavailable"
        }
      }
    },
    observability: {
      configured: true,
      available: true,
      alert_router: {
        mode: "external",
        configured: false,
        available: false,
        reason: "external_alert_router_unconfigured"
      },
      dashboard: {
        mode: "external",
        configured: false,
        available: false,
        reason: "external_dashboard_unconfigured"
      }
    },
    providers: {
      mailgun: {
        configured: true,
        available: false,
        health: "unavailable",
        reason: "mailgun_auth_rejected",
        checked_at: "2026-07-15T10:00:00.000Z",
        inbound_route: { status: "unknown", reason: "inbound_route_evidence_unknown" }
      },
      email_validation: {
        configured: true,
        available: true,
        health: "available",
        type: "http",
        checked_at: "2026-07-15T10:00:00.000Z"
      }
    }
  });
});

test("readiness never invokes external provider capability checks", async (t) => {
  let capabilityCalls = 0;
  const { server } = await serverFixture(t, {
    readinessCheck: async () => ({ ready: true }),
    capabilitiesCheck: async () => {
      capabilityCalls += 1;
      throw new Error("external provider unavailable");
    }
  });

  const response = await server.inject({ method: "GET", url: "/readyz" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    status: "ready",
    ingress: { database: "up", schema: "current" }
  });
  assert.equal(capabilityCalls, 0);
});

test("capabilities exposes only allowlisted reason codes", async (t) => {
  const sensitiveDetail = "provider said api-key=do-not-return-this";
  const { server } = await serverFixture(t, {
    capabilitiesCheck: async () => ({
      ingress: { available: true },
      crmProjection: { available: true },
      matching: { available: true },
      sending: { available: false, reason: sensitiveDetail },
      observability: {
        configured: true,
        available: false,
        reason: sensitiveDetail,
        policyDigest: sensitiveDetail,
        outbox: { cursor: 123, backlog: 456 },
        alertRouter: {
          mode: "internal",
          configured: false,
          available: true,
          reason: "external_alert_router_unconfigured",
          token: sensitiveDetail
        },
        dashboard: {
          configured: false,
          available: true,
          reason: "external_dashboard_unconfigured",
          url: sensitiveDetail
        }
      },
      providers: {
        mailgun: {
          configured: true,
          available: false,
          health: "unavailable",
          reason: sensitiveDetail,
          inboundRoute: { status: "configured", reason: sensitiveDetail }
        },
        emailValidation: {
          configured: true,
          available: false,
          health: "unavailable",
          type: "http",
          reason: sensitiveDetail
        }
      }
    })
  });

  const response = await server.inject({ method: "GET", url: "/capabilities" });
  const payload = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(payload.status, "degraded");
  assert.equal(payload.capabilities.sending.reason, "capability_reason_redacted");
  assert.deepEqual(payload.observability, {
    configured: true,
    available: false,
    reason: "capability_reason_redacted",
    alert_router: {
      mode: "external",
      configured: false,
      available: false,
      reason: "external_alert_router_unconfigured"
    },
    dashboard: {
      mode: "external",
      configured: false,
      available: false,
      reason: "external_dashboard_unconfigured"
    }
  });
  assert.equal(payload.providers.mailgun.reason, "capability_reason_redacted");
  assert.equal(payload.providers.email_validation.reason, "capability_reason_redacted");
  assert.deepEqual(payload.providers.mailgun.inbound_route, {
    status: "configured",
    reason: "inbound_route_configured_evidence"
  });
  assert.doesNotMatch(response.body, /api-key|do-not-return-this/u);
  assert.doesNotMatch(response.body, /policyDigest|cursor|backlog|token|url/u);
});

test("external alert routing and dashboard gates keep an otherwise healthy system degraded", async (t) => {
  const { server } = await serverFixture(t, {
    capabilitiesCheck: async () => ({
      ingress: { available: true },
      crmProjection: { available: true },
      matching: { available: true },
      sending: { available: true },
      observability: {
        configured: true,
        available: true,
        alertRouter: {
          configured: false,
          available: false,
          reason: "external_alert_router_unconfigured"
        },
        dashboard: {
          configured: false,
          available: false,
          reason: "external_dashboard_unconfigured"
        }
      },
      providers: {
        mailgun: {
          configured: true,
          available: true,
          health: "available",
          inboundRoute: { status: "configured" }
        },
        emailValidation: {
          configured: true,
          available: true,
          health: "available",
          type: "http"
        }
      }
    })
  });

  const response = await server.inject({ method: "GET", url: "/capabilities" });
  const payload = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(payload.status, "degraded");
  assert.equal(payload.observability.available, true);
  assert.equal(payload.observability.alert_router.reason, "external_alert_router_unconfigured");
  assert.equal(payload.observability.dashboard.reason, "external_dashboard_unconfigured");
});
