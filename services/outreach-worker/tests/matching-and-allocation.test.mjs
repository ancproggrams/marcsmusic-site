import test from "node:test";
import assert from "node:assert/strict";

import { createMatchService } from "../src/application/match-service.mjs";
import { allocateBestMatches } from "../src/domain/campaign-allocator.mjs";
import { calculateMatchScore, classifyMatch } from "../src/domain/match-score.mjs";
import { evaluateContactEvidence, evaluateOutletEvidence } from "../src/domain/evidence-policy.mjs";

const NOW = new Date("2026-07-15T12:00:00.000Z");

function scoreInput(overrides = {}) {
  return {
    release: {
      genres: ["indie"],
      subGenres: ["dream pop"],
      languages: ["en"],
      territories: ["NL"],
      ...overrides.release
    },
    outlet: {
      genres: ["indie"],
      subGenres: ["dream pop"],
      formatGenres: ["indie"],
      language: "en",
      country: "NL",
      submissionPolicy: "Explicit",
      ...overrides.outlet
    },
    contact: {
      preferredLanguage: "en",
      contactPurpose: "Explicit Music Submission",
      lastValidatedAt: "2026-07-01T00:00:00.000Z",
      previousPositiveReply: true,
      rejectedGenres: [],
      ...overrides.contact
    },
    now: NOW
  };
}

test("the complete positive signal set is capped at 100", () => {
  const result = calculateMatchScore(scoreInput());

  assert.equal(result.score, 100);
  assert.equal(result.reasons.reduce((total, reason) => total + reason.points, 0), 105);
  assert.deepEqual(
    result.reasons.map(({ code }) => code),
    [
      "main_genre_match",
      "subgenre_match",
      "format_match",
      "language_match",
      "territory_match",
      "explicit_submission",
      "recent_validation",
      "previous_positive_reply"
    ]
  );
});

test("genre rejection and stale validation apply their exact penalties", () => {
  const result = calculateMatchScore(scoreInput({
    release: { genres: ["techno"], subGenres: [], languages: ["fr"], territories: ["DE"] },
    outlet: { genres: ["indie"], subGenres: [], formatGenres: ["pop"], language: "en", country: "NL", submissionPolicy: "Unknown" },
    contact: {
      preferredLanguage: "en",
      contactPurpose: "General Contact",
      lastValidatedAt: "2024-01-01T00:00:00.000Z",
      previousPositiveReply: false,
      rejectedGenres: ["TECHNO"]
    }
  }));

  assert.equal(result.score, -40);
  assert.deepEqual(result.reasons.map(({ code, points }) => [code, points]), [
    ["previous_genre_rejection", -25],
    ["stale_validation", -15]
  ]);
});

test("main genre plus explicit defaults stays below auto-send and awards only evidenced points", () => {
  const result = calculateMatchScore({
    release: { genres: ["Dance"], subGenres: [], languages: [], territories: [] },
    outlet: {
      genres: ["Dance"],
      subGenres: [],
      formatGenres: [],
      submissionPolicy: "Explicit"
    },
    contact: {
      contactPurpose: "Explicit Music Submission",
      lastValidatedAt: "2026-07-01T00:00:00.000Z",
      rejectedGenres: []
    },
    now: NOW
  });

  assert.equal(result.score, 45);
  assert.ok(result.score < 80);
  assert.deepEqual(result.reasons.map(({ code, points }) => [code, points]), [
    ["main_genre_match", 25],
    ["explicit_submission", 15],
    ["recent_validation", 5]
  ]);
});

test("unknown or empty language, territory, format and subgenre signals award zero points", () => {
  const result = calculateMatchScore({
    release: {
      genres: [],
      subGenres: ["Other", "unknown"],
      languages: ["other", "unknown"],
      territories: ["unknown"]
    },
    outlet: {
      genres: [],
      subGenres: ["Other"],
      formatGenres: ["Other", "unknown"],
      language: "other",
      country: "unknown",
      submissionPolicy: "Unknown"
    },
    contact: {
      preferredLanguage: "other",
      contactPurpose: "Unknown",
      lastValidatedAt: "2026-07-01T00:00:00.000Z",
      rejectedGenres: []
    },
    now: NOW
  });

  assert.equal(result.score, 5);
  assert.deepEqual(result.reasons.map(({ code }) => code), ["recent_validation"]);
});

