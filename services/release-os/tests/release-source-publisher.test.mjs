import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { test } from "node:test";
import {
  createReleaseSourcePublisher,
  loadReleaseSourceConfig,
  recoverReleaseSourceDeadLetter,
  stageReleaseSourceOutbox
} from "../src/infrastructure/outreach/release-source-publisher.mjs";

const SECRET = "release-os-source-secret-with-more-than-32-characters";
const KEY_ID = "release-os-2026-07";

test("release source outbox persists exact retry bytes with fresh request credentials", async () => {
  const state = releaseState();
  const store = memoryStore(state);
  const requests = [];
  let calls = 0;
  let clock = new Date("2026-07-15T10:00:00.000Z");
  const nonces = ["nonce-release-1234567890-a", "nonce-release-1234567890-b"];
  const publisher = createReleaseSourcePublisher({
    store,
    config: sourceConfig({ maxAttempts: 2 }),
    fetch: async (url, options) => {
      requests.push({ url, ...options });
      calls += 1;
      return jsonResponse(calls === 1 ? 503 : 201, calls === 1 ? { error: { code: "TEMPORARY" } } : { ok: true });
    },
    now: () => new Date(clock),
    nonce: () => nonces.shift()
  });

  const staged = await store.update((current) => stageReleaseSourceOutbox(current, clock, sourceConfig()));
  assert.equal(staged.outbox.artifact.records.length, 1);
  assert.deepEqual(staged.outbox.artifact.records[0].subGenres, ["Tropical", "World Fusion"]);
  assert.deepEqual(staged.outbox.artifact.records[0].territories, ["NL", "DE"]);
  await assert.rejects(publisher.publishPending(), (error) => error.code === "TEMPORARY");
  assert.equal(state.outreachSourceOutbox.status, "retrying");
  assert.equal(state.outreachSourceOutbox.attemptCount, 1);

  clock = new Date(clock.getTime() + 61_000);
  const result = await publisher.publishPending();
  assert.equal(result.published, true);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].body, requests[1].body);
  assert.notEqual(requests[0].headers["x-source-nonce"], requests[1].headers["x-source-nonce"]);
  assert.notEqual(requests[0].headers["x-source-signature"], requests[1].headers["x-source-signature"]);
  assert.equal(requests[0].url, "https://outreach.example/api/v1/source-ingestion/marcsmusic-release-os");

  const bodyDigest = createHash("sha256").update(requests[0].body).digest("hex");
  const expected = createHmac("sha256", SECRET)
    .update(
      `v2\nmarcsmusic-release-os\n${KEY_ID}\n${requests[0].headers["x-source-timestamp"]}\n${requests[0].headers["x-source-nonce"]}\n${bodyDigest}`
    )
    .digest("hex");
  assert.equal(requests[0].headers["x-source-key-id"], KEY_ID);
  assert.equal(requests[0].headers["x-source-signature"], `v2=${expected}`);
  assert.equal(state.outreachSourceOutbox, null);
  assert.equal(state.outreachSourceCheckpoint.artifactId, result.artifactId);
});

test("an artifact held through a 24-hour outage is re-enveloped without semantic drift", async () => {
  const state = releaseState();
  const store = memoryStore(state);
  const oldTime = new Date("2026-07-13T08:00:00.000Z");
  const current = new Date("2026-07-15T10:00:00.000Z");
  const staged = await store.update((value) => stageReleaseSourceOutbox(value, oldTime, sourceConfig()));
  const oldArtifact = structuredClone(staged.outbox.artifact);
  const semanticDigest = staged.outbox.semanticDigest;
  let submitted;
  const publisher = createReleaseSourcePublisher({
    store,
    config: sourceConfig(),
    fetch: async (_url, options) => {
      submitted = JSON.parse(options.body);
      return jsonResponse(201, { ok: true });
    },
    now: () => new Date(current),
    nonce: () => "nonce-stale-1234567890abcdef"
  });

  const result = await publisher.publishPending();
  assert.equal(result.published, true);
  assert.notEqual(submitted.artifactId, oldArtifact.artifactId);
  assert.equal(submitted.generatedAt, current.toISOString());
  assert.deepEqual(submitted.records, oldArtifact.records);
  assert.equal(state.outreachSourceCheckpoint.semanticDigest, semanticDigest);
  assert.ok(state.audit.some((entry) => entry.action === "outreach.source.envelope_reissued"));
});

test("concurrent release publishers claim one active envelope and replay acknowledgements complete it", async () => {
  const state = releaseState();
  const store = memoryStore(state);
  const current = new Date("2026-07-15T10:00:00.000Z");
  await store.update((value) => stageReleaseSourceOutbox(value, current, sourceConfig()));
  let requests = 0;
  let releaseResponse;
  const responseGate = new Promise((resolve) => { releaseResponse = resolve; });
  const publisher = createReleaseSourcePublisher({
    store,
    config: sourceConfig(),
    fetch: async () => {
      requests += 1;
      await responseGate;
      return jsonResponse(200, { ok: true, result: { replayed: true } });
    },
    now: () => new Date(current),
    nonce: () => "nonce-concurrent-1234567890abcdef"
  });

  const first = publisher.publishPending();
  await new Promise((resolve) => setImmediate(resolve));
  const second = await publisher.publishPending();
  assert.deepEqual(second, {
    published: false,
    reason: "in_progress",
    held: 0,
    artifactId: state.outreachSourceOutbox.artifact.artifactId
  });
  assert.equal(requests, 1);
  releaseResponse();
  const accepted = await first;
  assert.equal(accepted.replayed, true);
  assert.equal(state.outreachSourceCheckpoint.replayed, true);
});

