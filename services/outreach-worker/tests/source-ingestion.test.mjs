import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createSourceIngestionService } from "../src/application/source-ingestion-service.mjs";
import {
  adaptDjFinderRows,
  adaptMusicSubmissionPlatforms,
  adaptReleaseOsReleases,
  buildSourceArtifact
} from "../src/domain/source-adapters.mjs";
import {
  parseSourceArtifact,
  sourceRequestSignature,
  verifySourceRequestSignature
} from "../src/domain/source-artifact.mjs";
import { HttpEmailValidationProvider } from "../src/infrastructure/email-validation-provider.mjs";
import { buildServer } from "../src/interfaces/http/build-server.mjs";
import { Metrics } from "../src/infrastructure/metrics.mjs";
import { loadEmitterConfig, publishArtifact, runEmitter } from "../src/jobs/publish-source-snapshot.mjs";

const SECRET = "source-secret-with-at-least-thirty-two-characters";
const HISTORICAL_SECRET = "historical-source-secret-with-at-least-thirty-two-characters";
const OTHER_SOURCE_SECRET = "other-source-secret-with-at-least-thirty-two-characters";
const KEY_ID = "dj-2026-07";
const HISTORICAL_KEY_ID = "dj-2026-06";
const OTHER_SOURCE_KEY_ID = "msa-2026-07";
const UNSUBSCRIBE_KEYRING = Object.freeze({
  schemaVersion: 2,
  active: Object.freeze({ kid: "unsub-test-2026-07", key: "unsubscribe-signing-key-1234567890" }),
  verifyOnly: Object.freeze([])
});

test("source artifact parsing is strict, bounded and requires fresh evidence", () => {
  const artifact = sourceArtifact();
  assert.equal(parseSourceArtifact(artifact).records.length, 2);
  assert.throws(
    () => parseSourceArtifact({ ...artifact, records: [{ ...artifact.records[0], unexpected: true }] }),
    (error) => error.code === "SOURCE_ARTIFACT_INVALID"
  );
  assert.throws(
    () => parseSourceArtifact({ ...artifact, generatedAt: "2020-01-01T00:00:00.000Z" }),
    (error) => error.code === "SOURCE_ARTIFACT_STALE"
  );
  assert.throws(
    () => parseSourceArtifact({
      ...artifact,
      records: artifact.records.map((record) => record.kind === "mediaContact"
        ? { ...record, purpose: "Blocked" }
        : record)
    }),
    (error) => error.code === "SOURCE_ARTIFACT_INVALID"
  );
  assert.throws(
    () => parseSourceArtifact({
      ...artifact,
      records: artifact.records.map((record) => record.kind === "mediaOutlet"
        ? { ...record, subGenres: ["Invented Genre"] }
        : record)
    }),
    (error) => error.code === "SOURCE_ARTIFACT_INVALID"
  );
  assert.throws(
    () => parseSourceArtifact({
      ...artifact,
      records: artifact.records.map((record) => record.kind === "mediaOutlet"
        ? { ...record, formatGenres: Array.from({ length: 21 }, () => "Dance") }
        : record)
    }),
    (error) => error.code === "SOURCE_ARTIFACT_INVALID"
  );
});

test("source v2 signatures bind source, kid, timestamp, nonce and exact body across rotation overlap", () => {
  const rawBody = Buffer.from(JSON.stringify(sourceArtifact()));
  const timestamp = String(Math.floor(Date.now() / 1_000));
  const nonce = "nonce-1234567890abcdef";
  const signature = sourceRequestSignature({ sourceId: "dj-finder", keyId: KEY_ID, timestamp, nonce, rawBody }, SECRET);
  const verified = verifySourceRequestSignature({
    sourceId: "dj-finder", keyId: KEY_ID, timestamp, nonce, rawBody, signature: `v2=${signature}`
  }, sourceConfig());
  assert.equal(verified.sourceId, "dj-finder");
  assert.equal(verified.keyId, KEY_ID);

  const historicalSignature = sourceRequestSignature({
    sourceId: "dj-finder", keyId: HISTORICAL_KEY_ID, timestamp, nonce, rawBody
  }, HISTORICAL_SECRET);
  assert.equal(verifySourceRequestSignature({
    sourceId: "dj-finder",
    keyId: HISTORICAL_KEY_ID,
    timestamp,
    nonce,
    rawBody,
    signature: `v2=${historicalSignature}`
  }, sourceConfig()).keyId, HISTORICAL_KEY_ID);

  assert.throws(
    () => verifySourceRequestSignature({
      sourceId: "dj-finder", keyId: KEY_ID, timestamp, nonce, rawBody: Buffer.from(`${rawBody} `), signature: `v2=${signature}`
    }, sourceConfig()),
    (error) => error.code === "SOURCE_SIGNATURE_INVALID"
  );
  assert.throws(
    () => verifySourceRequestSignature({
      sourceId: "dj-finder", keyId: "dj-unknown", timestamp, nonce, rawBody, signature: `v2=${signature}`
    }, sourceConfig()),
    (error) => error.code === "SOURCE_KEY_ID_UNKNOWN"
  );
  assert.throws(
    () => verifySourceRequestSignature({
      sourceId: "dj-finder", keyId: KEY_ID, timestamp, nonce, rawBody, signature: `v1=${signature}`
    }, sourceConfig()),
    (error) => error.code === "SOURCE_SIGNATURE_VERSION_UNSUPPORTED"
  );
  const crossSourceSignature = sourceRequestSignature({
    sourceId: "music-submission-agent", keyId: OTHER_SOURCE_KEY_ID, timestamp, nonce, rawBody
  }, SECRET);
  assert.throws(
    () => verifySourceRequestSignature({
      sourceId: "music-submission-agent",
      keyId: OTHER_SOURCE_KEY_ID,
      timestamp,
      nonce,
      rawBody,
      signature: `v2=${crossSourceSignature}`
    }, sourceConfig()),
    (error) => error.code === "SOURCE_SIGNATURE_INVALID"
  );
});