test("a validation exactly 365 days old is still recent", () => {
  const result = calculateMatchScore(scoreInput({
    contact: { lastValidatedAt: "2025-07-15T12:00:00.000Z", previousPositiveReply: false }
  }));

  assert.ok(result.reasons.some(({ code, points }) => code === "recent_validation" && points === 5));
  assert.ok(!result.reasons.some(({ code }) => code === "stale_validation"));
});

test("classification boundaries are inclusive and configurable", () => {
  assert.equal(classifyMatch(80), "Eligible");
  assert.equal(classifyMatch(79), "Waitlist");
  assert.equal(classifyMatch(65), "Waitlist");
  assert.equal(classifyMatch(64), "Skipped");
  assert.equal(classifyMatch(90, { autoThreshold: 90, waitlistThreshold: 70 }), "Eligible");
  assert.equal(classifyMatch(69, { autoThreshold: 90, waitlistThreshold: 70 }), "Skipped");
});

test("matching integration cannot promote main-genre-only CRM records to auto-send", async () => {
  let persistedMatch;
  const contact = {
    id: "contact-main-only",
    name: "Music Desk",
    emailAddress: "music@radio.example.test",
    preferredLanguage: "en",
    timezone: "Europe/Amsterdam",
    status: "Ready for Matching",
    mediaOutletId: "outlet-main-only",
    contactPurpose: "Promo Contact",
    contactBasis: "Explicit Submission Address",
    contactSourceUrl: "https://radio.example.test/contact",
    contactEvidence: "The current contact page explicitly lists this promo address.",
    emailValidationStatus: "Valid",
    lastValidatedAt: new Date().toISOString()
  };
  const outlet = {
    id: "outlet-main-only",
    name: "Main Genre Radio",
    website: "https://radio.example.test",
    country: "NL",
    timezone: "Europe/Amsterdam",
    genres: ["Dance"],
    submissionPolicy: "General Contact",
    acceptsEmail: true,
    activityStatus: "Active"
  };
  const release = {
    id: "release-main-only",
    name: "Main Signal",
    artistName: "Marc Rene",
    status: "Active",
    genres: ["Dance"],
    epkUrl: "https://artist.example.test/epk"
  };
  const espocrm = {
    async get(entityType) {
      if (entityType === "MediaContact") return contact;
      if (entityType === "MediaOutlet") return outlet;
      throw new Error(`unexpected get ${entityType}`);
    },
    async list(entityType) {
      if (entityType === "MusicRelease") return [release];
      if (entityType === "OutreachMatch") return [];
      throw new Error(`unexpected list ${entityType}`);
    },
    async upsertByUnique(entityType, _attribute, _value, payload) {
      assert.equal(entityType, "OutreachMatch");
      persistedMatch = payload;
      return { id: "match-main-only", versionNumber: 1, ...payload };
    }
  };
  const service = createMatchService({
    espocrm,
    contactIntakeService: fakeContactIntakeService(espocrm),
    repository: {
      async withContactAllocationFence(_contactId, work) { return work(); },
      async isSuppressed() { return false; },
      async getContactGenreDenials() { return []; }
    },
    copyService: {},
    config: {
      policy: { outletCooldownDays: 14, matchThreshold: 80, waitlistThreshold: 65 },
      mailgun: { domain: "mail.example.test" }
    },
    logger: { info() {} },
    metrics: { increment() {} }
  });

  const outcome = await service.processContact(contact.id);
  const reasons = JSON.parse(persistedMatch.matchReasons).score;
  assert.equal(outcome.allocated, 0);
  assert.equal(persistedMatch.matchScore, 30);
  assert.equal(persistedMatch.eligibilityStatus, "Blocked");
  assert.deepEqual(reasons.map(({ code, points }) => [code, points]), [
    ["main_genre_match", 25],
    ["recent_validation", 5]
  ]);
});