test("downstream rejection dead-letters once and explicit audited recovery creates a fresh bounded envelope", async () => {
  const state = releaseState();
  const store = memoryStore(state);
  let clock = new Date("2026-07-15T10:00:00.000Z");
  let calls = 0;
  const publisher = createReleaseSourcePublisher({
    store,
    config: sourceConfig({ maxAttempts: 2, maxOperatorRecoveries: 1 }),
    fetch: async () => {
      calls += 1;
      return calls === 1
        ? jsonResponse(400, { error: { code: "SOURCE_ARTIFACT_INVALID" } })
        : jsonResponse(201, { ok: true });
    },
    now: () => new Date(clock),
    nonce: () => `nonce-recovery-${calls}-1234567890`
  });

  await assert.rejects(publisher.publishPending(), (error) => error.code === "SOURCE_ARTIFACT_INVALID");
  assert.equal(state.outreachSourceOutbox.status, "dead_letter");
  const rejectedArtifactId = state.outreachSourceOutbox.artifact.artifactId;
  const records = structuredClone(state.outreachSourceOutbox.artifact.records);
  const noRetry = await publisher.publishPending();
  assert.equal(noRetry.reason, "dead_letter");
  assert.equal(calls, 1);

  clock = new Date(clock.getTime() + 1_000);
  const recovered = await store.update((value) => recoverReleaseSourceDeadLetter(value, {
    operator: "marc.rene",
    reason: "Schema rejection was reviewed and corrected upstream.",
    now: clock,
    maxAttempts: 2,
    maxReissues: 1,
    maxOperatorRecoveries: 1
  }));
  assert.notEqual(recovered.artifactId, rejectedArtifactId);
  assert.deepEqual(state.outreachSourceOutbox.artifact.records, records);
  assert.ok(state.audit.some((entry) => entry.action === "outreach.source.dead_letter_recovered"));
  assert.equal((await publisher.publishPending()).published, true);
});

test("downstream stale rejection causes one bounded reissue and never an infinite retry", async () => {
  const state = releaseState();
  const store = memoryStore(state);
  let clock = new Date("2026-07-15T10:00:00.000Z");
  let calls = 0;
  const bodies = [];
  const publisher = createReleaseSourcePublisher({
    store,
    config: sourceConfig({ maxReissues: 1 }),
    fetch: async (_url, options) => {
      calls += 1;
      bodies.push(JSON.parse(options.body));
      return jsonResponse(400, { error: { code: "SOURCE_ARTIFACT_STALE" } });
    },
    now: () => new Date(clock),
    nonce: () => `nonce-downstream-${calls}-1234567890`
  });

  await assert.rejects(publisher.publishPending(), (error) => error.code === "SOURCE_ARTIFACT_STALE");
  assert.equal(state.outreachSourceOutbox.status, "pending");
  clock = new Date(clock.getTime() + 61_000);
  await assert.rejects(publisher.publishPending(), (error) => error.code === "SOURCE_ARTIFACT_STALE");
  assert.equal(state.outreachSourceOutbox.status, "dead_letter");
  assert.notEqual(bodies[0].artifactId, bodies[1].artifactId);
  assert.notEqual(bodies[0].generatedAt, bodies[1].generatedAt);
  assert.deepEqual(bodies[0].records, bodies[1].records);
  assert.equal((await publisher.publishPending()).reason, "dead_letter");
  assert.equal(calls, 2);
});

test("release source producer is disabled by default and enabled config fails closed", () => {
  assert.equal(loadReleaseSourceConfig({}).enabled, false);
  assert.throws(
    () => loadReleaseSourceConfig({ OUTREACH_SOURCE_PUBLISH_ENABLED: "true" }),
    (error) => error.code === "OUTREACH_SOURCE_CONFIG_INVALID"
  );
  assert.throws(
    () => loadReleaseSourceConfig({
      OUTREACH_SOURCE_PUBLISH_ENABLED: "true",
      OUTREACH_SOURCE_INGESTION_BASE_URL: "https://outreach.example",
      OUTREACH_SOURCE_SIGNING_KEY_ID: KEY_ID,
      OUTREACH_SOURCE_SIGNING_KEY: "too-short"
    }),
    (error) => error.code === "OUTREACH_SOURCE_CONFIG_INVALID"
  );
});

function sourceConfig(overrides = {}) {
  return {
    enabled: true,
    baseUrl: "https://outreach.example",
    signingKeyId: KEY_ID,
    signingKey: SECRET,
    intervalMs: 10_000,
    timeoutMs: 1_000,
    maxAttempts: 4,
    maxReissues: 3,
    maxOperatorRecoveries: 3,
    envelopeMaxAgeMs: 23 * 60 * 60 * 1_000,
    ...overrides
  };
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function releaseState() {
  return {
    releases: [{
      id: "release-1",
      title: "Song",
      artistDisplayName: "Artist",
      description: "A production release.",
      genre: "electronic",
      subGenres: ["Tropical", "World Fusion"],
      languages: ["en"],
      territories: ["NL", "DE"],
      isrc: "NLABC1234567",
      epkUrl: "https://music.example/epk",
      sourceUrl: "https://music.example/releases/song",
      sourceEvidence: "The owned release record and EPK identify this release.",
      sourceCapturedAt: "2026-07-15T09:59:00.000Z",
      updatedAt: "2026-07-15T09:59:00.000Z"
    }],
    outreachSourceOutbox: null,
    outreachSourceCheckpoint: null,
    audit: []
  };
}

function memoryStore(state) {
  let queue = Promise.resolve();
  return {
    async update(work) {
      const next = queue.then(() => work(state));
      queue = next.catch(() => {});
      return next;
    }
  };
}
