import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { createContactIntakeService } from "../src/application/contact-intake-service.mjs";
import { EVIDENCE_ATTESTATION_VERSION } from "../src/domain/evidence-policy.mjs";
import { Metrics } from "../src/infrastructure/metrics.mjs";

const logger = Object.freeze({ info() {}, warn() {}, error() {} });

test("direct CRM contact intake validates its outlet first and exposes only fully attested Ready records", async () => {
  const capturedAt = new Date().toISOString();
  const fixture = createFixture({
    outlets: [validOutlet({ capturedAt })],
    contacts: [validContact({ capturedAt })]
  });

  const result = await fixture.service.processContact("contact-1", { now: new Date(capturedAt) });

  assert.equal(result.canonicalId, "contact-1");
  assert.equal(result.record.status, "Ready for Matching");
  assert.equal(result.record.emailValidationStatus, "Valid");
  assert.equal(result.attested, true);
  assert.equal(result.attestation.status, "active");
  assert.equal(result.attestation.originCompleted, true);
  assert.equal(result.attestation.digestVersion, EVIDENCE_ATTESTATION_VERSION);
  assert.equal(fixture.validationCalls.length, 1);
  assert.equal(fixture.validationCalls[0].email, "music@radio.example");
  assert.deepEqual(fixture.workflow.enqueued.map(({ kind, entityId }) => ({ kind, entityId })), [
    { kind: "match_contact", entityId: "contact-1" }
  ]);
  assert.equal(fixture.workflow.suppressions.length, 0);
  assert.equal(fixture.crm.record("MediaOutlet", "outlet-1").activityStatus, "Active");
});

test("unverified direct CRM evidence remains Needs Validation and never invokes email validation", async () => {
  const capturedAt = new Date().toISOString();
  const fixture = createFixture({
    outlets: [validOutlet({ capturedAt })],
    contacts: [validContact({
      capturedAt,
      contactEvidence: "A general directory entry with no submission destination."
    })]
  });

  const result = await fixture.service.processContact("contact-1", { now: new Date(capturedAt) });

  assert.equal(result.record.status, "Needs Validation");
  assert.equal(result.attested, false);
  assert.equal(result.attestation.status, "invalid");
  assert.equal(fixture.validationCalls.length, 0);
  assert.equal(fixture.workflow.enqueued.length, 1, "held contacts still re-enter matching through its hard eligibility gate");
});

test("same-domain outlet duplicates converge on the oldest canonical and no-submissions evidence denies every alias", async () => {
  const capturedAt = new Date().toISOString();
  const canonical = validOutlet({
    id: "outlet-old",
    capturedAt,
    createdAt: "2026-01-01T00:00:00.000Z"
  });
  const deniedDuplicate = validOutlet({
    id: "outlet-new",
    capturedAt,
    createdAt: "2026-02-01T00:00:00.000Z",
    submissionPolicy: "No Submissions",
    submissionEvidence: "No music submissions accepted. Please do not send demos."
  });
  const fixture = createFixture({ outlets: [canonical, deniedDuplicate], contacts: [] });

  const result = await fixture.service.processOutlet("outlet-new", { now: new Date(capturedAt) });

  assert.equal(result.canonicalId, "outlet-old");
  assert.equal(result.duplicateCount, 1);
  assert.equal(result.denied, true);
  assert.equal(result.attested, false);
  assert.equal(result.attestation.status, "revoked");
  const canonicalAfter = fixture.crm.record("MediaOutlet", "outlet-old");
  assert.equal(canonicalAfter.activityStatus, "Blocked");
  assert.equal(canonicalAfter.submissionPolicy, "No Submissions");
  assert.equal(canonicalAfter.acceptsEmail, false);
  const duplicateAfter = fixture.crm.record("MediaOutlet", "outlet-new");
  assert.equal(duplicateAfter.activityStatus, "Inactive");
  assert.equal(duplicateAfter.normalizedDomain, null);
  assert.ok(fixture.workflow.suppressions.some(({ subjectType, subject }) =>
    subjectType === "outlet" && subject === "outlet-old"
  ));
  assert.ok(fixture.workflow.suppressions.some(({ subjectType, subject }) =>
    subjectType === "domain" && subject === "radio.example"
  ));
});

