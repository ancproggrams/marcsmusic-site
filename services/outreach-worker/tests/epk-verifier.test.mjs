import assert from "node:assert/strict";
import test from "node:test";

import { EpkVerificationService } from "../src/application/epk-verification-service.mjs";
import {
  canonicalManifestDigest,
  canonicalSerialize,
  compareEpkToMusicRelease,
  epkAssetChecks,
  parseApprovedHttpsOrigins,
  parseEpkHtmlUrl,
  parseEpkResponse
} from "../src/domain/epk-verification.mjs";
import { ApplicationError } from "../src/errors.mjs";
import { EpkVerificationClient } from "../src/infrastructure/epk-verification-client.mjs";
import { EpkVerificationCrmGateway } from "../src/infrastructure/epk-verification-crm-gateway.mjs";
import { loadEpkVerifierConfig } from "../src/infrastructure/epk-verifier-config.mjs";
import { parseArguments, runEpkVerificationJob } from "../src/jobs/verify-epk.mjs";
import {
  createEpkServiceFixture,
  manifestFixture,
  musicReleaseFixture,
  response
} from "./helpers/epk-service-fixture.mjs";
import { createEpkUrlPolicy, validateEpkManifest } from "../../../src/epk/epk-contract.mjs";

const NOW = new Date("2026-07-15T12:00:00.000Z");

test("EPK verifier is disabled by default and enabled configuration is strict and bounded", async () => {
  assert.deepEqual(loadEpkVerifierConfig({}), { enabled: false });
  const disabled = await runEpkVerificationJob({
    env: {},
    argv: [],
    dependencies: { service: { verifyBatch() { throw new Error("disabled verifier must not run"); } } }
  });
  assert.deepEqual(disabled, { enabled: false, selected: 0, verified: 0, failed: 0 });

  const base = enabledEnvironment();
  const config = loadEpkVerifierConfig(base);
  assert.equal(config.enabled, true);
  assert.equal(config.verifier.maxBatchSize, 10);
  assert.equal(Object.isFrozen(config.verifier), true);
  assert.equal(typeof config.verifier.approvedOrigins.add, "undefined");
  for (const override of [
    { EPK_VERIFIER_APPROVED_HTTPS_ORIGINS: "http://epk.public.test" },
    { EPK_VERIFIER_APPROVED_HTTPS_ORIGINS: "https://epk.public.test/path" },
    { EPK_VERIFIER_APPROVED_HTTPS_ORIGINS: "https://epk.public.test,https://epk.public.test" },
    { EPK_VERIFIER_MAX_REDIRECTS: "4" },
    { EPK_VERIFIER_MAX_BATCH_SIZE: "26" }
  ]) {
    assert.throws(() => loadEpkVerifierConfig({ ...base, ...override }), (error) => error.code === "EPK_VERIFIER_CONFIGURATION_INVALID" || error.code.startsWith("EPK_APPROVED_"));
  }
});

test("CLI supports exactly one release or a bounded batch without ambiguous modes", () => {
  assert.deepEqual(parseArguments(["--release-id", "release_1", "--run-id", "change:epk-1"]), {
    releaseId: "release_1", limit: undefined, runId: "change:epk-1"
  });
  assert.deepEqual(parseArguments(["--limit", "5"]), { releaseId: undefined, limit: 5, runId: undefined });
  for (const argv of [
    ["--release-id", "release_1", "--limit", "2"],
    ["--limit", "0"],
    ["--limit", "26"],
    ["--unknown", "value"],
    ["--run-id", "contains content spaces"]
  ]) assert.throws(() => parseArguments(argv));
});

