import assert from "node:assert/strict";
import test from "node:test";

import { createDailyReportService } from "../src/application/daily-report-service.mjs";
import {
  planDailyReports,
  scheduleDailyReports,
  validateDailyReportWork
} from "../src/application/daily-report-scheduler.mjs";
import { createWorkService } from "../src/application/work-service.mjs";
import { EspoCrmClient } from "../src/infrastructure/espocrm-client.mjs";
import { Metrics } from "../src/infrastructure/metrics.mjs";

const logger = Object.freeze({ info() {}, warn() {}, error() {} });

test("scheduler uses two finite immutable slots and catches up missing final dates after downtime", async () => {
  const beforeClosing = planDailyReports({ now: new Date("2026-07-15T21:29:00.000Z") });
  assert.equal(beforeClosing.length, 7);
  assert.equal(beforeClosing.some(({ reportDate }) => reportDate === "2026-07-15"), false);

  const closing = planDailyReports({ now: new Date("2026-07-15T21:30:00.000Z") });
  assert.equal(closing.length, 8);
  assert.deepEqual(closing[0], {
    reportDate: "2026-07-15",
    scheduleSlot: "preliminary-2330-v1",
    slotRank: 1,
    dedupeKey: "daily-report:2026-07-15:preliminary-2330-v1"
  });
  assert.equal(new Set(closing.map(({ dedupeKey }) => dedupeKey)).size, closing.length);

  // The worker was down throughout 23:30-00:00. Startup after midnight still
  // schedules the immutable final slot for the complete missed business date.
  const restarted = planDailyReports({ now: new Date("2026-07-15T22:05:00.000Z") });
  assert.ok(restarted.some((entry) =>
    entry.reportDate === "2026-07-15" && entry.scheduleSlot === "final-next-day-v1"
  ));

  const rows = new Map();
  const repository = {
    async enqueueDailyReportWork(entry) {
      if (rows.has(entry.dedupeKey)) return undefined;
      rows.set(entry.dedupeKey, structuredClone(entry));
      return `work-${rows.size}`;
    }
  };
  const first = await scheduleDailyReports(repository, { now: new Date("2026-07-15T22:05:00.000Z") });
  const replay = await scheduleDailyReports(repository, { now: new Date("2026-07-15T22:05:00.000Z") });
  assert.equal(first.inserted, 7);
  assert.equal(replay.inserted, 0);
  assert.equal(rows.size, 7, "scheduler replay must remain O(1) rows per report date");
});

test("report work rejects premature, future, old and malformed identities", () => {
  const now = new Date("2026-07-15T12:00:00.000Z");
  assert.throws(
    () => validateDailyReportWork({ reportDate: "2026-07-15", scheduleSlot: "preliminary-2330-v1", slotRank: 1, now }),
    ({ code }) => code === "DAILY_REPORT_PRELIMINARY_TOO_EARLY"
  );
  assert.throws(
    () => validateDailyReportWork({ reportDate: "2026-07-15", scheduleSlot: "final-next-day-v1", slotRank: 2, now }),
    ({ code }) => code === "DAILY_REPORT_FINAL_TOO_EARLY"
  );
  assert.throws(
    () => validateDailyReportWork({ reportDate: "2026-07-16", scheduleSlot: "final-next-day-v1", slotRank: 2, now }),
    ({ code }) => code === "DAILY_REPORT_DATE_FUTURE"
  );
  assert.throws(
    () => validateDailyReportWork({ reportDate: "2026-07-07", scheduleSlot: "final-next-day-v1", slotRank: 2, now }),
    ({ code }) => code === "DAILY_REPORT_DATE_TOO_OLD"
  );
  assert.throws(
    () => validateDailyReportWork({ reportDate: "2026-02-30", scheduleSlot: "final-next-day-v1", slotRank: 2, now }),
    ({ code }) => code === "DAILY_REPORT_DATE_INVALID"
  );
});