function createFixture({ outlets, contacts }) {
  const crm = new MemoryEspo({ MediaOutlet: outlets, MediaContact: contacts });
  const intakeRepository = new MemoryIntakeRepository();
  const workflow = {
    enqueued: [],
    suppressions: [],
    async enqueueWork(value) { this.enqueued.push(structuredClone(value)); },
    async suppress(value) { this.suppressions.push(structuredClone(value)); }
  };
  const validationCalls = [];
  const service = createContactIntakeService({
    espocrm: crm,
    intakeRepository,
    workflowRepository: workflow,
    emailValidationProvider: {
      async validate(email, idempotencyKey) {
        validationCalls.push({ email, idempotencyKey });
        return {
          status: "Valid",
          checkedAt: new Date().toISOString(),
          providerReference: "unit-email-validation",
          method: "http"
        };
      }
    },
    cryptoBox: {
      privacyHash(value) { return createHash("sha256").update(value).digest("hex"); }
    },
    config: {
      sourceIngestion: { processingLeaseSeconds: 120, maxEvidenceAgeSeconds: 7_776_000 },
      emailValidation: { cacheTtlDays: 30 }
    },
    logger,
    metrics: new Metrics()
  });
  return { service, crm, intakeRepository, workflow, validationCalls };
}

function validOutlet(overrides = {}) {
  const capturedAt = overrides.capturedAt ?? new Date().toISOString();
  return {
    id: overrides.id ?? "outlet-1",
    versionNumber: 1,
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
    modifiedAt: capturedAt,
    name: "Example Radio",
    type: "Online",
    website: "https://radio.example",
    normalizedDomain: "radio.example",
    country: "NL",
    language: "en",
    timezone: "Europe/Amsterdam",
    genres: ["Indie"],
    subGenres: [],
    formatGenres: ["Indie"],
    submissionPolicy: "Explicit",
    submissionUrl: "https://radio.example/submissions",
    sourceUrl: "https://radio.example/submissions",
    submissionEvidence: "The station accepts music submissions by email.",
    acceptsEmail: true,
    acceptsForms: false,
    acceptsUnreleased: true,
    activityStatus: "New",
    lastValidatedAt: capturedAt,
    qualityScore: 80,
    ...overrides
  };
}

function validContact(overrides = {}) {
  const capturedAt = overrides.capturedAt ?? new Date().toISOString();
  return {
    id: "contact-1",
    versionNumber: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    modifiedAt: capturedAt,
    name: "Sam Editor",
    firstName: "Sam",
    lastName: "Editor",
    emailAddress: "music@radio.example",
    role: "Music Editor",
    preferredLanguage: "en",
    timezone: "Europe/Amsterdam",
    mediaOutletId: "outlet-1",
    contactSourceUrl: "https://radio.example/submissions",
    contactEvidence: "The station publishes this address for music submissions.",
    contactPurpose: "Explicit Music Submission",
    contactBasis: "Explicit Submission Address",
    proofCapturedAt: capturedAt,
    emailValidationStatus: "Unknown",
    status: "New",
    doNotContact: false,
    optedOut: false,
    hardBounced: false,
    ...overrides
  };
}

class MemoryEspo {
  constructor(seed) {
    this.records = new Map();
    for (const [entityType, records] of Object.entries(seed)) {
      for (const record of records) this.records.set(`${entityType}:${record.id}`, structuredClone(record));
    }
  }

  record(entityType, id) {
    return structuredClone(this.records.get(`${entityType}:${id}`));
  }

  async get(entityType, id) {
    const record = this.records.get(`${entityType}:${id}`);
    if (!record) throw Object.assign(new Error(`missing ${entityType}/${id}`), { statusCode: 404 });
    return structuredClone(record);
  }

  async list(entityType, { where = [], maxRecords }) {
    return [...this.records.entries()]
      .filter(([key]) => key.startsWith(`${entityType}:`))
      .map(([, record]) => record)
      .filter((record) => where.every(({ type, attribute, value }) => type === "equals" && record[attribute] === value))
      .slice(0, maxRecords)
      .map((record) => structuredClone(record));
  }

  async updateConditional(entityType, id, patch, versionNumber) {
    const key = `${entityType}:${id}`;
    const current = this.records.get(key);
    if (!current || current.versionNumber !== versionNumber) {
      throw Object.assign(new Error("version conflict"), { statusCode: 409, code: "ESPOCRM_VERSION_CONFLICT" });
    }
    const updated = { ...current, ...structuredClone(patch), versionNumber: versionNumber + 1 };
    this.records.set(key, updated);
    return structuredClone(updated);
  }
}