test("disabled validation is fail-closed while independently Valid contacts become matchable", async () => {
  const held = createHarness({
    validation: { status: "Unknown", checkedAt: new Date().toISOString(), providerReference: "provider-disabled" }
  });
  const heldResult = await held.service.ingest({
    sourceId: "dj-finder",
    artifact: sourceArtifact(),
    rawBody: Buffer.from(JSON.stringify(sourceArtifact()))
  });
  assert.equal(heldResult.contactsHeld, 1);
  assert.equal(held.espo.byType.MediaContact[0].status, "Needs Validation");
  assert.equal(held.espo.byType.MediaContact[0].emailValidationStatus, "Unknown");

  const validated = createHarness({
    validation: { status: "Valid", checkedAt: new Date().toISOString(), providerReference: "validator-123" }
  });
  const readyResult = await validated.service.ingest({
    sourceId: "dj-finder",
    artifact: sourceArtifact(),
    rawBody: Buffer.from(JSON.stringify(sourceArtifact()))
  });
  assert.equal(readyResult.contactsReady, 1);
  assert.equal(validated.espo.byType.MediaContact[0].status, "Ready for Matching");
  assert.equal(validated.espo.byType.MediaContact[0].emailValidationStatus, "Valid");
  assert.equal(validated.espo.byType.MediaContact[0].smtpValidationStatus, "Unknown");
  assert.equal(validated.espo.byType.MediaContact[0].firstName, "DJ");
  assert.equal(validated.espo.byType.MediaContact[0].lastName, "Example");
  assert.equal(validated.espo.byType.MediaContact[0].showName, "Night Signals");
  assert.equal(validated.espo.byType.MediaContact[0].linkedinUrl, "https://www.linkedin.com/in/dj-example/");
  assert.equal(validated.espo.byType.MediaContact[0].soundcloudUrl, "https://soundcloud.com/dj-example");
  assert.deepEqual(validated.espo.byType.MediaOutlet[0].subGenres, ["Club"]);
  assert.deepEqual(validated.espo.byType.MediaOutlet[0].formatGenres, ["Dance"]);
  assert.equal(validated.repository.validationWrites.length, 1);

  const smtpValidated = createHarness({
    validation: { status: "Valid", checkedAt: new Date().toISOString(), providerReference: "smtp:mx:valid", method: "smtp" }
  });
  await smtpValidated.service.ingest({
    sourceId: "dj-finder",
    artifact: sourceArtifact(),
    rawBody: Buffer.from(JSON.stringify(sourceArtifact()))
  });
  assert.equal(smtpValidated.espo.byType.MediaContact[0].emailValidationStatus, "Valid");
  assert.equal(smtpValidated.espo.byType.MediaContact[0].smtpValidationStatus, "Valid");
});

test("completed artifact receipt makes ingestion idempotent without another provider call", async () => {
  const harness = createHarness({
    validation: { status: "Valid", checkedAt: new Date().toISOString(), providerReference: "validator-123" }
  });
  const artifact = sourceArtifact();
  const rawBody = Buffer.from(JSON.stringify(artifact));
  const first = await harness.service.ingest({ sourceId: artifact.sourceId, artifact, rawBody });
  harness.repository.beginArtifact = async () => ({ claimed: false, completed: true, result: first });
  const second = await harness.service.ingest({ sourceId: artifact.sourceId, artifact, rawBody });
  assert.equal(second.replayed, true);
  assert.equal(harness.providerCalls.length, 1);
});

