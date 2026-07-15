import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import {
  createSourceIngestionService,
  verifiedEvidenceWins
} from "../src/application/source-ingestion-service.mjs";
import {
  contactFingerprintFromArtifact,
  legacyContactFingerprintFromArtifact
} from "../src/domain/source-artifact.mjs";
import { Metrics } from "../src/infrastructure/metrics.mjs";

test("contact fingerprint combines normalized email, outlet domain and contact name", () => {
  const first = { email: "Desk@Radio.Example", fullName: "DJ Jane-Doe" };
  const equivalent = { email: "desk@radio.example", fullName: "dj jane doe" };
  assert.equal(
    contactFingerprintFromArtifact(first, "https://www.Radio.Example/submissions"),
    contactFingerprintFromArtifact(equivalent, "radio.example")
  );
  assert.notEqual(
    contactFingerprintFromArtifact(first, "radio.example"),
    contactFingerprintFromArtifact(first, "other-radio.example")
  );
  assert.notEqual(
    contactFingerprintFromArtifact(first, "radio.example"),
    contactFingerprintFromArtifact({ ...first, fullName: "Another Desk" }, "radio.example")
  );
  assert.equal(legacyContactFingerprintFromArtifact(first), legacyContactFingerprintFromArtifact(equivalent));
});

test("evidence ordering treats Espo datetimes as UTC and preserves Date milliseconds", () => {
  assert.equal(verifiedEvidenceWins({
    incoming: verifiedEvidence("2026-07-15T11:30:00.000Z"),
    existingTimestamp: "2026-07-15 12:00:00"
  }), false);
  assert.equal(verifiedEvidenceWins({
    incoming: verifiedEvidence("2026-07-15T12:00:00.500Z"),
    existingTimestamp: "2026-07-15 11:00:00",
    boundEvidence: { verified: true, verifiedAt: new Date("2026-07-15T12:00:00.789Z") }
  }), false);
});

test("an independently valid but unverified contact stays quarantined and promotes no aliases", async () => {
  const harness = createHarness();
  const capturedAt = iso(Date.now() - 60_000);
  const result = await ingest(harness, "unverified-contact", [
    outlet({ externalId: "outlet", capturedAt }),
    contact({
      externalId: "unverified",
      outletExternalId: "outlet",
      fullName: "Unverified Contact",
      email: "unverified@example.com",
      capturedAt,
      verified: false
    })
  ]);
  assert.equal(result.contactsReady, 0);
  assert.equal(result.contactsHeld, 1);
  assert.equal(harness.espo.byType.MediaContact[0].emailValidationStatus, "Valid");
  assert.equal(harness.espo.byType.MediaContact[0].status, "Needs Validation");
  assert.equal(harness.repository.bindingCount("MediaContact"), 0);
});

test("verified evidence does not promote an invalid email or its fingerprints", async () => {
  const harness = createHarness({ validationStatus: "Invalid" });
  const capturedAt = iso(Date.now() - 60_000);
  const result = await ingest(harness, "invalid-email", [
    outlet({ externalId: "outlet", capturedAt }),
    contact({
      externalId: "invalid-email",
      outletExternalId: "outlet",
      fullName: "Verified DJ",
      email: "invalid@example.com",
      instagramUrl: "https://www.instagram.com/verified.dj/",
      capturedAt
    })
  ]);
  assert.equal(result.contactsHeld, 1);
  assert.deepEqual(harness.repository.bindingTypes("MediaContact"), ["instagram", "name_outlet"]);
});

test("an incoming no-submissions outlet is deny-wins even when otherwise verified", async () => {
  const harness = createHarness();
  await ingest(harness, "no-submissions", [outlet({
    externalId: "no-submissions",
    capturedAt: iso(Date.now() - 60_000),
    submissionPolicy: "No Submissions",
    acceptsEmail: true,
    acceptsForms: true,
    acceptsUnreleased: true
  })]);
  const stored = harness.espo.byType.MediaOutlet[0];
  assert.equal(stored.activityStatus, "Blocked");
  assert.equal(stored.submissionPolicy, "No Submissions");
  assert.equal(stored.acceptsEmail, false);
  assert.equal(stored.acceptsForms, false);
  assert.equal(stored.acceptsUnreleased, false);
});