test("matching excludes contacts discovered before the activation fence", async () => {
  const calls = { outlet: 0, releases: 0, allocations: 0 };
  const contactIntakeService = {
    async processContact() {
      return {
        canonicalId: "contact-before-fence",
        record: {
          id: "contact-before-fence",
          createdAt: "2026-07-16 08:00:00",
          proofCapturedAt: "2026-07-15 21:59:59",
          mediaOutletId: "outlet-before-fence"
        },
        attestation: { evidenceCapturedAt: "2026-07-15T21:59:59.000Z" }
      };
    },
    async processOutlet() {
      calls.outlet += 1;
      throw new Error("an old contact must be rejected before outlet processing");
    }
  };
  const service = createMatchService({
    espocrm: {
      async list(entityType) {
        calls.releases += 1;
        throw new Error(`unexpected CRM list ${entityType}`);
      }
    },
    contactIntakeService,
    repository: {
      async withContactAllocationFence(_contactId, work) { return work(); },
      async isSuppressed() { calls.allocations += 1; return false; }
    },
    copyService: {},
    config: {
      safety: { newContactsOnlyFrom: "2026-07-16" },
      policy: { outletCooldownDays: 14, matchThreshold: 80, waitlistThreshold: 65 }
    },
    logger: { info() {} },
    metrics: { increment() {} }
  });

  assert.deepEqual(await service.processContact("contact-before-fence"), {
    matched: 0,
    allocated: 0,
    blocked: 1,
    skipped: "contact_before_activation_date"
  });
  assert.deepEqual(calls, { outlet: 0, releases: 0, allocations: 0 });
});

test("allocator enforces contact, pair, outlet cooldown and outlet count constraints", () => {
  const candidates = [
    { releaseId: "release-a", releasePriority: 10, contactId: "contact-1", outletId: "outlet-1", score: 95, eligible: true },
    { releaseId: "release-b", releasePriority: 10, contactId: "contact-1", outletId: "outlet-2", score: 94, eligible: true },
    { releaseId: "release-a", releasePriority: 10, contactId: "contact-2", outletId: "outlet-2", score: 93, eligible: true },
    { releaseId: "release-a", releasePriority: 10, contactId: "contact-3", outletId: "outlet-3", score: 92, eligible: true },
    { releaseId: "release-a", releasePriority: 10, contactId: "contact-4", outletId: "outlet-1", score: 91, eligible: true },
    { releaseId: "release-a", releasePriority: 10, contactId: "contact-5", outletId: "outlet-4", score: 90, eligible: false },
    { releaseId: "release-a", releasePriority: 10, contactId: "contact-6", outletId: "outlet-5", score: 89, eligible: true }
  ];

  const result = allocateBestMatches(candidates, {
    maxContactsPerOutlet: 1,
    recentlyContactedOutletIds: ["outlet-3"],
    alreadySentPairs: ["release-a:contact-2"]
  });

  assert.deepEqual(result.allocations.map(({ contactId }) => contactId), ["contact-1", "contact-6"]);
  assert.deepEqual(Object.fromEntries(result.skipped.map(({ contactId, reason }) => [contactId, reason])), {
    "contact-1": "contact_has_active_sequence",
    "contact-2": "release_already_sent_to_contact",
    "contact-3": "outlet_cooldown_active",
    "contact-4": "outlet_contact_limit_reached",
    "contact-5": "not_eligible"
  });
  assert.equal(Object.isFrozen(result.allocations), true);
  assert.equal(Object.isFrozen(result.skipped), true);
});

test("allocator tie-breaking is deterministic by release priority then release id", () => {
  const candidates = [
    { releaseId: "release-z", releasePriority: 1, contactId: "contact-z", outletId: "outlet-z", score: 80, eligible: true },
    { releaseId: "release-b", releasePriority: 2, contactId: "contact-b", outletId: "outlet-b", score: 80, eligible: true },
    { releaseId: "release-a", releasePriority: 2, contactId: "contact-a", outletId: "outlet-a", score: 80, eligible: true }
  ];

  const result = allocateBestMatches(candidates);

  assert.deepEqual(result.allocations.map(({ releaseId }) => releaseId), ["release-a", "release-b", "release-z"]);
});

