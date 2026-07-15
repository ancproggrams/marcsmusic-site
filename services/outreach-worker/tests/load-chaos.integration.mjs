import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { monitorEventLoopDelay, performance } from "node:perf_hooks";
import { after, before, describe, test } from "node:test";

import pg from "pg";

import { businessDate, businessDayUtcRange } from "../src/application/date-utils.mjs";
import { CryptoBox } from "../src/infrastructure/crypto-box.mjs";
import { MailgunClient } from "../src/infrastructure/mailgun-client.mjs";
import { Metrics } from "../src/infrastructure/metrics.mjs";
import { OutreachRepository } from "../src/infrastructure/outreach-repository.mjs";
import { createPostgresPool, runMigrations } from "../src/infrastructure/postgres.mjs";
import { buildServer } from "../src/interfaces/http/build-server.mjs";
import { startPostgresTestCluster } from "./helpers/postgres-test-cluster.mjs";

const { Pool } = pg;
const ESPO_WEBHOOK_ID = "load-webhook";
const ESPO_WEBHOOK_SECRET = "load-webhook-secret-with-at-least-32-bytes";
const REPLAY_COUNT = 10_000;
const HTTP_CONCURRENCY = 64;
const WORK_ITEM_COUNT = 2_000;
const WORKER_CONCURRENCY = 32;
const MEBIBYTE = 1024 * 1024;

const cryptoBox = new CryptoBox({
  encryptionKey: Buffer.alloc(32, 11),
  keyVersion: "load-chaos-v1",
  hashKey: "load-chaos-privacy-key-with-at-least-32-bytes"
});

let cluster;