test("public EPK fixture normalizes URLs, validates rights/contact and yields a canonical digest", () => {
  const fixture = createEpkServiceFixture();
  const routes = parseEpkHtmlUrl(fixture.routes.htmlUrl, fixture.approvedOrigins);
  const remote = parseEpkResponse(fixture.manifest, {
    expectedSlug: routes.slug,
    siteOrigin: routes.origin,
    approvedOrigins: fixture.approvedOrigins,
    now: NOW
  });
  assert.equal(compareEpkToMusicRelease(musicReleaseFixture(), remote, routes), true);
  assert.equal(epkAssetChecks(remote).length, 4);
  const digest = canonicalManifestDigest(remote);
  assert.match(digest, /^[a-f0-9]{64}$/u);
  assert.equal(canonicalSerialize({ z: 1, a: { d: 2, b: 1 } }), canonicalSerialize({ a: { b: 1, d: 2 }, z: 1 }));

  const relative = manifestFixture();
  relative.release.artwork.url = "/assets/epk/verified-release.jpg";
  const normalized = parseEpkResponse(relative, {
    expectedSlug: routes.slug,
    siteOrigin: routes.origin,
    approvedOrigins: fixture.approvedOrigins,
    now: NOW
  });
  assert.equal(normalized.release.artwork.url, "https://epk.public.test/assets/epk/verified-release.jpg");
});

test("the verifier fixture is accepted by the deployed public EPK service contract", () => {
  const fixture = createEpkServiceFixture();
  const urlPolicy = createEpkUrlPolicy({
    siteOrigin: "https://epk.public.test",
    allowedHttpsOrigins: [...fixture.approvedOrigins],
    sameOriginAssetPrefixes: ["/assets/epk/"]
  });
  const manifest = fixture.manifest;
  const validated = validateEpkManifest({
    schemaVersion: manifest.schemaVersion,
    generatedAt: manifest.generatedAt,
    releases: [manifest.release]
  }, { urlPolicy, now: NOW });
  assert.equal(validated.releases[0].slug, "verified-release");
});

test("every modeled activation field is compared and mismatches reveal field names only", () => {
  const fixture = createEpkServiceFixture();
  const routes = parseEpkHtmlUrl(fixture.routes.htmlUrl, fixture.approvedOrigins);
  const remote = parseEpkResponse(fixture.manifest, {
    expectedSlug: routes.slug, siteOrigin: routes.origin, approvedOrigins: fixture.approvedOrigins, now: NOW
  });
  const mutations = {
    epkUrl: "https://epk.public.test/epk/other",
    isrc: "NLZZZ2600001",
    artistName: "Different Artist",
    name: "Different Title",
    releaseDate: "2026-07-25",
    genres: ["Dance"],
    moods: ["Energetic"],
    bpm: 125,
    instrumental: true,
    artworkUrl: "https://media.public.test/other.jpg",
    spotifyUrl: "https://open.spotify.com/track/ZZZZZZZZZZZZZZZZZZZZZZ",
    downloadUrl: "https://media.public.test/other.mp3",
    privateStreamUrl: "https://media.public.test/other-stream"
  };
  for (const [field, value] of Object.entries(mutations)) {
    assert.throws(
      () => compareEpkToMusicRelease(musicReleaseFixture({ [field]: value }), remote, routes),
      (error) => error.code === "EPK_CRM_MISMATCH" && error.details.fields.includes(field)
        && !error.message.includes(String(value))
    );
  }

  const noTempo = manifestFixture();
  noTempo.release.tempo = { kind: "not-applicable", reason: "no-fixed-tempo" };
  const noTempoRemote = parseEpkResponse(noTempo, {
    expectedSlug: routes.slug, siteOrigin: routes.origin, approvedOrigins: fixture.approvedOrigins, now: NOW
  });
  assert.throws(
    () => compareEpkToMusicRelease(musicReleaseFixture({ bpm: "not-a-number" }), noTempoRemote, routes),
    (error) => error.code === "EPK_CRM_MISMATCH" && error.details.fields.includes("bpm")
  );
  assert.throws(
    () => compareEpkToMusicRelease(musicReleaseFixture({ radioEditUrl: "not-a-url" }), remote, routes),
    (error) => error.code === "EPK_CRM_MISMATCH" && error.details.fields.includes("radioEditUrl")
  );

  const radioManifest = manifestFixture();
  radioManifest.release.downloads.radioEdit = {
    url: "https://media.public.test/verified-release-radio.mp3", format: "mp3", label: "Radio edit"
  };
  const radioRemote = parseEpkResponse(radioManifest, {
    expectedSlug: routes.slug, siteOrigin: routes.origin, approvedOrigins: fixture.approvedOrigins, now: NOW
  });
  assert.equal(compareEpkToMusicRelease(musicReleaseFixture({
    radioEditUrl: "https://media.public.test/verified-release-radio.mp3"
  }), radioRemote, routes), true);
});