class MemoryIntakeRepository {
  constructor() {
    this.receipts = new Map();
    this.attestations = new Map();
    this.identityBindings = new Map();
    this.validation = new Map();
    this.claimCounter = 0;
  }

  async withEntityFence(_entityType, _entityId, work) { return work(); }

  async beginIntake({ entityType, entityId, revisionDigest }) {
    const key = `${entityType}:${entityId}:${revisionDigest}`;
    const current = this.receipts.get(key);
    if (current?.status === "completed") {
      return { claimed: false, completed: true, result: structuredClone(current.result) };
    }
    if (current?.status === "processing") return { claimed: false, completed: false, inProgress: true };
    const lease = { entityType, entityId, revisionDigest, leaseOwner: `lease-${key}`, leaseVersion: 1 };
    this.receipts.set(key, { status: "processing", lease });
    return { claimed: true, completed: false, lease };
  }

  async renewIntakeLease() { return true; }

  async completeIntake(lease, result) {
    const key = `${lease.entityType}:${lease.entityId}:${lease.revisionDigest}`;
    this.receipts.set(key, { status: "completed", result: structuredClone(result) });
  }

  async failIntake(lease, code) {
    const key = `${lease.entityType}:${lease.entityId}:${lease.revisionDigest}`;
    this.receipts.set(key, { status: "failed", code });
    return true;
  }

  async beginIdentityResolution({ entityType, identities }) {
    const boundIds = new Set(identities.map((identity) =>
      this.identityBindings.get(`${entityType}:${identity.type}:${identity.hash}`)
    ).filter(Boolean));
    if (boundIds.size > 1) throw Object.assign(new Error("ambiguous identity"), { code: "SOURCE_DEDUP_AMBIGUOUS" });
    this.claimCounter += 1;
    return {
      claimed: true,
      boundCrmEntityId: [...boundIds][0],
      claim: {
        claimId: `claim-${this.claimCounter}`,
        claimOwner: `owner-${this.claimCounter}`,
        entityType,
        identities: structuredClone(identities)
      }
    };
  }

  async renewIdentityResolution() { return true; }

  async completeIdentityResolution({ entityType, crmEntityId, acceptedIdentities = [] }) {
    for (const identity of acceptedIdentities) {
      this.identityBindings.set(`${entityType}:${identity.type}:${identity.hash}`, crmEntityId);
    }
  }

  async abandonIdentityResolution() { return true; }

  async withSuppressionFence(_subjects, work) { return work(); }

  async hasActiveSuppression() { return false; }

  async getEmailValidation(recipientHash) { return this.validation.get(recipientHash); }

  async putEmailValidation({ recipientHash, ...result }) { this.validation.set(recipientHash, result); }

  async putEvidenceAttestation({ evaluation, origin }) {
    const attestation = {
      ...evaluation.attestation,
      evidenceDigest: evaluation.digest,
      status: "active",
      sourceKind: origin.sourceKind,
      originCompleted: true
    };
    this.attestations.set(`${evaluation.attestation.entityType}:${evaluation.attestation.entityId}`, attestation);
    return true;
  }

  async invalidateEvidenceAttestation({ entityType, entityId, entityVersion, revisionDigest, reason, capturedAt = new Date() }) {
    this.attestations.set(`${entityType}:${entityId}`, terminalAttestation({
      entityType, entityId, entityVersion, revisionDigest, reason, capturedAt, status: "invalid"
    }));
  }

  async revokeEvidenceAttestation({ entityType, entityId, entityVersion, revisionDigest, reason, capturedAt = new Date() }) {
    this.attestations.set(`${entityType}:${entityId}`, terminalAttestation({
      entityType, entityId, entityVersion, revisionDigest, reason, capturedAt, status: "revoked"
    }));
  }

  async getEvidenceAttestation(entityType, entityId) {
    const value = this.attestations.get(`${entityType}:${entityId}`);
    return value ? structuredClone(value) : undefined;
  }
}

function terminalAttestation({ entityType, entityId, entityVersion, revisionDigest, reason, capturedAt, status }) {
  return {
    entityType,
    entityId,
    entityVersion,
    digestVersion: EVIDENCE_ATTESTATION_VERSION,
    evidenceDigest: revisionDigest,
    evidenceCapturedAt: new Date(capturedAt).toISOString(),
    purpose: status === "revoked" ? "Blocked" : "Unknown",
    basis: status === "revoked" ? "Blocked" : "Unknown",
    sourceKind: "direct_crm",
    status,
    revocationReason: reason,
    originCompleted: false
  };
}