test("source ingestion projects bounded outlet and release taxonomy into EspoCRM", async () => {
  const harness = createHarness({
    validation: { status: "Unknown", checkedAt: new Date().toISOString(), providerReference: "unused" }
  });
  const generatedAt = new Date().toISOString();
  const artifact = {
    schemaVersion: "1.0",
    sourceId: "marcsmusic-release-os",
    artifactId: "release-taxonomy-20260715",
    generatedAt,
    records: [{
      kind: "musicRelease",
      externalId: "release-taxonomy-1",
      isrc: "NLABC2600042",
      name: "Taxonomy Evidence",
      artistName: "Marc Rene",
      genres: ["Dance"],
      subGenres: ["Tropical", "World Fusion"],
      languages: [],
      territories: ["NL", "DE"],
      epkUrl: "https://artist.example.test/epk",
      evidence: {
        url: "https://artist.example.test/releases",
        text: "The release record and its campaign taxonomy were verified at source.",
        capturedAt: generatedAt
      }
    }]
  };

  const result = await harness.service.ingest({
    sourceId: artifact.sourceId,
    artifact,
    rawBody: Buffer.from(JSON.stringify(artifact))
  });
  assert.equal(result.MusicRelease, 1);
  assert.deepEqual(harness.espo.byType.MusicRelease[0].subGenres, ["Tropical", "World Fusion"]);
  assert.deepEqual(harness.espo.byType.MusicRelease[0].territories, ["NL", "DE"]);
  assert.deepEqual(harness.espo.byType.MusicRelease[0].languages, []);
});

test("lost source receipt heartbeat stops before any CRM mutation", async () => {
  const harness = createHarness({
    validation: { status: "Valid", checkedAt: new Date().toISOString(), providerReference: "validator-123", method: "http" }
  });
  harness.repository.renewArtifactLease = async () => false;
  harness.repository.failArtifact = async () => false;
  const artifact = sourceArtifact();
  await assert.rejects(
    () => harness.service.ingest({
      sourceId: artifact.sourceId,
      artifact,
      rawBody: Buffer.from(JSON.stringify(artifact))
    }),
    (error) => error.code === "SOURCE_ARTIFACT_LEASE_LOST"
  );
  assert.equal(harness.espo.byType.MediaOutlet.length, 0);
  assert.equal(harness.espo.byType.MediaContact.length, 0);
});

test("signed ingestion route rejects nonce replay before performing CRM work", async (t) => {
  const artifact = sourceArtifact();
  const rawBody = JSON.stringify(artifact);
  const timestamp = String(Math.floor(Date.now() / 1_000));
  const nonce = "nonce-route-1234567890";
  const signature = sourceRequestSignature({ sourceId: artifact.sourceId, keyId: KEY_ID, timestamp, nonce, rawBody }, SECRET);
  let reserved = false;
  let ingestions = 0;
  const server = await buildServer({
    config: httpConfig(),
    repository: {
      async receiveEvent() {},
      async suppress() {},
      async cancelPendingForMatch() {}
    },
    sourceIngestionRepository: {
      async reserveNonce() {
        if (reserved) return false;
        reserved = true;
        return true;
      }
    },
    sourceIngestionService: {
      async ingest() {
        ingestions += 1;
        return { artifactId: artifact.artifactId, records: artifact.records.length };
      }
    },
    metrics: new Metrics()
  });
  t.after(() => server.close());
  const headers = {
    "content-type": "application/json",
    "x-source-key-id": KEY_ID,
    "x-source-timestamp": timestamp,
    "x-source-nonce": nonce,
    "x-source-signature": `v2=${signature}`
  };
  const accepted = await server.inject({ method: "POST", url: `/api/v1/source-ingestion/${artifact.sourceId}`, headers, payload: rawBody });
  assert.equal(accepted.statusCode, 201);
  const replay = await server.inject({ method: "POST", url: `/api/v1/source-ingestion/${artifact.sourceId}`, headers, payload: rawBody });
  assert.equal(replay.statusCode, 409);
  assert.equal(replay.json().error.code, "SOURCE_REQUEST_REPLAYED");
  assert.equal(ingestions, 1);
});