test("rights and public contact remain mandatory even though they are not modeled in MusicRelease", () => {
  const fixture = createEpkServiceFixture();
  const routes = parseEpkHtmlUrl(fixture.routes.htmlUrl, fixture.approvedOrigins);
  for (const mutate of [
    (manifest) => { manifest.release.downloadRights.grant = "unrestricted"; },
    (manifest) => { manifest.release.contact.email = "not-an-email"; },
    (manifest) => { delete manifest.release.contact; },
    (manifest) => { manifest.release.artistBio.rights = "unknown"; }
  ]) {
    const manifest = manifestFixture();
    mutate(manifest);
    assert.throws(
      () => parseEpkResponse(manifest, {
        expectedSlug: routes.slug, siteOrigin: routes.origin, approvedOrigins: fixture.approvedOrigins, now: NOW
      }),
      (error) => error.code === "EPK_MANIFEST_INVALID" && !error.message.includes("press@example.test")
    );
  }
});

test("happy-path verification checks health, JSON, HTML and every asset before OCC attestation", async () => {
  const fixture = createEpkServiceFixture();
  const crm = createCrm([musicReleaseFixture()]);
  const service = createService(fixture, crm);
  const result = await service.verifyRelease("release-epk-1", { runId: "epk-test-1" });

  assert.equal(result.state, "Verified");
  assert.equal(result.assetsChecked, 4);
  assert.match(result.manifestSha256, /^[a-f0-9]{64}$/u);
  assert.equal(crm.updates.length, 1);
  assert.deepEqual(Object.keys(crm.updates[0].payload).sort(), [
    "epkAttestationState", "epkEvidenceReference", "epkManifestSha256", "epkVerifiedAt"
  ]);
  assert.equal(Object.hasOwn(crm.updates[0].payload, "status"), false);
  assert.equal(crm.updates[0].versionNumber, 7);
  assert.deepEqual(fixture.calls.map((call) => `${call.method} ${new URL(call.url).pathname}`), [
    "GET /api/health", "GET /api/epk/verified-release", "GET /epk/verified-release",
    "HEAD /verified-release.jpg", "HEAD /verified-release-stream", "HEAD /verified-release.mp3", "HEAD /verified-release.wav",
    "GET /api/epk/verified-release", "GET /api/health"
  ]);
  assert.ok(fixture.calls.every((call) => call.address === "93.184.216.34" && call.family === 4));
});

test("Active, Ready and Completed records are never fetched or mutated by the activation verifier", async () => {
  for (const status of ["Active", "Ready", "Completed"]) {
    const fixture = createEpkServiceFixture();
    const crm = createCrm([musicReleaseFixture({ status })]);
    const service = createService(fixture, crm);
    await assert.rejects(
      service.verifyRelease("release-epk-1", { runId: `status-${status}` }),
      (error) => error.code === "EPK_RELEASE_STATUS_INELIGIBLE"
    );
    assert.equal(fixture.calls.length, 0);
    assert.equal(crm.updates.length, 0);
  }
});

test("health must explicitly report epk=true and epkStale=false", async () => {
  for (const health of [
    { status: "ok", capabilities: { epk: false, epkStale: false } },
    { status: "ok", capabilities: { epk: true, epkStale: true } },
    { status: "ok", capabilities: { epk: true } }
  ]) {
    const fixture = createEpkServiceFixture();
    fixture.setHealth(health);
    const crm = createCrm([musicReleaseFixture()]);
    await assert.rejects(createService(fixture, crm).verifyRelease("release-epk-1", { runId: "health-check" }));
    assert.equal(crm.updates.at(-1).payload.epkAttestationState, "Failed");
    assert.equal(crm.updates.at(-1).payload.epkManifestSha256, null);
  }
});

