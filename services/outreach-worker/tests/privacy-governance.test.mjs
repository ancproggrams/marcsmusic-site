import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canonicalDigest,
  loadPrivacyPolicy,
  PRIVACY_DATA_CLASSES,
  requireEnabledPrivacyPolicy
} from "../src/domain/privacy-policy.mjs";
import { createPrivacyGovernanceService } from "../src/application/privacy-governance-service.mjs";
import { CryptoBox } from "../src/infrastructure/crypto-box.mjs";
import { loadPrivacyConfig } from "../src/privacy-config.mjs";

const PLAN_ID = "11111111-1111-4111-8111-111111111111";
const REQUEST_ID = "22222222-2222-4222-8222-222222222222";

test("retention policy is default-disabled and never invents a duration", () => {
  const absent = loadPrivacyPolicy({});
  assert.equal(absent.enabled, false);
  assert.equal(absent.configured, false);
  assert.equal(absent.retentionDays, undefined);
  assert.throws(() => requireEnabledPrivacyPolicy(absent), (error) => error.code === "PRIVACY_POLICY_DISABLED");

  assert.throws(
    () => loadPrivacyPolicy({ OUTREACH_RETENTION_POLICY_JSON: "{" }),
    (error) => error.code === "PRIVACY_POLICY_JSON_INVALID"
  );
  assert.throws(
    () => loadPrivacyPolicy({ OUTREACH_RETENTION_POLICY_JSON: JSON.stringify(policyInput({
      retentionDays: 31,
      minimumRetentionDays: 60,
      maximumRetentionDays: 120
    })) }),
    (error) => error.code === "PRIVACY_POLICY_INVALID"
  );
  const partialPolicy = policyInput();
  partialPolicy.dataClasses = { inbound_event_evidence: partialPolicy.dataClasses.inbound_event_evidence };
  assert.throws(
    () => loadPrivacyPolicy({ OUTREACH_RETENTION_POLICY_JSON: JSON.stringify(partialPolicy) }),
    (error) => error.code === "PRIVACY_POLICY_INVALID"
  );
  assert.throws(
    () => loadPrivacyPolicy({ OUTREACH_RETENTION_POLICY_JSON: JSON.stringify({
      ...policyInput(),
      dataClasses: { ...policyInput().dataClasses, invented_class: policyInput().dataClasses.inbound_event_evidence }
    }) }),
    (error) => error.code === "PRIVACY_POLICY_INVALID"
  );
  const explicitlyDisabled = loadPrivacyPolicy({ OUTREACH_RETENTION_POLICY_JSON: JSON.stringify({
    schemaVersion: 1,
    policyVersion: "privacy-policy-disabled-v1",
    enabled: false,
    approvedPolicyReference: "privacy-policy-approval-disabled",
    dataClasses: {}
  }) });
  assert.equal(explicitlyDisabled.enabled, false);
});

test("versioned policy digest is canonical and every duration stays inside its approved range", () => {
  const first = loadPrivacyPolicy({ OUTREACH_RETENTION_POLICY_JSON: JSON.stringify(policyInput()) });
  const reordered = {
    dataClasses: policyInput().dataClasses,
    approvedPolicyReference: "privacy-policy-approval-2026-01",
    enabled: true,
    policyVersion: "privacy-policy-v1",
    schemaVersion: 1
  };
  const second = loadPrivacyPolicy({ OUTREACH_RETENTION_POLICY_JSON: JSON.stringify(reordered) });
  assert.equal(first.digest, second.digest);
  assert.equal(first.dataClasses.inbound_event_evidence.retentionDays, 90);
  assert.equal(canonicalDigest({ b: 2, a: 1 }), canonicalDigest({ a: 1, b: 2 }));
});