test("contact matching indexes existing matches instead of scanning them once per release", async () => {
  const releases = Array.from({ length: 200 }, (_, index) => ({
    id: `release-${index}`,
    name: `Release ${index}`,
    artistName: "Marc Rene",
    status: "Active",
    epkUrl: "https://artist.example.test/epk"
  }));
  const rawMatches = Array.from({ length: 200 }, (_, index) => ({
    id: `match-${index}`,
    musicReleaseId: `release-${index}`,
    campaignStatus: "Blocked"
  }));
  const existingMatches = new Proxy(rawMatches, {
    get(target, property, receiver) {
      if (property === "find") throw new Error("O(R×M) existing-match scan detected");
      return Reflect.get(target, property, receiver);
    }
  });
  const espocrm = {
    async get(entityType) {
      if (entityType === "MediaContact") return { id: "contact-1", mediaOutletId: "outlet-1", status: "Active" };
      if (entityType === "MediaOutlet") return { id: "outlet-1", name: "Radio", activityStatus: "Active", submissionPolicy: "Explicit", acceptsEmail: true };
      throw new Error(`unexpected ${entityType}`);
    },
    async list(entityType) {
      if (entityType === "MusicRelease") return releases;
      if (entityType === "OutreachMatch") return existingMatches;
      throw new Error(`unexpected ${entityType}`);
    },
    async upsertByUnique(_entityType, _attribute, value, payload) { return { id: value, ...payload }; }
  };
  const service = createMatchService({
    espocrm,
    contactIntakeService: fakeContactIntakeService(espocrm),
    repository: {
      async withContactAllocationFence(_contactId, work) { return work(); },
      async isSuppressed() { return false; }
    },
    copyService: {},
    config: { policy: { outletCooldownDays: 14, matchThreshold: 80, waitlistThreshold: 65 } },
    logger: { info() {} },
    metrics: { increment() {} }
  });

  const result = await service.processContact("contact-1");

  assert.equal(result.matched, releases.length);
  assert.equal(result.allocated, 0);
});

test("a release trigger evaluates every active release and ignores its stale release hint", async () => {
  const contact = contactRecord("contact-trigger", "trigger@radio.example.test");
  const outlet = {
    id: "outlet-1",
    name: "Example Radio",
    website: "https://radio.example.test",
    country: "NL",
    language: "en",
    genres: ["indie"],
    subGenres: ["dream pop"],
    formatGenres: ["indie"],
    submissionPolicy: "Explicit",
    acceptsEmail: true,
    activityStatus: "Active"
  };
  const release = (id, priority) => ({
    id,
    name: id,
    artistName: "Marc Rene",
    status: "Active",
    genres: ["indie"],
    subGenres: ["dream pop"],
    languages: ["en"],
    territories: ["NL"],
    epkUrl: `https://artist.example.test/${id}`,
    priority
  });
  const activeReleases = [release("release-b", 10), release("release-a", 20)];
  const attempted = [];
  const espocrm = {
    async get(entityType) {
      if (entityType === "MediaContact") return contact;
      if (entityType === "MediaOutlet") return outlet;
      if (entityType === "MusicRelease") throw new Error("the stale trigger release must never scope contact evaluation");
      throw new Error(`unexpected get ${entityType}`);
    },
    async list(entityType) {
      if (entityType === "MusicRelease") return activeReleases;
      if (entityType === "OutreachMatch") return [];
      throw new Error(`unexpected list ${entityType}`);
    },
    async upsertByUnique(entityType, _attribute, _value, payload) {
      assert.equal(entityType, "OutreachMatch");
      return { id: `match-${payload.musicReleaseId}`, versionNumber: 1, ...payload };
    },
    async updateConditional(_entityType, id, patch) { return { id, ...patch }; }
  };
  const repository = {
    async withContactAllocationFence(id, work) {
      assert.equal(id, contact.id);
      return work();
    },
    async isSuppressed() { return false; },
    async getContactGenreDenials() { return []; },
    async tryAcquireAllocation(input) {
      attempted.push(input);
      return { acquired: false, reason: "recipient_has_active_allocation" };
    }
  };
  const service = createMatchService({
    espocrm,
    contactIntakeService: fakeContactIntakeService(espocrm),
    repository,
    copyService: {},
    config: {
      policy: { outletCooldownDays: 14, matchThreshold: 80, waitlistThreshold: 65 },
      mailgun: { domain: "mail.example.test" }
    },
    logger: { info() {} },
    metrics: { increment() {} }
  });

  const result = await service.processContact(contact.id, { releaseId: "release-stale-paused" });

  assert.equal(result.matched, 2);
  assert.equal(attempted.length, 1);
  assert.equal(attempted[0].releaseId, "release-a", "priority must break an equal-score tie before release id");
});