test("manifest semantics must remain stable through the complete asset check", async () => {
  const fixture = createEpkServiceFixture();
  let reads = 0;
  fixture.setResponse("GET", fixture.routes.jsonUrl, () => {
    reads += 1;
    const manifest = fixture.manifest;
    if (reads === 2) manifest.release.title = "Changed Mid Verification";
    const body = Buffer.from(JSON.stringify(manifest));
    return response(200, { "content-type": "application/json", "content-length": String(body.byteLength) }, body);
  });
  const crm = createCrm([musicReleaseFixture()]);
  await assert.rejects(
    createService(fixture, crm).verifyRelease("release-epk-1", { runId: "manifest-stability" }),
    (error) => error.code === "EPK_MANIFEST_CHANGED_DURING_VERIFICATION" && error.retryable === true
  );
  assert.equal(reads, 2);
  assert.equal(crm.updates.at(-1).payload.epkAttestationState, "Failed");
});

test("mixed DNS answers, private rebinding targets and unapproved redirect origins fail closed", async (t) => {
  await t.test("mixed DNS", async () => {
    const fixture = createEpkServiceFixture();
    fixture.setDns("epk.public.test", [
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 }
    ]);
    const client = createClient(fixture);
    await assert.rejects(client.fetchHealth(fixture.routes.healthUrl), (error) => error.code === "EPK_DESTINATION_DISALLOWED");
    assert.equal(fixture.calls.length, 0);
  });

  await t.test("redirect rebinding", async () => {
    const fixture = createEpkServiceFixture();
    const redirected = "https://media.public.test/api/health";
    fixture.setResponse("GET", fixture.routes.healthUrl, response(302, { location: redirected }));
    fixture.setDns("media.public.test", [{ address: "10.0.0.8", family: 4 }]);
    const client = createClient(fixture);
    await assert.rejects(client.fetchHealth(fixture.routes.healthUrl), (error) => error.code === "EPK_DESTINATION_DISALLOWED");
    assert.equal(fixture.calls.length, 1);
  });

  await t.test("origin allowlist", async () => {
    const fixture = createEpkServiceFixture();
    fixture.setResponse("GET", fixture.routes.healthUrl, response(302, { location: "https://unapproved.example/api/health" }));
    await assert.rejects(createClient(fixture).fetchHealth(fixture.routes.healthUrl), (error) => error.code === "EPK_NETWORK_URL_FORBIDDEN");
  });
});

test("DNS is re-resolved for each endpoint while TLS failures remain permanent", async (t) => {
  await t.test("cross-request rebinding", async () => {
    const fixture = createEpkServiceFixture();
    let lookups = 0;
    const client = new EpkVerificationClient({
      approvedOrigins: fixture.approvedOrigins,
      maxRedirects: 2,
      maxHeaderBytes: 16_384,
      maxJsonBodyBytes: 262_144,
      maxHtmlBodyBytes: 524_288,
      maxAssetBytes: 1_073_741_824
    }, {
      async lookup() {
        lookups += 1;
        return [{ address: lookups === 1 ? "93.184.216.34" : "127.0.0.1", family: 4 }];
      },
      request: fixture.request
    });
    await client.fetchHealth(fixture.routes.healthUrl);
    await assert.rejects(
      client.fetchManifest(fixture.routes.jsonUrl, "/api/epk/verified-release"),
      (error) => error.code === "EPK_DESTINATION_DISALLOWED"
    );
    assert.equal(lookups, 2);
    assert.equal(fixture.calls.length, 1);
  });

  await t.test("TLS hostname validation", async () => {
    const fixture = createEpkServiceFixture();
    fixture.setResponse("GET", fixture.routes.healthUrl, () => {
      throw Object.assign(new Error("certificate mismatch"), { code: "ERR_TLS_CERT_ALTNAME_INVALID" });
    });
    await assert.rejects(createClient(fixture).fetchHealth(fixture.routes.healthUrl),
      (error) => error.code === "EPK_TLS_INVALID" && error.retryable === false);
  });
});