test("provider adapter sends an idempotent authenticated request and enforces response contract", async () => {
  let received;
  const provider = new HttpEmailValidationProvider({ url: "https://validator.example/v1/check", token: "token", timeoutMs: 1_000 }, {
    fetch: async (url, options) => {
      received = { url, options };
      return new Response(JSON.stringify({
        status: "Valid",
        checkedAt: "2026-07-15T09:00:00.000Z",
        providerReference: "check-1"
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
  });
  const result = await provider.validate("dj@example.com", "idem-1");
  assert.equal(result.status, "Valid");
  assert.equal(received.options.headers["idempotency-key"], "idem-1");
  assert.equal(received.options.headers.authorization, "Bearer token");
});

test("source-specific adapters accept only traceable, allowed-purpose data", () => {
  const djRecords = adaptDjFinderRows([{
    artist_name: "DJ Example",
    full_name: "DJ Example",
    website_url: "https://dj.example/",
    source_url: "https://dj.example/submissions",
    contact_source_url: "https://dj.example/submissions",
    music_submission_email: "music@dj.example",
    genres: "dance,electronic",
    active_evidence: "The page explicitly invites unreleased music by email.",
    verification_status: "verified",
    verification_timestamp: "2026-07-15T08:00:00.000Z",
    confidence_score: "92"
  }]);
  assert.deepEqual(djRecords.map((record) => record.kind), ["mediaOutlet", "mediaContact"]);
  assert.equal(djRecords[1].purpose, "Explicit Music Submission");
  assert.deepEqual(djRecords[0].subGenres, []);
  assert.deepEqual(djRecords[0].formatGenres, []);
  assert.equal(djRecords[0].language, undefined);
  const likelyValid = adaptDjFinderRows([{
    artist_name: "Likely DJ",
    full_name: "Likely DJ",
    website_url: "https://likely.example/",
    source_url: "https://likely.example/submissions",
    contact_source_url: "https://likely.example/submissions",
    music_submission_email: "music@likely.example",
    active_evidence: "The page appears to invite music submissions but still needs verification.",
    verification_status: "likely_valid",
    verification_timestamp: "2026-07-15T08:00:00.000Z"
  }]);
  assert.ok(likelyValid.every((record) => record.verified === false));

  const platform = adaptMusicSubmissionPlatforms([{
    id: "platform-1",
    canonicalKey: "platform.example",
    name: "Platform",
    websiteUrl: "https://platform.example/",
    submissionUrl: "https://platform.example/submit",
    sourceUrl: "https://platform.example/guidelines",
    lastVerifiedAt: "2026-07-15T08:00:00.000Z",
    verificationStatus: "verified",
    submissionMethod: "form",
    notes: "The official page explicitly accepts music submissions through this form.",
    confidenceScore: 90,
    genres: ["pop"],
    subGenres: ["tropical"],
    formatGenres: ["mainstream"]
  }])[0];
  assert.equal(platform.kind, "mediaOutlet");
  assert.equal(platform.acceptsEmail, false);
  assert.equal(platform.acceptsForms, true);
  assert.equal(platform.submissionPolicy, "Explicit");
  assert.deepEqual(platform.subGenres, ["Tropical"]);
  assert.deepEqual(platform.formatGenres, ["Mainstream"]);

  assert.throws(() => adaptReleaseOsReleases([{
    id: "release-1", title: "Song", artist: "Artist"
  }]), (error) => error.code === "SOURCE_ADAPTER_INPUT_INVALID");
  const wrapped = buildSourceArtifact({ sourceId: "dj-finder", records: djRecords });
  assert.equal(parseSourceArtifact(wrapped).sourceId, "dj-finder");
});

test("DJ source mapping requires purpose-bound proof and applies no-submissions before positive evidence", () => {
  const capturedAt = new Date().toISOString();
  const base = {
    artist_name: "DJ Evidence",
    full_name: "DJ Evidence",
    website_url: "https://evidence-dj.example/",
    source_url: "https://evidence-dj.example/directory",
    contact_source_url: "https://evidence-dj.example/directory",
    verification_status: "verified",
    verification_timestamp: capturedAt
  };

  const generic = adaptDjFinderRows([{
    ...base,
    general_business_email: "info@evidence-dj.example",
    active_evidence: "A public directory lists this general business address."
  }]);
  assert.deepEqual(generic.map(({ kind }) => kind), ["mediaOutlet"]);
  assert.equal(generic[0].submissionPolicy, "General Contact");
  assert.equal(generic[0].acceptsEmail, false);
  assert.equal(generic[0].submissionUrl, undefined);

  const mislabeledDirectory = adaptDjFinderRows([{
    ...base,
    music_submission_email: "info@evidence-dj.example",
    active_evidence: "A public directory lists this address without a stated destination."
  }]);
  assert.deepEqual(mislabeledDirectory.map(({ kind }) => kind), ["mediaOutlet"]);
  assert.equal(mislabeledDirectory[0].submissionPolicy, "General Contact");
  assert.equal(mislabeledDirectory[0].acceptsEmail, false);

  const freeTextPromo = adaptDjFinderRows([{
    ...base,
    general_business_email: "info@evidence-dj.example",
    active_evidence: "The profile says to send promos to the separately listed promo desk."
  }]);
  assert.deepEqual(freeTextPromo.map(({ kind }) => kind), ["mediaOutlet"]);
  assert.equal(freeTextPromo[0].submissionPolicy, "General Contact");

  const explicitPromo = adaptDjFinderRows([{
    ...base,
    promo_email: "promos@evidence-dj.example",
    active_evidence: "The official page says to send promos to this promo email."
  }]);
  assert.deepEqual(explicitPromo.map(({ kind }) => kind), ["mediaOutlet", "mediaContact"]);
  assert.equal(explicitPromo[0].submissionPolicy, "Promo Contact");
  assert.equal(explicitPromo[1].purpose, "Promo Contact");

  const denied = adaptDjFinderRows([{
    ...base,
    music_submission_email: "music@evidence-dj.example",
    active_evidence: "No music submissions are accepted; please do not send promos."
  }]);
  assert.deepEqual(denied.map(({ kind }) => kind), ["mediaOutlet"]);
  assert.equal(denied[0].submissionPolicy, "No Submissions");
  assert.equal(denied[0].acceptsEmail, false);
  assert.equal(denied[0].acceptsForms, false);
  assert.equal(denied[0].acceptsUnreleased, false);
});

test("submission-platform email routes require source-provided purpose evidence", () => {
  const capturedAt = new Date().toISOString();
  const base = {
    id: "platform-evidence",
    name: "Evidence Platform",
    websiteUrl: "https://evidence-platform.example/",
    submissionUrl: "https://evidence-platform.example/contact",
    sourceUrl: "https://evidence-platform.example/directory",
    lastVerifiedAt: capturedAt,
    verificationStatus: "verified",
    submissionMethod: "email"
  };

  const missing = adaptMusicSubmissionPlatforms([base])[0];
  assert.equal(missing.submissionPolicy, "General Contact");
  assert.equal(missing.acceptsEmail, false);
  assert.equal(missing.acceptsForms, false);
  assert.equal(missing.submissionUrl, undefined);
  assert.match(missing.evidence.text, /route is quarantined/iu);

  const generic = adaptMusicSubmissionPlatforms([{
    ...base,
    notes: "The directory confirms that this platform has a general contact page."
  }])[0];
  assert.equal(generic.submissionPolicy, "General Contact");
  assert.equal(generic.acceptsEmail, false);
  assert.equal(generic.acceptsForms, false);
  assert.equal(generic.submissionUrl, undefined);

  const explicit = adaptMusicSubmissionPlatforms([{
    ...base,
    notes: "The official guidelines explicitly accept music submissions by email."
  }])[0];
  assert.equal(explicit.submissionPolicy, "Explicit");
  assert.equal(explicit.acceptsEmail, true);
  assert.equal(explicit.submissionUrl, "https://evidence-platform.example/contact");

  const denied = adaptMusicSubmissionPlatforms([{
    ...base,
    notes: "Submissions are closed and unsolicited music is not accepted."
  }])[0];
  assert.equal(denied.submissionPolicy, "No Submissions");
  assert.equal(denied.acceptsEmail, false);
  assert.equal(denied.acceptsForms, false);
  assert.equal(denied.acceptsUnreleased, false);
});

test("adapter-produced generic and denied addresses never become Ready after valid email validation", async () => {
  const capturedAt = new Date().toISOString();
  const common = {
    artist_name: "DJ Adversarial",
    full_name: "DJ Adversarial",
    website_url: "https://adversarial-dj.example/",
    source_url: "https://adversarial-dj.example/directory",
    contact_source_url: "https://adversarial-dj.example/directory",
    verification_status: "verified",
    verification_timestamp: capturedAt
  };
  const validation = {
    status: "Valid",
    checkedAt: capturedAt,
    providerReference: "validator-must-not-be-called"
  };

  const genericHarness = createHarness({ validation });
  const genericArtifact = buildSourceArtifact({
    sourceId: "dj-finder",
    generatedAt: capturedAt,
    records: adaptDjFinderRows([{
      ...common,
      general_business_email: "info@adversarial-dj.example",
      active_evidence: "A public directory lists a general business email with no submission purpose."
    }])
  });
  const genericResult = await genericHarness.service.ingest({
    sourceId: genericArtifact.sourceId,
    artifact: genericArtifact,
    rawBody: Buffer.from(JSON.stringify(genericArtifact))
  });
  assert.equal(genericResult.contactsReady, 0);
  assert.equal(genericResult.MediaContact, 0);
  assert.equal(genericHarness.providerCalls.length, 0);
  assert.equal(genericHarness.espo.byType.MediaOutlet[0].submissionPolicy, "General Contact");
  assert.equal(genericHarness.espo.byType.MediaOutlet[0].acceptsEmail, false);

  const deniedHarness = createHarness({ validation });
  const deniedArtifact = buildSourceArtifact({
    sourceId: "dj-finder",
    generatedAt: capturedAt,
    records: adaptDjFinderRows([{
      ...common,
      music_submission_email: "music@adversarial-dj.example",
      active_evidence: "No music submissions accepted. Do not send music to this address."
    }])
  });
  const deniedResult = await deniedHarness.service.ingest({
    sourceId: deniedArtifact.sourceId,
    artifact: deniedArtifact,
    rawBody: Buffer.from(JSON.stringify(deniedArtifact))
  });
  assert.equal(deniedResult.contactsReady, 0);
  assert.equal(deniedResult.MediaContact, 0);
  assert.equal(deniedHarness.providerCalls.length, 0);
  assert.equal(deniedHarness.espo.byType.MediaOutlet[0].activityStatus, "Blocked");
  assert.equal(deniedHarness.espo.byType.MediaOutlet[0].submissionPolicy, "No Submissions");
});

test("likely_valid source rows stay quarantined even when the email validator returns Valid", async () => {
  const capturedAt = new Date().toISOString();
  const records = adaptDjFinderRows([{
    artist_name: "Likely DJ",
    full_name: "Likely DJ",
    website_url: "https://likely-quarantine.example/",
    source_url: "https://likely-quarantine.example/submissions",
    contact_source_url: "https://likely-quarantine.example/submissions",
    music_submission_email: "music@likely-quarantine.example",
    active_evidence: "The page explicitly invites music submissions by email.",
    verification_status: "likely_valid",
    verification_timestamp: capturedAt
  }]);
  assert.deepEqual(records.map(({ verified }) => verified), [false, false]);
  const artifact = buildSourceArtifact({ sourceId: "dj-finder", generatedAt: capturedAt, records });
  const harness = createHarness({
    validation: { status: "Valid", checkedAt: capturedAt, providerReference: "validator-valid" }
  });
  const result = await harness.service.ingest({
    sourceId: artifact.sourceId,
    artifact,
    rawBody: Buffer.from(JSON.stringify(artifact))
  });
  assert.equal(result.contactsReady, 0);
  assert.equal(result.contactsHeld, 1);
  assert.equal(harness.espo.byType.MediaContact[0].emailValidationStatus, "Valid");
  assert.equal(harness.espo.byType.MediaContact[0].status, "Needs Validation");
});

test("producer emitter reads the DJ volume export and stays dry-run by default", async () => {
  const directory = await mkdtemp(join(tmpdir(), "source-emitter-"));
  const inputPath = join(directory, "dj_contacts.csv");
  await writeFile(inputPath, [
    "artist_name,full_name,website_url,source_url,contact_source_url,music_submission_email,genres,active_evidence,verification_status,verification_timestamp,confidence_score",
    `DJ Example,DJ Example,https://dj.example/,https://dj.example/submissions,https://dj.example/submissions,music@dj.example,dance,Explicit music submissions are invited,verified,${new Date().toISOString()},92`
  ].join("\n"));
  const result = await runEmitter({
    SOURCE_EMITTER_SOURCE_ID: "dj-finder",
    SOURCE_EMITTER_INPUT_PATH: inputPath,
    SOURCE_EMITTER_PUBLISH_ENABLED: "false"
  });
  assert.equal(result.published, false);
  assert.equal(result.records, 2);
  assert.equal(result.artifacts, 1);
});

test("producer retries preserve artifact bytes and rotate the signed nonce", async () => {
  const artifact = sourceArtifact();
  const requests = [];
  let calls = 0;
  const result = await publishArtifact(artifact, {
    sourceId: "dj-finder",
    outreachBaseUrl: "https://outreach.example.com",
    signingKeyId: KEY_ID,
    signingKey: SECRET,
    timeoutMs: 1_000,
    maxAttempts: 2
  }, {
    publishFetch: async (_url, options) => {
      calls += 1;
      requests.push({ body: options.body, headers: options.headers });
      return new Response(JSON.stringify(calls === 1
        ? { error: { code: "TEMPORARY" } }
        : { ok: true, result: { artifactId: artifact.artifactId } }), {
        status: calls === 1 ? 503 : 201,
        headers: { "content-type": "application/json" }
      });
    },
    sleep: async () => {}
  });
  assert.equal(result.published, true);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].body, requests[1].body);
  assert.notEqual(requests[0].headers["x-source-nonce"], requests[1].headers["x-source-nonce"]);
  assert.notEqual(requests[0].headers["x-source-signature"], requests[1].headers["x-source-signature"]);
});

test("producer HTTP input is fail-closed without an authentication token", () => {
  assert.throws(() => loadEmitterConfig({
    SOURCE_EMITTER_SOURCE_ID: "music-submission-agent",
    SOURCE_EMITTER_INPUT_URL: "https://music-submission.example/platforms",
    SOURCE_EMITTER_PUBLISH_ENABLED: "false"
  }), (error) => error.code === "SOURCE_EMITTER_CONFIG_INVALID");
});

test("generic producer publishing requires an explicit v2 key id and bounded key", () => {
  const base = {
    SOURCE_EMITTER_SOURCE_ID: "dj-finder",
    SOURCE_EMITTER_INPUT_PATH: "/tmp/dj-source.json",
    SOURCE_EMITTER_PUBLISH_ENABLED: "true",
    SOURCE_EMITTER_OUTREACH_BASE_URL: "https://outreach.example.com"
  };
  assert.throws(() => loadEmitterConfig({
    ...base,
    SOURCE_EMITTER_SIGNING_SECRET: SECRET
  }), (error) => error.code === "SOURCE_EMITTER_CONFIG_INVALID");
  const config = loadEmitterConfig({
    ...base,
    SOURCE_EMITTER_SIGNING_KEY_ID: KEY_ID,
    SOURCE_EMITTER_SIGNING_KEY: SECRET
  });
  assert.equal(config.signingKeyId, KEY_ID);
  assert.equal(config.signingKey, SECRET);
});

test("concurrent same-ISRC creates converge on the newest verified source revision", async () => {
  const now = Date.now();
  let record;
  let initialLookups = 0;
  let releaseLookups;
  const lookupBarrier = new Promise((resolve) => { releaseLookups = resolve; });
  let createAttempts = 0;
  let createSuccesses = 0;
  const espocrm = {
    async findOne(entityType) {
      assert.equal(entityType, "MusicRelease");
      if (!record && initialLookups < 2) {
        initialLookups += 1;
        if (initialLookups === 2) releaseLookups();
        await lookupBarrier;
        return undefined;
      }
      return record;
    },
    async create(entityType, payload) {
      assert.equal(entityType, "MusicRelease");
      createAttempts += 1;
      if (record) throw Object.assign(new Error("duplicate ISRC"), { statusCode: 409, code: "ESPOCRM_HTTP_409" });
      createSuccesses += 1;
      record = { id: "release-isrc-1", versionNumber: 1, ...payload };
      return record;
    },
    async updateConditional(entityType, id, payload, versionNumber) {
      assert.equal(entityType, "MusicRelease");
      assert.equal(id, record.id);
      if (versionNumber !== record.versionNumber) {
        throw Object.assign(new Error("stale version"), { statusCode: 409, code: "ESPOCRM_VERSION_CONFLICT" });
      }
      record = { ...record, ...payload, versionNumber: versionNumber + 1 };
      return record;
    }
  };
  const serviceFor = (artifactId) => createSourceIngestionService({
    espocrm,
    repository: {
      async beginArtifact() {
        return { claimed: true, completed: false, lease: { sourceId: "dj-finder", artifactId, leaseOwner: artifactId, leaseVersion: 1 } };
      },
      async renewArtifactLease() { return true; },
      async linkRecord() {},
      async completeArtifact() {},
      async failArtifact() { return true; }
    },
    emailValidationProvider: { async validate() { throw new Error("release ingestion must not validate email"); } },
    cryptoBox: { privacyHash: (value) => createHash("sha256").update(value).digest("hex") },
    config: {
      sourceIngestion: { maxArtifactAgeSeconds: 86_400, maxEvidenceAgeSeconds: 7_776_000, processingLeaseSeconds: 900 },
      emailValidation: { cacheTtlDays: 30 }
    },
    logger: { info() {} },
    metrics: new Metrics()
  });
  const artifact = ({ artifactId, capturedAt, title }) => ({
    schemaVersion: "1.0",
    sourceId: "dj-finder",
    artifactId,
    generatedAt: new Date(now).toISOString(),
    records: [{
      kind: "musicRelease",
      externalId: `release:${artifactId}`,
      isrc: "NLABC2600001",
      name: title,
      artistName: "Marc Rene",
      genres: ["Indie"],
      languages: ["en"],
      epkUrl: "https://artist.example.com/epk",
      evidence: {
        url: "https://artist.example.com/releases",
        text: `Verified release evidence for ${title}.`,
        capturedAt
      }
    }]
  });
  const older = artifact({ artifactId: "release-race-older", capturedAt: new Date(now - 60_000).toISOString(), title: "Older Title" });
  const newer = artifact({ artifactId: "release-race-newer", capturedAt: new Date(now).toISOString(), title: "Canonical Newer Title" });

  await Promise.all([
    serviceFor(older.artifactId).ingest({ sourceId: "dj-finder", artifact: older, rawBody: Buffer.from(JSON.stringify(older)) }),
    serviceFor(newer.artifactId).ingest({ sourceId: "dj-finder", artifact: newer, rawBody: Buffer.from(JSON.stringify(newer)) })
  ]);

  assert.equal(initialLookups, 2);
  assert.equal(createAttempts, 2);
  assert.equal(createSuccesses, 1);
  assert.equal(record.isrc, "NLABC2600001");
  assert.equal(record.name, "Canonical Newer Title");
  assert.equal(record.sourceEvidenceCapturedAt, new Date(now).toISOString().slice(0, 19).replace("T", " "));
  assert.match(record.sourceEvidenceDigest, /^[0-9a-f]{64}$/u);
});

function sourceArtifact() {
  const generatedAt = new Date().toISOString();
  return {
    schemaVersion: "1.0",
    sourceId: "dj-finder",
    artifactId: "artifact-20260715-a",
    generatedAt,
    records: [
      {
        kind: "mediaOutlet",
        externalId: "dj-example",
        name: "DJ Example",
        type: "DJ",
        website: "https://dj.example/",
        country: "NL",
        language: "en",
        timezone: "Europe/Amsterdam",
        genres: ["Dance"],
        subGenres: ["Club"],
        formatGenres: ["Dance"],
        submissionPolicy: "Explicit",
        acceptsEmail: true,
        verified: true,
        evidence: {
          url: "https://dj.example/submissions",
          text: "The page explicitly invites unreleased music by email.",
          capturedAt: generatedAt
        }
      },
      {
        kind: "mediaContact",
        externalId: "dj-example-music",
        outletExternalId: "dj-example",
        fullName: "DJ Example music desk",
        firstName: "DJ",
        lastName: "Example",
        showName: "Night Signals",
        email: "music@dj.example",
        role: "Music submissions",
        linkedinUrl: "https://www.linkedin.com/in/dj-example/",
        soundcloudUrl: "https://soundcloud.com/dj-example",
        preferredLanguage: "en",
        timezone: "Europe/Amsterdam",
        verified: true,
        purpose: "Explicit Music Submission",
        basis: "Explicit Submission Address",
        evidence: {
          url: "https://dj.example/submissions",
          text: "The page explicitly lists this address for unreleased music.",
          capturedAt: generatedAt
        }
      }
    ]
  };
}

function createHarness({ validation }) {
  const repository = fakeSourceRepository();
  const espo = fakeEspo();
  const providerCalls = [];
  const service = createSourceIngestionService({
    espocrm: espo,
    repository,
    emailValidationProvider: {
      async validate(email, idempotencyKey) {
        providerCalls.push({ email, idempotencyKey });
        return validation;
      }
    },
    cryptoBox: { privacyHash: (value) => createHash("sha256").update(value).digest("hex") },
    config: {
      sourceIngestion: { maxArtifactAgeSeconds: 86_400, maxEvidenceAgeSeconds: 7_776_000, processingLeaseSeconds: 900 },
      emailValidation: { cacheTtlDays: 30 }
    },
    logger: { info() {} },
    metrics: new Metrics()
  });
  return { service, repository, espo, providerCalls };
}

function fakeSourceRepository() {
  const links = new Map();
  return {
    validationWrites: [],
    async beginArtifact() {
      return {
        claimed: true,
        completed: false,
        lease: {
          sourceId: "dj-finder",
          artifactId: "artifact-20260715-a",
          leaseOwner: "unit-test-owner",
          leaseVersion: 1
        }
      };
    },
    async renewArtifactLease() { return true; },
    async completeArtifact() {},
    async failArtifact() { return true; },
    async linkRecord(record) {
      links.set(`${record.sourceId}:${record.externalId}:${record.entityType}`, record.crmEntityId);
    },
    async findLinkedEntity({ sourceId, externalId, entityType }) {
      return links.get(`${sourceId}:${externalId}:${entityType}`);
    },
    async getEmailValidation() { return undefined; },
    async putEmailValidation(value) { this.validationWrites.push(value); }
  };
}

function fakeEspo() {
  const byType = { MediaOutlet: [], MediaContact: [], MusicRelease: [] };
  let nextId = 1;
  return {
    byType,
    async findOne(entityType, attribute, value) {
      return byType[entityType].find((record) => record[attribute] === value);
    },
    async findUniqueWhere(entityType, where) {
      const matches = byType[entityType].filter((record) => where.every((criterion) =>
        criterion.type === "equals" && record[criterion.attribute] === criterion.value
      ));
      if (matches.length > 1) {
        throw Object.assign(new Error("unique lookup returned duplicates"), {
          code: "ESPOCRM_UNIQUE_CONTRACT_VIOLATED"
        });
      }
      return matches[0];
    },
    async get(entityType, id) {
      return byType[entityType].find((record) => record.id === id);
    },
    async findUniqueWhere(entityType, where) {
      const matches = byType[entityType].filter((record) => where.every((condition) =>
        condition.type === "equals" && record[condition.attribute] === condition.value
      ));
      if (matches.length > 1) {
        throw Object.assign(new Error("fake Espo unique contract violated"), {
          code: "ESPOCRM_UNIQUE_CONTRACT_VIOLATED"
        });
      }
      return matches[0];
    },
    async upsertByUnique(entityType, attribute, value, payload) {
      const existing = byType[entityType].find((record) => record[attribute] === value);
      if (existing) return Object.assign(existing, payload, { versionNumber: existing.versionNumber + 1 });
      const created = { ...payload, id: `${entityType}-${nextId++}`, versionNumber: 1 };
      byType[entityType].push(created);
      return created;
    },
    async create(entityType, payload) {
      const created = { ...payload, id: `${entityType}-${nextId++}`, versionNumber: 1 };
      byType[entityType].push(created);
      return created;
    },
    async updateConditional(entityType, id, payload) {
      const record = byType[entityType].find((candidate) => candidate.id === id);
      return Object.assign(record, payload, { versionNumber: record.versionNumber + 1 });
    }
  };
}

function sourceConfig() {
  return {
    enabled: true,
    keyrings: {
      "dj-finder": {
        schemaVersion: 2,
        active: { kid: KEY_ID, key: SECRET },
        verifyOnly: [{ kid: HISTORICAL_KEY_ID, key: HISTORICAL_SECRET }]
      },
      "music-submission-agent": {
        schemaVersion: 2,
        active: { kid: OTHER_SOURCE_KEY_ID, key: OTHER_SOURCE_SECRET },
        verifyOnly: []
      }
    },
    maxSkewSeconds: 300
  };
}

function httpConfig() {
  return {
    espocrm: { webhookSecrets: { webhook: "webhook-secret-123456" } },
    mailgun: { webhookSigningKey: "mailgun-signing-key-123456" },
    crypto: { unsubscribeSigning: UNSUBSCRIBE_KEYRING },
    metricsToken: "metrics-token-1234567890123456",
    safety: { killSwitch: true, sendEnabled: false },
    publicBaseUrl: "https://outreach.example.com",
    sourceIngestion: sourceConfig()
  };
}