test("copy failures retain transient allocations but release an exact permanent pre-queue failure", async () => {
  const contacts = {
    "contact-a": contactRecord("contact-a", "a@radio.example.test"),
    "contact-b": contactRecord("contact-b", "b@radio.example.test")
  };
  const outlet = {
    id: "outlet-1",
    name: "Example Radio",
    website: "https://radio.example.test",
    country: "NL",
    language: "en",
    timezone: "Europe/Amsterdam",
    genres: ["indie"],
    subGenres: ["dream pop"],
    formatGenres: ["indie"],
    submissionPolicy: "Explicit",
    submissionUrl: "https://radio.example.test/submissions",
    acceptsEmail: true,
    activityStatus: "Active"
  };
  const release = {
    id: "release-1",
    name: "Northern Lights",
    artistName: "Marc Rene",
    status: "Active",
    genres: ["indie"],
    subGenres: ["dream pop"],
    languages: ["en"],
    territories: ["NL"],
    epkUrl: "https://artist.example.test/epk",
    priority: 10
  };
  const queuedEvents = [];
  const updates = [];
  const espocrm = {
    async get(entityType, id) {
      if (entityType === "MediaContact") return contacts[id];
      if (entityType === "MediaOutlet") return outlet;
      throw new Error(`unexpected get ${entityType}/${id}`);
    },
    async list(entityType) {
      if (entityType === "MusicRelease") return [release];
      if (entityType === "OutreachMatch") return [];
      throw new Error(`unexpected list ${entityType}`);
    },
    async upsertByUnique(entityType, _attribute, value, payload) {
      if (entityType === "OutreachMatch") {
        return { id: `match-${payload.mediaContactId}`, versionNumber: 1, ...payload };
      }
      if (entityType === "OutreachEvent") {
        queuedEvents.push(payload);
        return { id: value, ...payload };
      }
      throw new Error(`unexpected upsert ${entityType}`);
    },
    async updateConditional(entityType, id, payload, versionNumber) {
      updates.push({ entityType, id, payload, versionNumber });
      return { id, ...payload, versionNumber: versionNumber + 1 };
    }
  };
  let activeMatchId;
  const releases = [];
  const queue = [];
  const repository = {
    async withContactAllocationFence(_contactId, work) { return work(); },
    async isSuppressed() { return false; },
    async tryAcquireAllocation({ matchId }) {
      if (activeMatchId && activeMatchId !== matchId) {
        return { acquired: false, reason: "outlet_active_allocation_limit" };
      }
      activeMatchId = matchId;
      return { acquired: true, matchId };
    },
    async releaseAllocation(input) {
      releases.push(input);
      if (input.matchId !== activeMatchId) return false;
      activeMatchId = undefined;
      return true;
    },
    async enqueueSend(input) {
      queue.push(input);
      return `send-${input.contactId}`;
    }
  };
  let copyCalls = 0;
  const transientFailure = Object.assign(new Error("release link timed out"), {
    code: "RELEASE_LINK_CHECK_TIMEOUT",
    retryable: true
  });
  const permanentFailure = Object.assign(new Error("release link not found"), {
    code: "RELEASE_LINK_HTTP_404",
    retryable: false
  });
  const copyService = {
    async prepare() {
      copyCalls += 1;
      if (copyCalls === 1) throw transientFailure;
      if (copyCalls === 2) throw permanentFailure;
      return { artifactId: "artifact-b", templateVersion: "safe-template-v2" };
    }
  };
  const service = createMatchService({
    espocrm,
    contactIntakeService: fakeContactIntakeService(espocrm),
    repository,
    copyService,
    config: {
      policy: { outletCooldownDays: 14, matchThreshold: 80, waitlistThreshold: 65, maxFollowUps: 2 },
      mailgun: { domain: "mail.example.test" }
    },
    logger: { info() {} },
    metrics: { increment() {} }
  });

  await assert.rejects(service.processContact("contact-a"), (error) => error === transientFailure);
  assert.equal(activeMatchId, "match-contact-a");
  assert.deepEqual(releases, []);

  await service.processContact("contact-b");
  assert.equal(activeMatchId, "match-contact-a");
  assert.equal(copyCalls, 1, "another match cannot consume or duplicate a retained transient allocation");
  assert.equal(queue.length, 0);

  await assert.rejects(service.processContact("contact-a"), (error) => error === permanentFailure);
  assert.equal(activeMatchId, undefined);
  assert.deepEqual(releases, [{
    matchId: "match-contact-a",
    cooldownUntil: null,
    reason: "copy_preparation_permanent_failure"
  }]);

  const result = await service.processContact("contact-b");

  assert.equal(result.allocated, 1);
  assert.equal(activeMatchId, "match-contact-b");
  assert.equal(queue.length, 1);
  assert.equal(queue[0].contactId, "contact-b");
  assert.equal(queuedEvents[0].templateVersion, "safe-template-v2");
  assert.ok(updates.some(({ id, payload }) => id === "match-contact-b" && payload.activeSequence === true));
});