test("redirects are hop-bounded and cannot change strict core paths or add private URL components", async () => {
  for (const location of [
    "https://media.public.test/other-health",
    "https://media.public.test/api/health?token=secret",
    "http://media.public.test/api/health",
    "https://user:password@media.public.test/api/health"
  ]) {
    const fixture = createEpkServiceFixture();
    fixture.setResponse("GET", fixture.routes.healthUrl, response(302, { location }));
    await assert.rejects(createClient(fixture).fetchHealth(fixture.routes.healthUrl));
  }
  const fixture = createEpkServiceFixture();
  fixture.setResponse("GET", fixture.routes.healthUrl, response(302, { location: "https://media.public.test/api/health" }));
  fixture.setResponse("GET", "https://media.public.test/api/health", response(302, { location: fixture.routes.healthUrl }));
  await assert.rejects(createClient(fixture).fetchHealth(fixture.routes.healthUrl), (error) => error.code === "EPK_REDIRECT_LOOP");

  const bounded = createEpkServiceFixture();
  bounded.setResponse("GET", bounded.routes.healthUrl, response(302, { location: "https://media.public.test/api/health" }));
  bounded.setResponse("GET", "https://media.public.test/api/health", response(302, { location: "https://evidence.public.test/api/health" }));
  bounded.setResponse("GET", "https://evidence.public.test/api/health", response(302, { location: "https://open.spotify.com/api/health" }));
  await assert.rejects(createClient(bounded).fetchHealth(bounded.routes.healthUrl), (error) => error.code === "EPK_REDIRECT_LIMIT");
});

test("response header/body/time bounds and ambiguous headers are enforced", async (t) => {
  await t.test("body", async () => {
    const fixture = createEpkServiceFixture();
    fixture.setResponse("GET", fixture.routes.healthUrl, response(200, {
      "content-type": "application/json", "content-length": "300000"
    }, Buffer.alloc(300_000)));
    await assert.rejects(createClient(fixture).fetchHealth(fixture.routes.healthUrl), (error) => error.code === "EPK_BODY_TOO_LARGE");
  });
  await t.test("ambiguous content type", async () => {
    const fixture = createEpkServiceFixture();
    fixture.setResponse("GET", fixture.routes.healthUrl, response(200, {
      "content-type": ["application/json", "text/html"]
    }, Buffer.from("{}")));
    await assert.rejects(createClient(fixture).fetchHealth(fixture.routes.healthUrl), (error) => error.code === "EPK_HEADER_AMBIGUOUS");
  });
  await t.test("aggregate header bytes", async () => {
    const fixture = createEpkServiceFixture();
    fixture.setResponse("GET", fixture.routes.healthUrl, response(200, {
      "content-type": "application/json", "x-padding": "x".repeat(17_000)
    }, Buffer.from("{}")));
    await assert.rejects(createClient(fixture).fetchHealth(fixture.routes.healthUrl), (error) => error.code === "EPK_HEADERS_TOO_LARGE");
  });
  await t.test("total timeout", async () => {
    const fixture = createEpkServiceFixture();
    fixture.setResponse("GET", fixture.routes.healthUrl, () => new Promise(() => {}));
    const crm = createCrm([musicReleaseFixture()]);
    const service = createService(fixture, crm, { totalTimeoutMs: 5 });
    await assert.rejects(
      service.verifyRelease("release-epk-1", { runId: "timeout" }),
      (error) => error.code === "EPK_VERIFICATION_TIMEOUT" && error.retryable === true
    );
    assert.equal(crm.updates.at(-1).payload.epkAttestationState, "Failed");
  });
});

