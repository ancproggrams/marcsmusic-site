import assert from "node:assert/strict";
import test from "node:test";

import { createReconcileService } from "../src/application/reconcile-service.mjs";
import { EspoCrmClient } from "../src/infrastructure/espocrm-client.mjs";
import { Metrics } from "../src/infrastructure/metrics.mjs";

const logger = Object.freeze({ info() {}, warn() {}, error() {} });

test("Espo iteration uses a fixed (modifiedAt,id) cursor without offsets or equal-timestamp drift", async () => {
  const records = [
    { id: "a", modifiedAt: "2026-07-15 09:00:00", name: "A" },
    { id: "b", modifiedAt: "2026-07-15 10:00:00", name: "B" },
    { id: "c", modifiedAt: "2026-07-15 10:00:00", name: "C" },
    { id: "d", modifiedAt: "2026-07-15 10:00:00", name: "D" },
    { id: "e", modifiedAt: "2026-07-15 11:00:00", name: "E" },
    { id: "after-watermark", modifiedAt: "2026-07-15 12:00:01", name: "future" }
  ];
  const requests = [];
  const client = new EspoCrmClient({
    baseUrl: "https://crm.example.test",
    apiKey: "api-key-for-keyset-test",
    timeoutMs: 1_000,
    maxPageSize: 3
  }, {
    async fetch(url) {
      const search = JSON.parse(decodeURIComponent(new URL(url).searchParams.get("searchParams")));
      requests.push(search);
      assert.equal(Object.hasOwn(search, "offset"), false);
      let page = records.filter((record) => matchesWhere(record, search.where ?? []));
      if (search.orderBy === "id") page.sort((left, right) => left.id.localeCompare(right.id));
      else {
        page.sort((left, right) => left.modifiedAt.localeCompare(right.modifiedAt) || right.id.localeCompare(left.id));
        // Simulate Espo's unspecified tie order for modifiedAt. The client must
        // re-read the boundary timestamp by id instead of trusting this order.
      }
      return new Response(JSON.stringify({ list: page.slice(0, search.maxSize) }), { status: 200 });
    },
    async sleep() {}
  });

  const pages = [];
  for await (const page of client.iterateModifiedBetween(
    "MusicRelease",
    new Date("2026-07-15T08:00:00Z"),
    new Date("2026-07-15T12:00:00Z"),
    { maxRecords: 10 }
  )) pages.push(...page);

  assert.deepEqual(pages.map(({ id }) => id), ["a", "b", "c", "d", "e"]);
  assert.equal(new Set(pages.map(({ id }) => id)).size, pages.length);
  assert.ok(requests.some((request) => request.orderBy === "id"));
  for (const request of requests) {
    const upper = request.where?.find((item) => item.attribute === "modifiedAt" && item.type === "lessThanOrEquals");
    if (upper) assert.equal(upper.value, "2026-07-15 12:00:00");
  }

  const resumed = [];
  for await (const page of client.iterateModifiedBetween(
    "MusicRelease",
    new Date("2026-07-15T08:00:00Z"),
    new Date("2026-07-15T12:00:00Z"),
    { maxRecords: 10, cursor: { modifiedAt: "2026-07-15T10:00:00Z", id: "b" } }
  )) resumed.push(...page);
  assert.deepEqual(resumed.map(({ id }) => id), ["c", "d", "e"]);
});

test("reconciliation checkpoints every committed keyset page and completes watermark atomically", async () => {
  const now = new Date("2026-07-15T12:00:00Z");
  const checkpoints = [];
  const enqueued = [];
  const repository = {
    async getWatermark() { return "2026-07-15T10:00:00Z"; },
    async acquireReconcileWorkflow(input) {
      return {
        acquired: true,
        leaseName: input.leaseName,
        ownerId: input.ownerId,
        fenceToken: 4,
        runId: "run-1",
        watermarkFrom: input.watermarkFrom,
        watermarkTo: input.watermarkTo,
        routeIndex: 0,
        counters: {},
        resumed: false
      };
    },
    async renewReconcileWorkflow() { return true; },
    async enqueueWorkBatch(items) { enqueued.push(...items); return items.length; },
    async checkpointReconcileWorkflow(_lease, checkpoint) { checkpoints.push(checkpoint); return checkpoints.length; },
    async completeReconcileWorkflow(_lease, completion) { this.completion = completion; },
    async failReconcileWorkflow() { throw new Error("successful workflow must not fail"); }
  };
  const espocrm = {
    async *iterateModifiedBetween(entityType, from, to, options) {
      assert.equal(from.toISOString(), "2026-07-15T09:55:00.000Z");
      assert.equal(to.toISOString(), now.toISOString());
      assert.equal(options.cursor, undefined);
      if (entityType === "MusicRelease") {
        yield [{ id: "release-a", modifiedAt: "2026-07-15 11:00:00" }];
        yield [{ id: "release-b", modifiedAt: "2026-07-15 11:00:01" }];
      }
    }
  };
  const service = createReconcileService({
    espocrm,
    repository,
    config: { schedules: { reconcileOverlapMinutes: 5, reconcileLeaseSeconds: 60, reconcileMaxRecordsPerEntity: 10_000 } },
    logger,
    metrics: new Metrics()
  });

  const result = await service.run({ now });

  assert.equal(result.succeeded, true);
  assert.deepEqual(enqueued.map(({ entityId }) => entityId), ["release-a", "release-b"]);
  assert.deepEqual(checkpoints.slice(0, 2).map(({ cursor }) => cursor), [
    { modifiedAt: "2026-07-15T11:00:00.000Z", id: "release-a" },
    { modifiedAt: "2026-07-15T11:00:01.000Z", id: "release-b" }
  ]);
  assert.equal(repository.completion.watermarkValue.toISOString(), now.toISOString());
  assert.equal(repository.completion.routeIndex, 5);
});

test("a held reconcile lease is retryable and does not start a second scan", async () => {
  let scans = 0;
  const service = createReconcileService({
    espocrm: { async *iterateModifiedBetween() { scans += 1; } },
    repository: {
      async getWatermark() { return new Date(0); },
      async acquireReconcileWorkflow() { return { acquired: false, reason: "lease_held" }; }
    },
    config: { schedules: { reconcileOverlapMinutes: 5, reconcileLeaseSeconds: 60 } },
    logger,
    metrics: new Metrics()
  });

  await assert.rejects(service.run(), (error) => error.code === "RECONCILE_LEASE_HELD" && error.retryable === true);
  assert.equal(scans, 0);
});

function matchesWhere(record, where) {
  return where.every((item) => {
    const actual = record[item.attribute];
    if (item.type === "equals") return actual === item.value;
    if (item.type === "greaterThan") return actual > item.value;
    if (item.type === "greaterThanOrEquals") return actual >= item.value;
    if (item.type === "lessThanOrEquals") return actual <= item.value;
    return true;
  });
}