test("retention execution binds the exact plan and approval identifiers and remains batched", async () => {
  let batches = 0;
  const repository = fakeRepository();
  repository.executeBatch = async (value) => {
    repository.calls.push(["batch", value]);
    batches += 1;
    return { processed: 1, remaining: batches === 1 ? 1 : 0, completed: batches === 2 };
  };
  const service = createPrivacyGovernanceService({
    repository,
    cryptoBox: fakeCrypto(),
    policy: loadPrivacyPolicy({ OUTREACH_RETENTION_POLICY_JSON: JSON.stringify(policyInput()) }),
    uuid: () => "33333333-3333-4333-8333-333333333333"
  });
  const result = await service.executeRetention({
    planId: PLAN_ID,
    expectedDigest: "a".repeat(64),
    approvalId: "approval-privacy-001",
    changeId: "change-privacy-001",
    recoveryId: "recovery-privacy-001",
    actorId: "privacy-owner-001",
    batchSize: 2,
    maxBatches: 4
  });
  assert.deepEqual(result, { completed: true, blocked: false, processed: 2, batches: 2 });
  assert.equal(repository.calls[0][0], "lease");
  assert.equal(repository.calls[1][0], "begin");
  assert.equal(repository.calls.filter(([name]) => name === "batch").length, 2);
  assert.equal(repository.calls[1][1].approvalId, "approval-privacy-001");

  await assert.rejects(
    () => service.executeRetention({
      planId: PLAN_ID,
      expectedDigest: "bad",
      approvalId: "approval-privacy-001",
      changeId: "change-privacy-001",
      recoveryId: "recovery-privacy-001",
      actorId: "privacy-owner-001"
    }),
    (error) => error.code === "PRIVACY_DIGEST_INVALID"
  );
});

test("legal holds and DSAR requests expose only keyed subject hashes to repository metadata", async () => {
  const repository = fakeRepository();
  const service = createPrivacyGovernanceService({
    repository,
    cryptoBox: fakeCrypto(),
    policy: loadPrivacyPolicy({ OUTREACH_RETENTION_POLICY_JSON: JSON.stringify(policyInput()) }),
    uuid: () => REQUEST_ID
  });
  await service.createLegalHold({
    subjectType: "email",
    subject: "Person@Example.com",
    scopeDataClass: "inbound_event_evidence",
    caseReference: "legal-case-001",
    evidence: { reason: "restricted" },
    actorId: "privacy-owner-001"
  });
  const hold = repository.calls.find(([name]) => name === "hold")[1];
  assert.equal(hold.subjectHash, "hash:email:person@example.com");
  assert.equal(JSON.stringify(hold).includes("Person@Example.com"), false);

  const created = await service.createDsarRequest({
    requestType: "correction",
    subjectType: "contact",
    subject: "crm-contact-42",
    requestReference: "dsar-request-001",
    evidence: { channel: "verified-portal" },
    requestedCorrection: { field: "name" },
    espoMutations: [{
      entityType: "MediaContact",
      entityId: "crm-contact-42",
      expectedVersion: 7,
      mutationType: "correction",
      patch: { name: "Corrected" }
    }],
    actorId: "privacy-owner-001"
  });
  assert.equal(created.requestId, REQUEST_ID);
  const request = repository.calls.find(([name]) => name === "dsar")[1];
  assert.equal(request.subjectHash, "hash:contact:crm-contact-42");
  assert.equal(Object.hasOwn(request, "subject"), false);
  assert.equal(request.payload.subject.value, "crm-contact-42");
});

test("Espo mutation plans reject unrelated entity types, arbitrary fields and unsafe erasure values", async () => {
  const service = createPrivacyGovernanceService({
    repository: fakeRepository(),
    cryptoBox: fakeCrypto(),
    policy: loadPrivacyPolicy({ OUTREACH_RETENTION_POLICY_JSON: JSON.stringify(policyInput()) }),
    uuid: () => REQUEST_ID
  });
  const request = (mutation, requestType = "correction") => service.createDsarRequest({
    requestType,
    subjectType: "contact",
    subject: "crm-contact-42",
    requestReference: `dsar-adversarial-${requestType}`,
    evidence: {},
    espoMutations: [mutation],
    actorId: "privacy-owner-001"
  });
  await assert.rejects(
    () => request({ entityType: "MusicRelease", entityId: "release-1", expectedVersion: 1, patch: { name: "x" } }),
    (error) => error.code === "PRIVACY_ESPO_PLAN_INVALID"
  );
  await assert.rejects(
    () => request({ entityType: "MediaContact", entityId: "crm-contact-42", expectedVersion: 1, patch: { apiKey: "exfiltrate" } }),
    (error) => error.code === "PRIVACY_ESPO_FIELD_NOT_ALLOWED"
  );
  await assert.rejects(
    () => request({
      entityType: "MediaContact", entityId: "crm-contact-42", expectedVersion: 1,
      mutationType: "erasure_anonymization", patch: { name: "attacker-controlled" }
    }, "erasure"),
    (error) => error.code === "PRIVACY_ESPO_ERASURE_VALUE_INVALID"
  );
});