test("Instagram, normalized name+outlet and show+outlet identities merge into one contact", async (t) => {
  const cases = [
    {
      name: "Instagram",
      first: { fullName: "First DJ", instagramUrl: "https://instagram.com/shared.dj/" },
      second: { fullName: "Renamed DJ", instagramUrl: "https://www.instagram.com/shared.dj" }
    },
    {
      name: "normalized name+outlet",
      first: { fullName: "DJ Jane-Doe" },
      second: { fullName: "dj jane doe" }
    },
    {
      name: "show+outlet",
      first: { fullName: "Presenter One", showName: "Night-Shift" },
      second: { fullName: "Production Desk", showName: "night shift" }
    }
  ];
  for (const scenario of cases) {
    await t.test(scenario.name, async () => {
      const harness = createHarness();
      const now = Date.now();
      await ingest(harness, "first", [
        outlet({ externalId: "outlet-first", capturedAt: iso(now - 120_000) }),
        contact({
          externalId: "contact-first",
          outletExternalId: "outlet-first",
          email: "first@example.com",
          capturedAt: iso(now - 120_000),
          ...scenario.first
        })
      ]);
      await ingest(harness, "second", [
        outlet({ externalId: "outlet-second", capturedAt: iso(now - 60_000) }),
        contact({
          externalId: "contact-second",
          outletExternalId: "outlet-second",
          email: "second@example.com",
          capturedAt: iso(now - 60_000),
          ...scenario.second
        })
      ]);

      assert.equal(harness.espo.byType.MediaOutlet.length, 1);
      assert.equal(harness.espo.byType.MediaContact.length, 1);
      assert.equal(harness.espo.byType.MediaContact[0].name, scenario.second.fullName);
      assert.equal(harness.espo.byType.MediaContact[0].emailAddress, "second@example.com");
      assert.equal(harness.repository.linked("dj-finder", "contact-first", "MediaContact"),
        harness.repository.linked("dj-finder", "contact-second", "MediaContact"));
    });
  }
});

test("conflicting unique identity signals fail closed before any contact mutation", async () => {
  const harness = createHarness();
  const now = Date.now();
  await ingest(harness, "outlet-only", [outlet({ externalId: "outlet", capturedAt: iso(now - 120_000) })]);
  const incoming = contact({
    externalId: "ambiguous",
    outletExternalId: "outlet",
    fullName: "Ambiguous Contact",
    email: "ambiguous@example.com",
    instagramUrl: "https://www.instagram.com/ambiguous/",
    capturedAt: iso(now - 60_000)
  });
  const outletId = harness.repository.linked("dj-finder", "outlet", "MediaOutlet");
  harness.espo.seed("MediaContact", {
    id: "contact-by-email",
    versionNumber: 1,
    name: "Email Candidate",
    emailAddress: incoming.email,
    fingerprint: contactFingerprintFromArtifact(incoming, "radio.example"),
    mediaOutletId: outletId,
    status: "Needs Validation",
    emailValidationStatus: "Unknown",
    smtpValidationStatus: "Unknown"
  });
  harness.espo.seed("MediaContact", {
    id: "contact-by-instagram",
    versionNumber: 1,
    name: "Instagram Candidate",
    emailAddress: "other@example.com",
    instagramUrl: incoming.instagramUrl,
    mediaOutletId: outletId,
    status: "Needs Validation",
    emailValidationStatus: "Unknown",
    smtpValidationStatus: "Unknown"
  });
  harness.espo.updateCalls.length = 0;

  await assert.rejects(
    () => ingest(harness, "ambiguous", [incoming]),
    (error) => error.code === "SOURCE_DEDUP_AMBIGUOUS" && error.retryable === false
  );
  assert.equal(harness.espo.updateCalls.length, 0);
  assert.equal(harness.espo.createCounts.MediaContact, 0);
  assert.equal(harness.repository.abandonedClaims, 1);
});

