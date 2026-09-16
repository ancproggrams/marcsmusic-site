import test from "node:test";
import assert from "node:assert/strict";
import {
  fetchTransparanteBrokerAssignments,
  mergeAssignments,
  normalizeTransparanteBrokerAssignment
} from "../lib/transparante-broker.js";

test("normalizes a Transparante Broker assignment into the local schema", () => {
  const assignment = normalizeTransparanteBrokerAssignment({
    id: 60513,
    title: "Senior Medewerker IV",
    employer: "NVWA",
    client: { name: "Nederlandse Voedsel- en Warenautoriteit (NVWA)" },
    hoursMin: 24,
    freelancerAllowed: "YES",
    storageDate: "2026-07-24T16:10:44.204056Z"
  });

  assert.equal(assignment.id, "de-transparante-broker:60513");
  assert.equal(assignment.source, "de-transparante-broker");
  assert.equal(assignment.client, "Nederlandse Voedsel- en Warenautoriteit (NVWA)");
  assert.equal(assignment.publishedAt, "2026-07-24T16:10:44.204Z");
  assert.match(assignment.sourceUrl, /senior-medewerker-iv\/nederlandse-voedsel-en-warenautoriteit-nvwa\/60513$/);
});

test("fetches every page and rejects incomplete imports", async () => {
  const requestedPages = [];
  const fetchImpl = async (url, options) => {
    const page = Number(url.searchParams.get("page"));
    requestedPages.push(page);
    assert.equal(options.headers["x-tenant-id"], "dtb");
    return new Response(JSON.stringify({
      content: page === 0 ? [{ id: 2, title: "Twee" }] : [{ id: 1, title: "Een" }],
      totalElements: 2,
      last: page === 1
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  const assignments = await fetchTransparanteBrokerAssignments({
    baseUrl: "https://example.test",
    fetchImpl,
    pageSize: 1
  });

  assert.deepEqual(requestedPages, [0, 1]);
  assert.deepEqual(assignments.map((assignment) => assignment.externalId), ["2", "1"]);
});

test("rejects a source whose total changes during pagination", async () => {
  const requestedPages = [];
  const fetchImpl = async (url) => {
    const page = Number(url.searchParams.get("page"));
    requestedPages.push(page);
    const content = page === 0
      ? [{ id: 3, title: "Drie" }, { id: 2, title: "Twee" }]
      : [{ id: 1, title: "Een" }];
    return new Response(JSON.stringify({
      content,
      totalElements: page === 0 ? 3 : 5,
      last: false
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  await assert.rejects(fetchTransparanteBrokerAssignments({ baseUrl: "https://example.test", fetchImpl, pageSize: 2 }), /Bron veranderde/);
  assert.deepEqual(requestedPages, [0, 1]);
});

test("rejects pagination that reaches the safety cap without a complete signal", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response(JSON.stringify({ content: [{ id: calls }], last: false }), { status: 200 });
  };
  await assert.rejects(fetchTransparanteBrokerAssignments({ baseUrl: "https://example.test", fetchImpl, pageSize: 1 }), /Onvolledige synchronisatie/);
  assert.equal(calls, 100);
});

test("rejects duplicate IDs across pages", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ content: [{ id: 1 }], totalElements: 2, last: false }), { status: 200 });
  await assert.rejects(fetchTransparanteBrokerAssignments({ baseUrl: "https://example.test", fetchImpl, pageSize: 1 }), /Dubbel ID/);
});

test("merge is idempotent and deactivates assignments absent from a complete sync", () => {
  const syncedAt = "2026-07-25T10:00:00.000Z";
  const existing = [
    { id: "de-transparante-broker:1", source: "de-transparante-broker", active: true, firstSeenAt: "old" },
    { id: "de-transparante-broker:2", source: "de-transparante-broker", active: true, firstSeenAt: "old" },
    { id: "other:1", source: "other", active: true }
  ];
  const incoming = [
    { id: "de-transparante-broker:2", source: "de-transparante-broker", externalId: "2", active: true }
  ];

  const merged = mergeAssignments(existing, incoming, syncedAt);
  assert.equal(merged.find((entry) => entry.id === "de-transparante-broker:1").active, false);
  assert.equal(merged.filter((entry) => entry.id === "de-transparante-broker:2").length, 1);
  assert.equal(merged.find((entry) => entry.id === "de-transparante-broker:2").firstSeenAt, "old");
  assert.equal(merged.find((entry) => entry.id === "other:1").active, true);
});