test("asset content type, declared size and range fallback are fail-closed and bounded", async (t) => {
  await t.test("oversized asset", async () => {
    const fixture = createEpkServiceFixture();
    fixture.setResponse("HEAD", "https://media.public.test/verified-release.mp3", response(200, {
      "content-type": "audio/mpeg", "content-length": "1073741825"
    }));
    const crm = createCrm([musicReleaseFixture()]);
    await assert.rejects(createService(fixture, crm).verifyRelease("release-epk-1", { runId: "asset-size" }),
      (error) => error.code === "EPK_ASSET_SIZE_INVALID");
  });
  await t.test("content type", async () => {
    const fixture = createEpkServiceFixture();
    fixture.setResponse("HEAD", "https://media.public.test/verified-release.jpg", response(200, {
      "content-type": "text/html", "content-length": "2048"
    }));
    await assert.rejects(createService(fixture, createCrm([musicReleaseFixture()])).verifyRelease("release-epk-1", { runId: "asset-type" }),
      (error) => error.code === "EPK_CONTENT_TYPE_INVALID");
  });
  await t.test("range fallback", async () => {
    const fixture = createEpkServiceFixture();
    fixture.setResponse("HEAD", "https://media.public.test/verified-release.mp3", response(405));
    const result = await createService(fixture, createCrm([musicReleaseFixture()])).verifyRelease("release-epk-1", { runId: "asset-range" });
    assert.equal(result.state, "Verified");
    assert.ok(fixture.calls.some((call) => call.method === "GET" && call.url.endsWith("verified-release.mp3") && call.headers.range === "bytes=0-0"));
  });
  await t.test("range probe body", async () => {
    const fixture = createEpkServiceFixture();
    const assetUrl = "https://media.public.test/verified-release.mp3";
    fixture.setResponse("HEAD", assetUrl, response(405));
    fixture.setResponse("GET", assetUrl, response(200, { "content-type": "audio/mpeg" }, Buffer.alloc(1_025)));
    await assert.rejects(createService(fixture, createCrm([musicReleaseFixture()])).verifyRelease("release-epk-1", { runId: "asset-body" }),
      (error) => error.code === "EPK_BODY_TOO_LARGE");
  });
});

test("an OCC conflict causes a complete reread, remote re-fetch and re-comparison", async () => {
  const fixture = createEpkServiceFixture();
  const crm = createCrm([
    musicReleaseFixture(),
    musicReleaseFixture({ versionNumber: 8, name: "Changed During Verification" })
  ], { conflictUpdates: 1 });
  const service = createService(fixture, crm);
  await assert.rejects(
    service.verifyRelease("release-epk-1", { runId: "occ-reread" }),
    (error) => error.code === "EPK_CRM_MISMATCH" && error.details.fields.includes("name")
  );
  assert.equal(crm.reads, 2);
  assert.equal(fixture.calls.filter((call) => call.url === fixture.routes.healthUrl).length, 4);
  assert.equal(crm.updates.length, 2);
  assert.equal(crm.updates[0].payload.epkAttestationState, "Verified");
  assert.equal(crm.updates[1].payload.epkAttestationState, "Failed");
  assert.equal(Object.hasOwn(crm.updates[1].payload, "status"), false);
});

test("bounded batch selection reports only opaque IDs and codes", async () => {
  const fixture = createEpkServiceFixture();
  const second = musicReleaseFixture({ id: "release-epk-2", versionNumber: 3, status: "Paused", name: "Mismatch" });
  const crm = createCrm([musicReleaseFixture(), second], { candidateIds: ["release-epk-1", "release-epk-2"] });
  const result = await createService(fixture, crm).verifyBatch(2, { runId: "batch-1" });
  assert.equal(result.selected, 2);
  assert.equal(result.verified, 1);
  assert.equal(result.failed, 1);
  assert.deepEqual(Object.keys(result.results[1]).sort(), ["code", "releaseId", "retryable", "state"]);
  assert.equal(JSON.stringify(result).includes("Mismatch"), false);
});