test("opt-outs and active suppressions are deny-wins and never reactivated by newer evidence", async () => {
  const harness = createHarness();
  const now = Date.now();
  await ingest(harness, "first", [
    outlet({ externalId: "outlet", capturedAt: iso(now - 120_000) }),
    contact({
      externalId: "first",
      outletExternalId: "outlet",
      fullName: "Allowed Contact",
      email: "allowed@example.com",
      instagramUrl: "https://www.instagram.com/deny.wins/",
      capturedAt: iso(now - 120_000)
    })
  ]);
  const blocked = harness.espo.byType.MediaContact[0];
  Object.assign(blocked, {
    status: "Blocked",
    doNotContact: true,
    optedOut: true,
    contactPurpose: "Blocked"
  });
  const validationCallsBefore = harness.providerCalls.length;
  await ingest(harness, "newer", [contact({
    externalId: "newer",
    outletExternalId: "outlet",
    fullName: "New Display Name",
    email: "replacement@example.com",
    instagramUrl: "https://instagram.com/deny.wins",
    capturedAt: iso(now - 60_000)
  })]);

  assert.equal(blocked.status, "Blocked");
  assert.equal(blocked.doNotContact, true);
  assert.equal(blocked.optedOut, true);
  assert.equal(blocked.contactPurpose, "Blocked");
  assert.equal(blocked.emailAddress, "allowed@example.com");
  assert.equal(harness.providerCalls.length, validationCallsBefore);
  assert.ok(harness.repository.fenceCalls > 0);
  assert.ok(harness.repository.renewCalls > 0);

  harness.repository.suppress("email", "suppressed@example.com");
  await ingest(harness, "suppressed", [contact({
    externalId: "suppressed",
    outletExternalId: "outlet",
    fullName: "Suppressed Contact",
    email: "suppressed@example.com",
    capturedAt: iso(now - 30_000)
  })]);
  const suppressed = harness.espo.byType.MediaContact.find(({ emailAddress }) => emailAddress === "suppressed@example.com");
  assert.equal(suppressed.status, "Blocked");
  assert.equal(suppressed.doNotContact, true);
  assert.equal(harness.providerCalls.length, validationCallsBefore);
});

test("only the newest verified evidence replaces canonical contact evidence", async () => {
  const harness = createHarness();
  const now = Date.now();
  const middle = now - 120_000;
  await ingest(harness, "middle", [
    outlet({ externalId: "outlet", capturedAt: iso(middle) }),
    contact({
      externalId: "middle",
      outletExternalId: "outlet",
      fullName: "Canonical Name",
      email: "canonical@example.com",
      capturedAt: iso(middle)
    })
  ]);
  const canonical = harness.espo.byType.MediaContact[0];

  await ingest(harness, "older", [contact({
    externalId: "older",
    outletExternalId: "outlet",
    fullName: "Older Verified Name",
    email: "canonical@example.com",
    capturedAt: iso(now - 180_000)
  })]);
  assert.equal(canonical.name, "Canonical Name");

  await ingest(harness, "unverified", [contact({
    externalId: "unverified",
    outletExternalId: "outlet",
    fullName: "Newer Unverified Name",
    email: "canonical@example.com",
    capturedAt: iso(now - 60_000),
    verified: false
  })]);
  assert.equal(canonical.name, "Canonical Name");

  await ingest(harness, "newest", [contact({
    externalId: "newest",
    outletExternalId: "outlet",
    fullName: "Newest Verified Name",
    email: "canonical@example.com",
    capturedAt: iso(now - 30_000)
  })]);
  assert.equal(canonical.name, "Newest Verified Name");
  assert.equal(canonical.proofCapturedAt, toEspo(iso(now - 30_000)));
});

test("an unsupported existing purpose cannot be mislabeled Ready for Matching", async () => {
  const harness = createHarness();
  const now = Date.now();
  await ingest(harness, "purpose-first", [
    outlet({ externalId: "outlet", capturedAt: iso(now - 60_000) }),
    contact({
      externalId: "purpose-first",
      outletExternalId: "outlet",
      fullName: "Bookings Desk",
      email: "bookings@example.com",
      capturedAt: iso(now - 60_000)
    })
  ]);
  const existing = harness.espo.byType.MediaContact[0];
  existing.contactPurpose = "Bookings Only";
  existing.status = "Active";
  await ingest(harness, "purpose-older", [contact({
    externalId: "purpose-older",
    outletExternalId: "outlet",
    fullName: "Bookings Desk",
    email: "bookings@example.com",
    capturedAt: iso(now - 120_000)
  })]);
  assert.equal(existing.contactPurpose, "Bookings Only");
  assert.equal(existing.emailValidationStatus, "Valid");
  assert.equal(existing.status, "Needs Validation");
});