describe("bounded load and chaos contracts", { concurrency: 1 }, () => {
  before(async () => {
    cluster = await startPostgresTestCluster();
  });

  after(async () => {
    await cluster?.stop();
  });

  test("10k signed webhook replays persist once with bounded memory and latency", async (t) => {
    const { pool, repository } = await createRepository(t);
    const metrics = new Metrics();
    const server = await buildServer({
      config: httpConfig(),
      repository,
      metrics,
      readinessCheck: async () => ({ ready: true })
    });
    t.after(() => server.close());

    const rawBody = '[{"id":"contact-load-1","status":"Active"}]';
    const signature = espoSignature(rawBody);
    const latencies = new Float64Array(REPLAY_COUNT);
    let queued = 0;
    let peakPoolWaiters = 0;
    const memoryBefore = process.memoryUsage();
    const eventLoop = monitorEventLoopDelay({ resolution: 10 });
    eventLoop.enable();
    const startedAt = performance.now();
    const waiterSampler = setInterval(() => {
      peakPoolWaiters = Math.max(peakPoolWaiters, pool.waitingCount);
    }, 1);
    waiterSampler.unref();

    try {
      await runBounded(REPLAY_COUNT, HTTP_CONCURRENCY, async (index) => {
        const requestStartedAt = performance.now();
        const response = await server.inject({
          method: "POST",
          url: "/webhooks/espocrm/MediaContact.updated",
          headers: { "content-type": "application/json", signature },
          payload: rawBody
        });
        latencies[index] = performance.now() - requestStartedAt;
        assert.equal(response.statusCode, 202);
        queued += response.json().queued;
      });
    } finally {
      clearInterval(waiterSampler);
      eventLoop.disable();
    }

    const totalMs = performance.now() - startedAt;
    const memoryAfter = process.memoryUsage();
    const rssGrowthMiB = Math.max(0, memoryAfter.rss - memoryBefore.rss) / MEBIBYTE;
    const heapGrowthMiB = Math.max(0, memoryAfter.heapUsed - memoryBefore.heapUsed) / MEBIBYTE;
    const p95Ms = percentile(latencies, 0.95);
    const eventLoopP99Ms = eventLoop.percentile(99) / 1e6;
    const persisted = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM encrypted_event_inbox) AS inbox,
         (SELECT count(*)::int FROM work_items) AS work`
    );

    t.diagnostic(JSON.stringify({
      requests: REPLAY_COUNT,
      concurrency: HTTP_CONCURRENCY,
      totalMs: round(totalMs),
      requestsPerSecond: round(REPLAY_COUNT / (totalMs / 1_000)),
      p95Ms: round(p95Ms),
      eventLoopP99Ms: round(eventLoopP99Ms),
      rssGrowthMiB: round(rssGrowthMiB),
      heapGrowthMiB: round(heapGrowthMiB),
      poolConnections: pool.totalCount,
      peakPoolWaiters
    }));

    assert.equal(queued, 1, "all byte-identical webhook deliveries must converge on one inbox event");
    assert.deepEqual(persisted.rows[0], { inbox: 1, work: 1 });
    assert.ok(pool.totalCount <= 10, "database pressure must remain within the configured connection cap");
    assert.ok(totalMs < 90_000, `10k replay exceeded the 90s budget (${round(totalMs)}ms)`);
    assert.ok(p95Ms < 2_000, `p95 request latency exceeded 2s (${round(p95Ms)}ms)`);
    assert.ok(eventLoopP99Ms < 1_000, `p99 event-loop delay exceeded 1s (${round(eventLoopP99Ms)}ms)`);
    assert.ok(rssGrowthMiB < 256, `RSS grew by ${round(rssGrowthMiB)} MiB`);
    assert.ok(heapGrowthMiB < 128, `heap grew by ${round(heapGrowthMiB)} MiB`);
  });

  test("HTTP admission control rejects overflow without starving health endpoints", async (t) => {
    const admissionLimit = 8;
    let releaseBlockedRequests;
    const blocked = new Promise((resolve) => { releaseBlockedRequests = resolve; });
    let active = 0;
    let peakActive = 0;
    const repository = {
      pool: { query: async () => ({ rows: [{ healthy: 1 }] }) },
      async receiveEvent() {
        active += 1;
        peakActive = Math.max(peakActive, active);
        await blocked;
        active -= 1;
        return Object.freeze({ inserted: true, id: "capacity-test" });
      },
      async suppress() {},
      async cancelPendingForMatch() { return 0; }
    };
    const metrics = new Metrics();
    const server = await buildServer({
      config: httpConfig(admissionLimit),
      repository,
      metrics,
      readinessCheck: async () => ({ ready: true })
    });
    t.after(() => server.close());
    const rawBody = '[{"id":"capacity-contact"}]';
    const request = {
      method: "POST",
      url: "/webhooks/espocrm/MediaContact.updated",
      headers: { "content-type": "application/json", signature: espoSignature(rawBody) },
      payload: rawBody
    };

    const admitted = Array.from({ length: admissionLimit }, () => server.inject(request));
    await waitUntil(() => active === admissionLimit, 2_000);
    const overflowStartedAt = performance.now();
    const overflow = await server.inject(request);
    const overflowMs = performance.now() - overflowStartedAt;
    const health = await server.inject({ method: "GET", url: "/livez" });
    const readinessOverflow = await server.inject({ method: "GET", url: "/readyz" });

    assert.equal(overflow.statusCode, 429);
    assert.equal(overflow.headers["retry-after"], "1");
    assert.equal(overflow.json().error.code, "HTTP_CAPACITY_EXCEEDED");
    assert.ok(overflowMs < 500, `overflow admission took ${round(overflowMs)}ms`);
    assert.equal(health.statusCode, 200);
    assert.deepEqual(health.json(), { status: "alive" });
    assert.equal(readinessOverflow.statusCode, 429);
    assert.equal(readinessOverflow.json().error.code, "HTTP_CAPACITY_EXCEEDED");
    assert.equal(peakActive, admissionLimit);

    releaseBlockedRequests();
    const completed = await Promise.all(admitted);
    assert.ok(completed.every(({ statusCode }) => statusCode === 202));
    assert.equal(active, 0);
    assert.match(metrics.render(), /outreach_http_capacity_rejected_total 2/u);
    assert.match(metrics.render(), /outreach_http_in_flight_requests 0/u);
  });

  test("64 concurrent readiness probes share one dependency check and its cache", async (t) => {
    let readinessCalls = 0;
    let releaseReadiness;
    const readinessGate = new Promise((resolve) => { releaseReadiness = resolve; });
    const repository = {
      pool: { query: async () => ({ rows: [{ healthy: 1 }] }) },
      async receiveEvent() { return Object.freeze({ inserted: true }); },
      async suppress() {},
      async cancelPendingForMatch() { return 0; }
    };
    const metrics = new Metrics();
    const server = await buildServer({
      config: httpConfig(64),
      repository,
      metrics,
      readinessCheck: async () => {
        readinessCalls += 1;
        await readinessGate;
        return { ready: true };
      }
    });
    t.after(() => server.close());

    const probes = Array.from({ length: 64 }, () => server.inject({ method: "GET", url: "/readyz" }));
    await waitUntil(() => readinessCalls === 1, 2_000);
    releaseReadiness();
    const responses = await Promise.all(probes);
    assert.ok(responses.every(({ statusCode }) => statusCode === 200));
    assert.equal(readinessCalls, 1);

    const cached = await server.inject({ method: "GET", url: "/readyz" });
    assert.equal(cached.statusCode, 200);
    assert.equal(readinessCalls, 1, "a probe inside the TTL must not call dependencies again");
    assert.match(metrics.render(), /outreach_http_in_flight_requests 0/u);
  });

  test("concurrent workers drain 2k queue items exactly once within the pool cap", async (t) => {
    const { pool, repository } = await createRepository(t);
    const items = Array.from({ length: WORK_ITEM_COUNT }, (_, index) => ({
      kind: "load_test",
      entityType: "MusicRelease",
      entityId: `release-${index}`,
      dedupeKey: `load-work-${index}`,
      payload: { index },
      priority: index % 5
    }));
    assert.equal(await repository.enqueueWorkBatch(items), WORK_ITEM_COUNT);

    const seen = new Set();
    const claimLatencies = [];
    let duplicateClaims = 0;
    let failedCompletions = 0;
    const startedAt = performance.now();

    await Promise.all(Array.from({ length: WORKER_CONCURRENCY }, (_, workerIndex) => (async () => {
      while (true) {
        const claimStartedAt = performance.now();
        const item = await repository.claimWork(`load-worker-${workerIndex}`, 30);
        if (!item) return;
        claimLatencies.push(performance.now() - claimStartedAt);
        if (seen.has(item.id)) duplicateClaims += 1;
        seen.add(item.id);
        if (!await repository.completeWork(item)) failedCompletions += 1;
      }
    })()));

    const totalMs = performance.now() - startedAt;
    const stored = await pool.query("SELECT status,count(*)::int AS count FROM work_items GROUP BY status");
    const p95Ms = percentile(claimLatencies, 0.95);
    t.diagnostic(JSON.stringify({
      items: WORK_ITEM_COUNT,
      workers: WORKER_CONCURRENCY,
      totalMs: round(totalMs),
      itemsPerSecond: round(WORK_ITEM_COUNT / (totalMs / 1_000)),
      claimP95Ms: round(p95Ms),
      poolConnections: pool.totalCount,
      poolIdle: pool.idleCount,
      poolWaiting: pool.waitingCount
    }));

    assert.equal(seen.size, WORK_ITEM_COUNT);
    assert.equal(duplicateClaims, 0);
    assert.equal(failedCompletions, 0);
    assert.deepEqual(stored.rows, [{ status: "completed", count: WORK_ITEM_COUNT }]);
    assert.ok(pool.totalCount <= 10);
    assert.equal(pool.waitingCount, 0, "the queue drain must leave no blocked database borrowers");
    assert.ok(totalMs < 60_000, `queue drain exceeded the 60s budget (${round(totalMs)}ms)`);
    assert.ok(p95Ms < 1_000, `claim p95 exceeded 1s (${round(p95Ms)}ms)`);
  });

  test("expired delivery leases quarantine unknown outcomes and fence late workers", async (t) => {
    const { pool, repository } = await createRepository(t);
    const copyArtifactId = await repository.saveCopyArtifact({
      matchId: "lease-match",
      sequenceStep: 0,
      templateVersion: "load-chaos-v1",
      copy: { subject: "Safe subject", bodyText: "Safe deterministic body." },
      contentHash: "lease-copy-hash",
      validationStatus: "valid",
      confidence: 1
    });
    assert.equal((await repository.tryAcquireAllocation({
      email: "lease-test@radio.example",
      matchId: "lease-match",
      releaseId: "lease-release",
      contactId: "lease-contact",
      outletId: "lease-outlet"
    })).acquired, true);
    await repository.enqueueSend({
      matchId: "lease-match",
      releaseId: "lease-release",
      contactId: "lease-contact",
      outletId: "lease-outlet",
      recipientEmail: "lease-test@radio.example",
      sequenceStep: 0,
      idempotencyKey: "lease-send",
      deterministicMessageId: "<lease-send@example.test>",
      copyArtifactId,
      sendAt: new Date(Date.now() - 1_000)
    });
    await repository.enqueueResponse({
      matchId: "lease-match",
      releaseId: "lease-release",
      contactId: "lease-contact",
      outletId: "lease-outlet",
      idempotencyKey: "lease-response",
      deterministicMessageId: "<lease-response@example.test>",
      payload: { to: "lease-test@radio.example", subject: "Re: Safe", bodyText: "Safe response" },
      sendAt: new Date(Date.now() - 1_000)
    });

    const send = await repository.claimSend("crashed-send-worker", -1);
    const response = await repository.claimResponse("crashed-response-worker", -1);
    assert.equal((await repository.reserveSendCapacity(send, "radio.example", {
      dailyLimit: 10,
      releaseLimit: 10,
      domainLimit: 10,
      businessDate: businessDate()
    })).allowed, true);
    const sendCorrelationId = await repository.beginDeliveryAttempt(send);
    const responseCorrelationId = await repository.beginResponseAttempt(response);

    assert.deepEqual(await repository.quarantineStaleDeliveryClaims(), { sends: 1, responses: 1, allocations: 0 });
    assert.equal(await repository.markSendAccepted(send, sendCorrelationId, "late-provider-send"), false);
    assert.equal(await repository.markResponseAccepted(response, responseCorrelationId, "late-provider-response"), false);
    assert.deepEqual(await repository.quarantineStaleDeliveryClaims(), { sends: 0, responses: 0, allocations: 0 });

    const state = await pool.query(
      `SELECT
         (SELECT status FROM send_queue WHERE id=$1) AS send_status,
         (SELECT provider_message_id FROM send_queue WHERE id=$1) AS send_provider_id,
         (SELECT status FROM response_queue WHERE id=$2) AS response_status,
         (SELECT provider_message_id FROM response_queue WHERE id=$2) AS response_provider_id,
         (SELECT status FROM delivery_attempts WHERE send_queue_id=$1) AS send_attempt_status,
         (SELECT status FROM response_delivery_attempts WHERE response_queue_id=$2) AS response_attempt_status,
         (SELECT status FROM send_capacity_reservations WHERE send_queue_id=$1) AS reservation_status,
         (SELECT count(*)::int FROM outcome_events WHERE provider_event_id=$3) AS quarantine_outcomes`,
      [send.id, response.id, `lease-expired:${send.id}`]
    );
    assert.deepEqual(state.rows[0], {
      send_status: "delivery_unknown",
      send_provider_id: null,
      response_status: "delivery_unknown",
      response_provider_id: null,
      send_attempt_status: "delivery_unknown",
      response_attempt_status: "delivery_unknown",
      reservation_status: "consumed",
      quarantine_outcomes: 1
    });
    assert.equal(await repository.claimSend("replacement-worker"), undefined);
    assert.equal(await repository.claimResponse("replacement-worker"), undefined);

    await repository.enqueueResponse({
      matchId: "lease-match-2",
      releaseId: "lease-release",
      contactId: "lease-contact",
      outletId: "lease-outlet",
      idempotencyKey: "lease-response-2",
      deterministicMessageId: "<lease-response-2@example.test>",
      payload: { to: "lease-test@radio.example", subject: "Re: Safe", bodyText: "Second safe response" },
      sendAt: new Date(Date.now() - 1_000)
    });
    const secondResponse = await repository.claimResponse("replacement-worker");
    const approvedDate = businessDate();
    const approvedWindow = businessDayUtcRange(approvedDate);
    assert.deepEqual(await repository.authorizeClaimedResponse(secondResponse, {
      globalDailyLimit: 1,
      contactDailyLimit: 1,
      businessDate: approvedDate,
      businessDayStart: approvedWindow.start,
      businessDayEnd: approvedWindow.end
    }), { allowed: false, reason: "automatic_response_global_limit" });
  });

  test("the PostgreSQL pool reconnects after an idle backend is terminated", async (t) => {
    const { pool, database } = await createRepository(t);
    let idleErrors = 0;
    pool.on("error", () => { idleErrors += 1; });
    const first = await pool.query("SELECT pg_backend_pid()::int AS pid");
    const killer = new Pool({ connectionString: database.url, max: 1 });
    t.after(() => killer.end());

    const terminated = await killer.query("SELECT pg_terminate_backend($1) AS terminated", [first.rows[0].pid]);
    assert.equal(terminated.rows[0].terminated, true);
    await waitUntil(() => idleErrors > 0, 2_000);

    const recovered = await pool.query("SELECT pg_backend_pid()::int AS pid, 42::int AS value");
    t.diagnostic(JSON.stringify({ terminatedPid: first.rows[0].pid, recoveredPid: recovered.rows[0].pid, idleErrors }));
    assert.equal(recovered.rows[0].value, 42);
    assert.notEqual(recovered.rows[0].pid, first.rows[0].pid);
    assert.ok(pool.totalCount <= 10);
  });

  test("provider timeout aborts promptly and is classified delivery-unknown", async (t) => {
    let calls = 0;
    const client = new MailgunClient({
      baseUrl: "https://api.mailgun.invalid",
      domain: "mail.example.test",
      apiKey: "not-a-real-key",
      from: "MarcsMusic <music@mail.example.test>",
      replyTo: "reply@mail.example.test"
    }, {
      timeoutMs: 30,
      fetch: async (_url, options) => {
        calls += 1;
        return new Promise((resolve, reject) => {
          const abort = () => reject(Object.assign(new Error("aborted by timeout"), { name: "AbortError" }));
          if (options.signal.aborted) abort();
          else options.signal.addEventListener("abort", abort, { once: true });
        });
      }
    });

    const startedAt = performance.now();
    await assert.rejects(
      client.send({
        to: "nobody@example.test",
        subject: "Bounded timeout",
        text: "No external request is performed.",
        correlationId: "timeout-test",
        messageId: "<timeout-test@example.test>"
      }),
      (error) => error.code === "MAILGUN_TIMEOUT" && error.deliveryUnknown === true && error.retryable === false
    );
    const totalMs = performance.now() - startedAt;
    t.diagnostic(JSON.stringify({ timeoutConfiguredMs: 30, observedMs: round(totalMs), calls }));
    assert.equal(calls, 1);
    assert.ok(totalMs >= 20, `timeout fired implausibly early (${round(totalMs)}ms)`);
    assert.ok(totalMs < 1_000, `timeout did not abort promptly (${round(totalMs)}ms)`);
  });
});

async function createRepository(t) {
  const database = await cluster.createDatabase();
  const pool = createPostgresPool({ url: database.url, ssl: false });
  t.after(() => pool.end());
  await runMigrations(pool);
  return { database, pool, repository: new OutreachRepository({ pool, cryptoBox }) };
}

function httpConfig(maxInFlightRequests = 64) {
  return Object.freeze({
    http: Object.freeze({ maxInFlightRequests }),
    espocrm: Object.freeze({ webhookSecrets: Object.freeze({ [ESPO_WEBHOOK_ID]: ESPO_WEBHOOK_SECRET }) }),
    mailgun: Object.freeze({ webhookSigningKey: "mailgun-load-signing-key-with-at-least-32-bytes" }),
    crypto: Object.freeze({ unsubscribeSigning: Object.freeze({
      schemaVersion: 2,
      active: Object.freeze({ kid: "unsub-load-2026-07", key: "load-unsubscribe-signing-key-with-at-least-32-bytes" }),
      verifyOnly: Object.freeze([])
    }) }),
    metricsToken: "load-metrics-token-with-at-least-32-bytes",
    safety: Object.freeze({ killSwitch: true, sendEnabled: false })
  });
}

function espoSignature(rawBody) {
  const digest = createHmac("sha256", ESPO_WEBHOOK_SECRET).update(rawBody).digest("hex");
  return Buffer.from(`${ESPO_WEBHOOK_ID}:${digest}`, "utf8").toString("base64");
}

async function runBounded(total, concurrency, work) {
  let nextIndex = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= total) return;
      await work(index);
    }
  }));
}

function percentile(values, quantile) {
  const ordered = Array.from(values).sort((left, right) => left - right);
  if (!ordered.length) return 0;
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * quantile) - 1)];
}

async function waitUntil(predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(`condition not reached within ${timeoutMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function round(value) {
  return Math.round(Number(value) * 100) / 100;
}