function contactRecord(id, emailAddress) {
  return {
    id,
    name: `Editor ${id}`,
    firstName: "Sam",
    emailAddress,
    status: "Active",
    role: "music editor",
    preferredLanguage: "en",
    timezone: "Europe/Amsterdam",
    mediaOutletId: "outlet-1",
    contactSourceUrl: "https://radio.example.test/submissions",
    contactEvidence: "The outlet publishes this address for music submissions.",
    contactPurpose: "Explicit Music Submission",
    contactBasis: "Explicit Submission Address",
    emailValidationStatus: "Valid",
    lastValidatedAt: "2026-07-01T00:00:00.000Z",
    doNotContact: false,
    optedOut: false,
    hardBounced: false,
    rejectedGenres: []
  };
}

function fakeContactIntakeService(espocrm) {
  const capturedAt = "2026-07-01T00:00:00.000Z";
  return {
    async processContact(id) {
      const raw = await espocrm.get("MediaContact", id);
      const record = {
        versionNumber: 1,
        proofCapturedAt: capturedAt,
        ...raw
      };
      const evaluation = evaluateContactEvidence({
        entityId: record.id,
        entityVersion: record.versionNumber,
        email: record.emailAddress,
        purpose: record.contactPurpose,
        basis: record.contactBasis,
        sourceUrl: record.contactSourceUrl,
        evidenceText: record.contactEvidence,
        capturedAt: record.proofCapturedAt,
        now: NOW,
        sourceKind: "signed_source"
      });
      return { canonicalId: record.id, record, attestation: fakeAttestation(evaluation), attested: evaluation.allowed };
    },
    async processOutlet(id) {
      const raw = await espocrm.get("MediaOutlet", id);
      const record = {
        versionNumber: 1,
        sourceUrl: raw.submissionUrl ?? `${String(raw.website ?? "https://radio.example.test").replace(/\/$/u, "")}/submissions`,
        submissionEvidence: "The outlet accepts music submissions by email.",
        lastValidatedAt: capturedAt,
        ...raw
      };
      const evaluation = evaluateOutletEvidence({
        entityId: record.id,
        entityVersion: record.versionNumber,
        submissionPolicy: record.submissionPolicy,
        sourceUrl: record.sourceUrl,
        evidenceText: record.submissionEvidence,
        capturedAt: record.lastValidatedAt,
        now: NOW,
        sourceKind: "signed_source"
      });
      return { canonicalId: record.id, record, attestation: fakeAttestation(evaluation), attested: evaluation.allowed };
    }
  };
}

function fakeAttestation(evaluation) {
  return {
    ...evaluation.attestation,
    evidenceDigest: evaluation.digest,
    status: "active",
    sourceKind: "signed_source",
    originCompleted: true
  };
}