function createHarness({ validationStatus = "Valid" } = {}) {
  const cryptoBox = {
    privacyHash(value) {
      return createHash("sha256").update(value).digest("hex");
    }
  };
  const repository = fakeRepository(cryptoBox);
  const espo = fakeEspo();
  const providerCalls = [];
  const service = createSourceIngestionService({
    espocrm: espo,
    repository,
    emailValidationProvider: {
      async validate(email, idempotencyKey) {
        providerCalls.push({ email, idempotencyKey });
        return {
          status: validationStatus,
          checkedAt: new Date().toISOString(),
          providerReference: `valid:${email}`,
          method: "http"
        };
      }
    },
    cryptoBox,
    config: {
      sourceIngestion: {
        maxArtifactAgeSeconds: 86_400,
        maxEvidenceAgeSeconds: 7_776_000,
        processingLeaseSeconds: 900
      },
      emailValidation: { cacheTtlDays: 30 }
    },
    logger: { info() {} },
    metrics: new Metrics()
  });
  return { service, repository, espo, providerCalls };
}

function fakeRepository(cryptoBox) {
  const links = new Map();
  const bindings = new Map();
  const claims = new Map();
  const suppressions = new Set();
  let claimSequence = 0;
  const repository = {
    abandonedClaims: 0,
    fenceCalls: 0,
    renewCalls: 0,
    async beginArtifact({ sourceId, artifactId }) {
      return {
        claimed: true,
        completed: false,
        lease: { sourceId, artifactId, leaseOwner: `lease:${artifactId}`, leaseVersion: 1 }
      };
    },
    async renewArtifactLease() { return true; },
    async completeArtifact() {},
    async failArtifact() { return true; },
    async beginIdentityResolution({ entityType, identities }) {
      const matched = identities.map((identity) => bindings.get(identityKey(entityType, identity))).filter(Boolean);
      const ids = new Set(matched.map(({ crmEntityId }) => crmEntityId));
      if (ids.size > 1) throw codedError("SOURCE_DEDUP_AMBIGUOUS", false);
      const claimId = `claim-${++claimSequence}`;
      const claim = { claimId, claimOwner: "unit-test", entityType };
      claims.set(claimId, { claim, identities });
      const verified = matched.filter(({ evidenceVerified }) => evidenceVerified);
      return {
        claimed: true,
        claim,
        boundCrmEntityId: ids.values().next().value,
        boundEvidence: matched.length ? {
          verified: verified.length > 0,
          verifiedAt: newest(verified.map(({ evidenceCapturedAt }) => evidenceCapturedAt)),
          latestAt: newest(matched.map(({ evidenceCapturedAt }) => evidenceCapturedAt))
        } : undefined
      };
    },
    async abandonIdentityResolution({ claimId }) {
      const deleted = claims.delete(claimId);
      if (deleted) repository.abandonedClaims += 1;
      return deleted;
    },
    async renewIdentityResolution({ claimId }) {
      repository.renewCalls += 1;
      return claims.has(claimId);
    },
    async linkRecord(record) {
      if (record.identityResolution) {
        const active = claims.get(record.identityResolution.claimId);
        if (!active) throw codedError("SOURCE_IDENTITY_CLAIM_LOST", true);
        const accepted = record.identityResolution.acceptedIdentities
          ?? (record.evidenceVerified ? active.identities : []);
        for (const identity of active.identities) {
          const key = identityKey(active.claim.entityType, identity);
          const current = bindings.get(key);
          if (current && current.crmEntityId !== record.crmEntityId) throw codedError("SOURCE_DEDUP_AMBIGUOUS", false);
        }
        for (const identity of accepted) {
          const key = identityKey(active.claim.entityType, identity);
          const current = bindings.get(key);
          const incomingAt = Date.parse(record.evidenceCapturedAt);
          const currentAt = Date.parse(current?.evidenceCapturedAt ?? "");
          if (!current || (record.evidenceVerified && (!current.evidenceVerified || incomingAt > currentAt))) {
            bindings.set(key, {
              crmEntityId: record.crmEntityId,
              evidenceCapturedAt: record.evidenceCapturedAt,
              evidenceVerified: Boolean(record.evidenceVerified)
            });
          }
        }
        claims.delete(record.identityResolution.claimId);
      }
      links.set(`${record.sourceId}:${record.externalId}:${record.entityType}`, record.crmEntityId);
    },
    async findLinkedEntity({ sourceId, externalId, entityType }) {
      return links.get(`${sourceId}:${externalId}:${entityType}`);
    },
    linked(sourceId, externalId, entityType) {
      return links.get(`${sourceId}:${externalId}:${entityType}`);
    },
    bindingCount(entityType) {
      return [...bindings.keys()].filter((key) => key.startsWith(`${entityType}:`)).length;
    },
    bindingTypes(entityType) {
      return [...new Set([...bindings.keys()]
        .filter((key) => key.startsWith(`${entityType}:`))
        .map((key) => key.split(":")[1]))].sort();
    },
    suppress(subjectType, subject) {
      suppressions.add(cryptoBox.privacyHash(`${subjectType}:${subject}`));
    },
    async hasActiveSuppression(checks) {
      return checks.some(({ subjectHash }) => suppressions.has(subjectHash));
    },
    async withSuppressionFence(_subjects, work) {
      repository.fenceCalls += 1;
      return work();
    },
    async getEmailValidation() { return undefined; },
    async putEmailValidation() {}
  };
  return repository;
}