test("final recomputation converges one date-keyed report and covers 23/25-hour Amsterdam days", async () => {
  for (const scenario of [
    { reportDate: "2026-03-29", now: "2026-03-30T10:00:00.000Z", hours: 23 },
    { reportDate: "2026-07-15", now: "2026-07-16T10:00:00.000Z", hours: 24 },
    { reportDate: "2026-10-25", now: "2026-10-26T10:00:00.000Z", hours: 25 }
  ]) {
    const reports = new Map();
    const windows = [];
    let sent = 1;
    let projectedRank = 0;
    const repository = {
      async withDailyReportProjectionFence(slot, work) {
        if (slot.slotRank < projectedRank) return { skipped: true };
        const value = await work();
        projectedRank = slot.slotRank;
        return { skipped: false, value };
      },
      async summaryForDate(window) {
        windows.push(window);
        return { initial_emails_sent: sent };
      },
      async jobSummaryForDate() { return { failed_jobs: 0 }; }
    };
    const espocrm = reportEspo(reports);
    const service = createDailyReportService({ espocrm, repository, logger, metrics: new Metrics() });

    await service.generate({
      reportDate: scenario.reportDate,
      scheduleSlot: "final-next-day-v1",
      slotRank: 2,
      now: new Date(scenario.now)
    });
    sent = 2;
    await service.generate({
      reportDate: scenario.reportDate,
      scheduleSlot: "final-next-day-v1",
      slotRank: 2,
      now: new Date(scenario.now)
    });

    assert.equal(reports.size, 1);
    assert.equal(reports.get(scenario.reportDate).initialEmailsSent, 2);
    assert.equal((windows[0].end - windows[0].start) / 3_600_000, scenario.hours);
    const finalQuarterHour = new Date(windows[0].end.getTime() - 15 * 60_000);
    assert.ok(finalQuarterHour >= windows[0].start && finalQuarterHour < windows[0].end);
  }
});

test("a crash after Espo upsert retries the same immutable work and converges", async () => {
  const reports = new Map();
  const queueItem = {
    id: "work-final-1",
    kind: "create_daily_report",
    entity_type: "OutreachDailyReport",
    entity_id: "2026-07-15",
    dedupe_key: "daily-report:2026-07-15:final-next-day-v1",
    payload: { reportDate: "2026-07-15", scheduleSlot: "final-next-day-v1", slotRank: 2 },
    attempts: 1,
    locked_by: "worker-1",
    lease_version: 1
  };
  const claims = [queueItem, { ...queueItem, attempts: 2, lease_version: 2 }];
  const calls = { failed: 0, completed: 0, generated: 0 };
  const reportRepository = {
    async withDailyReportProjectionFence(_slot, work) { return { skipped: false, value: await work() }; },
    async summaryForDate() { return { initial_emails_sent: 3 }; },
    async jobSummaryForDate() { return { failed_jobs: 0 }; }
  };
  const actual = createDailyReportService({
    espocrm: reportEspo(reports),
    repository: reportRepository,
    logger,
    metrics: new Metrics()
  });
  const dailyReportService = {
    async generate(payload) {
      calls.generated += 1;
      const value = await actual.generate({ ...payload, now: new Date("2026-07-16T10:00:00.000Z") });
      if (calls.generated === 1) throw Object.assign(new Error("crash after projection"), { code: "PROCESS_CRASH", retryable: true });
      return value;
    }
  };
  const repository = {
    async claimWork() { return claims.shift(); },
    async failWork() { calls.failed += 1; return true; },
    async completeWork() { calls.completed += 1; return true; }
  };
  const workService = createWorkService({
    repository,
    matchService: {}, eventService: {}, sendService: {}, crmProjectionService: {}, reconcileService: {},
    dailyReportService, healthService: {}, espocrm: {}, logger, metrics: new Metrics()
  });

  assert.equal((await workService.processOne("worker-1")).succeeded, false);
  assert.equal((await workService.processOne("worker-1")).succeeded, true);
  assert.deepEqual(calls, { failed: 1, completed: 1, generated: 2 });
  assert.equal(reports.size, 1);
  assert.equal(reports.get("2026-07-15").initialEmailsSent, 3);
});