test("subject HMAC normalization is isolated from byte-exact versioned integrity MAC", () => {
  const cryptoBox = new CryptoBox({
    encryptionKey: Buffer.alloc(32, 9),
    keyVersion: "v1",
    hashKey: "privacy-hash-key-with-at-least-32-characters"
  });
  assert.equal(cryptoBox.subjectHash(" Person@Example.test "), cryptoBox.subjectHash("person@example.test"));
  assert.notEqual(cryptoBox.integrityHash("Value"), cryptoBox.integrityHash("value"));
  assert.notEqual(cryptoBox.integrityHash("value"), cryptoBox.integrityHash(" value "));
  assert.equal(cryptoBox.integrityMac("Value").version, "hmac-sha256-exact-v1");
});

test("privacy runtime configuration requires no Espo, Mailgun or source credentials", () => {
  const config = loadPrivacyConfig({
    DATABASE_URL: "postgres://privacy-only",
    OUTREACH_DATA_ENCRYPTION_KEY: Buffer.alloc(32, 5).toString("base64"),
    OUTREACH_DATA_KEY_VERSION: "v1",
    OUTREACH_DATA_DECRYPTION_KEYS_JSON: "{}",
    OUTREACH_HASH_KEY: "privacy-hash-key-with-at-least-32-characters",
    ESPOCRM_API_KEY: "must-not-leak",
    MAILGUN_API_KEY: "must-not-leak"
  });
  assert.deepEqual(Object.keys(config).sort(), ["crypto", "database"]);
  assert.equal(JSON.stringify(config).includes("must-not-leak"), false);
});

function policyInput(overrides = {}) {
  const classPolicy = {
    retentionDays: 90,
    minimumRetentionDays: 30,
    maximumRetentionDays: 180,
    batchSize: 25,
    maximumRecordsPerPlan: 5_000
  };
  return {
    schemaVersion: 1,
    policyVersion: "privacy-policy-v1",
    enabled: true,
    approvedPolicyReference: "privacy-policy-approval-2026-01",
    dataClasses: Object.fromEntries(PRIVACY_DATA_CLASSES.map((dataClass) => [dataClass, {
      ...classPolicy,
      ...(dataClass === "inbound_event_evidence" ? overrides : {})
    }]))
  };
}

function fakeCrypto() {
  return { privacyHash: (value) => `hash:${String(value).toLowerCase()}` };
}

function fakeRepository(overrides = {}) {
  const calls = [];
  return {
    calls,
    async createRetentionPlan(value) { calls.push(["plan", value]); return { planId: PLAN_ID }; },
    async acquireExecutionLease(value) {
      calls.push(["lease", value]);
      return { leaseName: "privacy", ownerId: value.ownerId, fenceToken: 1, planId: value.planId };
    },
    async beginExecution(value) { calls.push(["begin", value]); return { completed: false, blocked: false }; },
    async executeBatch(value) { calls.push(["batch", value]); return { processed: 0, remaining: 0, completed: true }; },
    async markExecutionFailed(value) { calls.push(["failed", value]); return true; },
    async createLegalHold(value) { calls.push(["hold", value]); return { holdId: PLAN_ID }; },
    async releaseLegalHold(value) { calls.push(["release", value]); return { released: true }; },
    async createDsarRequest(value) { calls.push(["dsar", value]); return { requestId: value.requestId }; },
    async planDsarRequest(value) { calls.push(["dsar-plan", value]); return { requestId: value.requestId }; },
    ...overrides
  };
}
