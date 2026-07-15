import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import { businessDate, businessDayUtcRange } from "../src/application/date-utils.mjs";
import { MailgunClient } from "../src/infrastructure/mailgun-client.mjs";
import { Metrics } from "../src/infrastructure/metrics.mjs";
import { startWorker } from "../src/worker.mjs";

const logger = Object.freeze({ info() {}, warn() {}, error() {} });

test("Amsterdam business dates and DST day windows are explicit", () => {
  assert.equal(businessDate(new Date("2026-07-14T22:30:00.000Z")), "2026-07-15");
  const spring = businessDayUtcRange("2026-03-29");
  const autumn = businessDayUtcRange("2026-10-25");
  assert.equal((spring.end - spring.start) / 3_600_000, 23);
  assert.equal((autumn.end - autumn.start) / 3_600_000, 25);
});

test("worker shutdown stops claiming and relinquishes every lane within its bounded budget", async () => {
  const abortController = new AbortController();
  const calls = { work: 0, response: 0, send: 0, relinquished: [] };
  const waitForStop = (signal) => signal.aborted
    ? Promise.resolve()
    : new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
  const container = {
    config: {
      processMode: "worker",
      schedules: {
        workPollMs: 5,
        sendPollMs: 5,
        reconcileIntervalMs: 60_000,
        healthIntervalMs: 60_000,
        shutdownTimeoutMs: 5_000
      },
      concurrency: { safetyEvents: 2, projections: 1, matching: 1, maintenance: 1, sending: 1 }
    },
    logger,
    workService: {
      async processOne(_workerId, { signal }) {
        calls.work += 1;
        await waitForStop(signal);
        return { processed: false, reason: "worker_stopping" };
      }
    },
    sendService: {
      async sendResponseOne(_workerId, { signal }) {
        calls.response += 1;
        await waitForStop(signal);
        return { processed: false, reason: "worker_stopping" };
      },
      async sendOne() {
        calls.send += 1;
        return { processed: false };
      }
    },
    healthService: { async evaluate() {} },
    repository: {
      async enqueueWork() {},
      async relinquishWorkerLeases(workerIds) {
        calls.relinquished.push(...workerIds);
        return { work: workerIds.length };
      }
    }
  };

  const worker = startWorker(container, { signal: abortController.signal });
  await delay(10);
  const claimsBeforeStop = calls.work + calls.response;
  abortController.abort(new Error("test shutdown"));
  const startedAt = Date.now();
  const result = await worker.shutdown({ timeoutMs: 5_000 });
  const elapsedMs = Date.now() - startedAt;
  await delay(20);

  assert.equal(result.drained, true);
  assert.ok(elapsedMs < 1_000, `shutdown took ${elapsedMs}ms`);
  assert.equal(calls.work + calls.response, claimsBeforeStop, "no lane may claim after shutdown starts");
  assert.deepEqual(new Set(calls.relinquished), new Set(worker.workerIds));
  assert.equal(calls.send, 0, "the send lane must not move from response to send after abort");
});

test("an externally aborted provider request is prompt and remains delivery-unknown", async () => {
  const abortController = new AbortController();
  const client = new MailgunClient({
    baseUrl: "https://api.example.test",
    domain: "mail.example.test",
    apiKey: "test-key",
    from: "MarcsMusic <music@example.test>",
    replyTo: "music@example.test"
  }, {
    signal: abortController.signal,
    timeoutMs: 10_000,
    fetch: async (_url, { signal }) => new Promise((_, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    })
  });
  const request = client.send({
    to: "editor@example.test",
    subject: "Safe subject",
    text: "Safe body",
    correlationId: "shutdown-test"
  });
  abortController.abort(new Error("shutdown"));

  await assert.rejects(request, (error) => error.code === "MAILGUN_ABORTED" && error.deliveryUnknown === true);
});

test("observability supervisor serializes capture, prune and projection and stops retrying on shutdown", async () => {
  const abortController = new AbortController();
  const calls = { capture: 0, prune: 0, project: 0, active: 0, maximumActive: 0 };
  const metrics = new Metrics();
  const container = {
    config: {
      processMode: "worker",
      schedules: {
        workPollMs: 50,
        sendPollMs: 50,
        reconcileIntervalMs: 60_000,
        healthIntervalMs: 60_000,
        shutdownTimeoutMs: 5_000
      },
      concurrency: { safetyEvents: 0, projections: 0, matching: 0, maintenance: 0, sending: 0 },
      observability: {
        enabled: true,
        policy: { policyVersion: "runtime-test-v1" },
        captureIntervalMs: 12,
        pruneIntervalMs: 15,
        retryIntervalMs: 3,
        pruneMaxBatches: 2,
        projector: { intervalMs: 10, batchSize: 5, maximumBacklog: 20 }
      }
    },
    logger,
    metrics,
    workService: { async processOne() { return { processed: false }; } },
    sendService: {
      async sendResponseOne() { return { processed: false }; },
      async sendOne() { return { processed: false }; }
    },
    healthService: { async evaluate() {} },
    repository: {
      async enqueueWork() {},
      async relinquishWorkerLeases() { return {}; }
    },
    operationalObservabilityRepository: {
      async tryRunRuntimeExclusive(work) {
        calls.active += 1;
        calls.maximumActive = Math.max(calls.maximumActive, calls.active);
        try {
          await delay(2);
          return { acquired: true, value: await work() };
        } finally {
          calls.active -= 1;
        }
      }
    },
    operationalMetricCollector: {
      async collect() { return { outreach_oldest_event_seconds: 0 }; }
    },
    operationalObservabilityService: {
      async prune() {
        calls.prune += 1;
        return { completed: true, batches: 1, deleted: { snapshots: 0, rollups: 0, evaluations: 0, events: 0 } };
      },
      async capture() {
        calls.capture += 1;
        return {
          snapshot: { snapshotDigest: "a".repeat(64), replayed: false },
          evaluations: [{ ruleId: "event-lag", decision: "healthy" }]
        };
      }
    },
    operationalAlertDeliveryRepository: {
      async projectBatch() {
        calls.project += 1;
        return {
          projected: 0,
          cursor: 0,
          backlog: 0,
          deadLetters: 0,
          hasMore: false,
          backpressured: false,
          contended: false
        };
      }
    }
  };

  const worker = startWorker(container, { signal: abortController.signal });
  await delay(55);
  abortController.abort(new Error("runtime test shutdown"));
  await worker.shutdown({ timeoutMs: 5_000 });
  const stoppedAt = { capture: calls.capture, prune: calls.prune, project: calls.project };
  await delay(30);

  assert.ok(calls.capture >= 2);
  assert.ok(calls.prune >= 2);
  assert.ok(calls.project >= 2);
  assert.equal(calls.maximumActive, 1);
  assert.deepEqual(
    { capture: calls.capture, prune: calls.prune, project: calls.project },
    stoppedAt,
    "shutdown must stop every supervised retry/cadence"
  );
  assert.match(metrics.render(), /outreach_observability_runtime_runs_total/u);
  assert.match(metrics.render(), /outreach_alert_delivery_outbox_backlog 0/u);
});