test("CRM gateway refuses status or partial attestation writes", () => {
  const client = {
    updateConditional(_entityType, _id, payload) { return payload; }
  };
  const gateway = new EpkVerificationCrmGateway(client);
  assert.throws(
    () => gateway.updateAttestation("release_1", { epkAttestationState: "Verified", status: "Active" }, 1),
    (error) => error.code === "EPK_ATTESTATION_PAYLOAD_INVALID"
  );
});

test("CRM gateway candidate reads are two bounded Draft/Paused queries with deterministic UTC ordering", async () => {
  const calls = [];
  const client = {
    async request(method, path, _payload, options) {
      calls.push({ method, path, options });
      const search = JSON.parse(decodeURIComponent(path.split("searchParams=")[1]));
      const status = search.where[0].value;
      return status === "Draft"
        ? { list: [{ id: "draft_1", status, modifiedAt: "2026-07-15 10:00:01" }] }
        : { list: [{ id: "paused_1", status, modifiedAt: "2026-07-15 10:00:00" }] };
    }
  };
  const ids = await new EpkVerificationCrmGateway(client).listCandidateIds(2);
  assert.deepEqual(ids, ["paused_1", "draft_1"]);
  assert.equal(calls.length, 2);
  for (const call of calls) {
    const search = JSON.parse(decodeURIComponent(call.path.split("searchParams=")[1]));
    assert.equal(call.method, "GET");
    assert.equal(search.maxSize, 2);
    assert.deepEqual(search.select, ["id", "status", "modifiedAt"]);
    assert.equal(call.options.headers["X-No-Total"], "true");
  }
});

function createClient(fixture, overrides = {}) {
  return new EpkVerificationClient({
    approvedOrigins: fixture.approvedOrigins,
    maxRedirects: 2,
    maxHeaderBytes: 16_384,
    maxJsonBodyBytes: 262_144,
    maxHtmlBodyBytes: 524_288,
    maxAssetBytes: 1_073_741_824,
    ...overrides
  }, { lookup: fixture.lookup, request: fixture.request });
}

function createService(fixture, crm, overrides = {}) {
  return new EpkVerificationService({
    crm,
    epkClient: createClient(fixture),
    approvedOrigins: fixture.approvedOrigins,
    totalTimeoutMs: overrides.totalTimeoutMs ?? 5_000,
    now: () => NOW
  });
}

function createCrm(records, { conflictUpdates = 0, candidateIds } = {}) {
  const recordsById = new Map();
  const readSequences = new Map();
  for (const record of records) {
    if (!recordsById.has(record.id)) recordsById.set(record.id, structuredClone(record));
    const sequence = readSequences.get(record.id) ?? [];
    sequence.push(structuredClone(record));
    readSequences.set(record.id, sequence);
  }
  const state = {
    reads: 0,
    updates: [],
    conflicts: conflictUpdates,
    async getRelease(id) {
      state.reads += 1;
      const sequence = readSequences.get(id);
      if (!sequence?.length) throw new Error("missing test release");
      const index = Math.min(state.reads - 1, sequence.length - 1);
      return structuredClone(sequence[index]);
    },
    async listCandidateIds(limit) {
      return Object.freeze((candidateIds ?? [...recordsById.keys()]).slice(0, limit));
    },
    async updateAttestation(id, payload, versionNumber) {
      state.updates.push({ id, payload: structuredClone(payload), versionNumber });
      assert.equal(Object.hasOwn(payload, "status"), false);
      if (state.conflicts > 0) {
        state.conflicts -= 1;
        throw new ApplicationError("conflict", { code: "ESPOCRM_VERSION_CONFLICT", statusCode: 409, retryable: true });
      }
      return { id, ...payload };
    }
  };
  return state;
}

function enabledEnvironment() {
  return {
    EPK_VERIFIER_ENABLED: "true",
    ESPOCRM_BASE_URL: "https://crm.public.test",
    ESPOCRM_API_KEY: "epk-verifier-test-api-key",
    EPK_VERIFIER_APPROVED_HTTPS_ORIGINS: [
      "https://epk.public.test", "https://media.public.test", "https://evidence.public.test", "https://open.spotify.com"
    ].join(",")
  };
}