function fakeEspo() {
  const byType = { MediaOutlet: [], MediaContact: [], MusicRelease: [] };
  const createCounts = { MediaOutlet: 0, MediaContact: 0, MusicRelease: 0 };
  const updateCalls = [];
  let sequence = 0;
  return {
    byType,
    createCounts,
    updateCalls,
    seed(entityType, record) { byType[entityType].push(record); },
    async findOne(entityType, attribute, value) {
      return this.findUniqueWhere(entityType, [{ type: "equals", attribute, value }]);
    },
    async findUniqueWhere(entityType, where) {
      const matches = byType[entityType].filter((record) => where.every((criterion) =>
        criterion.type === "equals" && record[criterion.attribute] === criterion.value
      ));
      if (matches.length > 1) throw codedError("ESPOCRM_UNIQUE_CONTRACT_VIOLATED", false);
      return matches[0];
    },
    async get(entityType, id) {
      return byType[entityType].find((record) => record.id === id);
    },
    async upsertByUnique(entityType, attribute, value, payload) {
      const existing = byType[entityType].find((record) => record[attribute] === value);
      if (existing) return this.updateConditional(entityType, existing.id, payload, existing.versionNumber);
      const created = { ...payload, id: `${entityType}-${++sequence}`, versionNumber: 1 };
      byType[entityType].push(created);
      createCounts[entityType] += 1;
      return created;
    },
    async updateConditional(entityType, id, payload, versionNumber) {
      const record = byType[entityType].find((candidate) => candidate.id === id);
      assert.equal(record.versionNumber, versionNumber);
      Object.assign(record, payload, { versionNumber: versionNumber + 1 });
      updateCalls.push({ entityType, id, payload });
      return record;
    }
  };
}

async function ingest(harness, artifactId, records) {
  const artifact = {
    schemaVersion: "1.0",
    sourceId: "dj-finder",
    artifactId,
    generatedAt: new Date().toISOString(),
    records
  };
  return harness.service.ingest({
    sourceId: artifact.sourceId,
    artifact,
    rawBody: Buffer.from(JSON.stringify(artifact))
  });
}

function outlet({
  externalId,
  capturedAt,
  submissionPolicy = "Explicit",
  acceptsEmail = true,
  acceptsForms = false,
  acceptsUnreleased = false
}) {
  return {
    kind: "mediaOutlet",
    externalId,
    name: "Example Radio",
    type: "Radio Station",
    website: "https://radio.example/",
    genres: ["Electronic"],
    submissionPolicy,
    acceptsEmail,
    acceptsForms,
    acceptsUnreleased,
    verified: true,
    evidence: {
      url: "https://radio.example/submissions",
      text: "The station explicitly accepts electronic music submissions.",
      capturedAt
    }
  };
}

function contact({
  externalId,
  outletExternalId,
  fullName,
  email,
  instagramUrl,
  showName,
  capturedAt,
  verified = true
}) {
  return {
    kind: "mediaContact",
    externalId,
    outletExternalId,
    fullName,
    email,
    role: "Music submissions",
    ...(instagramUrl ? { instagramUrl } : {}),
    ...(showName ? { showName } : {}),
    verified,
    purpose: "Explicit Music Submission",
    basis: "Explicit Submission Address",
    evidence: {
      url: "https://radio.example/submissions",
      text: "The station explicitly identifies this contact for music submissions.",
      capturedAt
    }
  };
}

function identityKey(entityType, identity) {
  return `${entityType}:${identity.type}:${identity.hash}`;
}

function newest(values) {
  return values.filter(Boolean).sort((left, right) => Date.parse(right) - Date.parse(left))[0];
}

function codedError(code, retryable) {
  return Object.assign(new Error(code), { code, retryable });
}

function verifiedEvidence(capturedAt) {
  return { verified: true, evidence: { capturedAt } };
}

function iso(value) {
  return new Date(value).toISOString();
}

function toEspo(value) {
  return new Date(value).toISOString().slice(0, 19).replace("T", " ");
}