test("work dispatch rejects a reportDate that is not bound to the entity identity", async () => {
  const failures = [];
  const repository = {
    async claimWork() {
      return {
        id: "work-tampered",
        kind: "create_daily_report",
        entity_id: "2026-07-15",
        payload: { reportDate: "2026-07-14", scheduleSlot: "final-next-day-v1", slotRank: 2 },
        attempts: 1,
        locked_by: "worker-1",
        lease_version: 1
      };
    },
    async failWork(_item, code, retryable) { failures.push({ code, retryable }); return true; }
  };
  const workService = createWorkService({
    repository,
    matchService: {}, eventService: {}, sendService: {}, crmProjectionService: {}, reconcileService: {},
    dailyReportService: { async generate() { throw new Error("tampered work must not execute"); } },
    healthService: {}, espocrm: {}, logger, metrics: new Metrics()
  });

  const result = await workService.processOne("worker-1");
  assert.equal(result.succeeded, false);
  assert.deepEqual(failures, [{ code: "DAILY_REPORT_WORK_IDENTITY_INVALID", retryable: false }]);
});

function reportEspo(reports) {
  return {
    async aggregateDailyReport() {
      return {
        newContacts: 0,
        validatedContacts: 0,
        duplicateContacts: 0,
        eligibleContacts: 0,
        blockedContacts: 0,
        matchesCreated: 0
      };
    },
    async upsertByUnique(entityType, attribute, value, payload) {
      assert.deepEqual([entityType, attribute], ["OutreachDailyReport", "reportDate"]);
      const current = reports.get(value);
      const record = { id: current?.id ?? `report-${value}`, ...payload };
      reports.set(value, record);
      return record;
    }
  };
}

test("Espo client uses a bounded server aggregate and rejects malformed counters", async () => {
  const requests = [];
  const client = new EspoCrmClient({
    baseUrl: "https://crm.example.test",
    apiKey: "test-key",
    timeoutMs: 1_000,
    maxPageSize: 50
  }, {
    async fetch(url, options) {
      requests.push({ url, options });
      return new Response(JSON.stringify({
        newContacts: 11,
        validatedContacts: 7,
        duplicateContacts: 2,
        eligibleContacts: 5,
        blockedContacts: 3,
        matchesCreated: 13
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
  });

  assert.deepEqual(await client.aggregateDailyReport({
    start: new Date("2026-07-14T22:00:00.000Z"),
    end: new Date("2026-07-15T22:00:00.000Z")
  }), {
    newContacts: 11,
    validatedContacts: 7,
    duplicateContacts: 2,
    eligibleContacts: 5,
    blockedContacts: 3,
    matchesCreated: 13
  });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.method, "GET");
  const endpoint = new URL(requests[0].url);
  assert.equal(endpoint.pathname, "/api/v1/OutreachDailyReport/aggregate");
  assert.equal(endpoint.searchParams.get("start"), "2026-07-14 22:00:00");
  assert.equal(endpoint.searchParams.get("end"), "2026-07-15 22:00:00");

  client.fetch = async () => new Response(JSON.stringify({
    newContacts: 1,
    validatedContacts: 1,
    duplicateContacts: 0,
    eligibleContacts: 1,
    blockedContacts: -1,
    matchesCreated: 1
  }), { status: 200, headers: { "content-type": "application/json" } });
  await assert.rejects(
    () => client.aggregateDailyReport({
      start: new Date("2026-07-14T22:00:00.000Z"),
      end: new Date("2026-07-15T22:00:00.000Z")
    }),
    ({ code, retryable }) => code === "ESPOCRM_DAILY_REPORT_AGGREGATE_INVALID" && retryable === false
  );
});
