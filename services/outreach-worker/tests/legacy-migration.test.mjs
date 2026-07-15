import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  acquireVerifiedLegacySnapshot,
  analyzeLegacyLeads,
  applyLegacyMigration,
  assertApprovedLegacyReport,
  assertLegacyCanaryGate,
  calculateLegacyReportDigest,
  LEGACY_CANARY_ENVIRONMENT,
  LEGACY_MIGRATION_VERSION
} from "../src/application/legacy-lead-migration.mjs";

const VALID_DESCRIPTION = [
  "Station: Radio Example",
  "Website: https://radio.example.test/program?utm_source=legacy",
  "Proof URL: https://radio.example.test/music-submissions",
  "Proof Text: We accept music submissions at this address.",
  "Verification Status: verified",
  "Language: en"
].join("\n");

test("legacy dry-run deduplication and its approval digest are deterministic", () => {
  const older = {
    id: "lead-old",
    name: "Radio Example",
    firstName: "Old",
    emailAddress: " Promo@Radio.Example.Test ",
    description: VALID_DESCRIPTION,
    modifiedAt: "2026-07-01 10:00:00"
  };
  const newer = {
    id: "lead-new",
    name: "Radio Example",
    firstName: "Canonical",
    emailAddress: "promo@radio.example.test",
    description: VALID_DESCRIPTION,
    modifiedAt: "2026-07-02 10:00:00"
  };

  const forward = analyzeLegacyLeads([older, newer]);
  const reverse = analyzeLegacyLeads([newer, older]);

  assert.equal(forward.report.sourceTotal, 2);
  assert.equal(forward.report.candidateContacts, 1);
  assert.equal(forward.report.candidateOutlets, 1);
  assert.equal(forward.report.duplicateRows, 1);
  assert.equal(forward.report.invalidOrMissingEmail, 0);
  assert.equal(forward.report.applyAllowed, true);
  assert.equal(forward.report.sourceDigest, reverse.report.sourceDigest);
  assert.equal(forward.report.reportDigest, reverse.report.reportDigest);
  assert.equal(forward.report.snapshot.ordering, "modifiedAt ASC, id ASC");
  assert.equal(forward.report.reconciliation.sourceRows.balanced, true);
  assert.equal(forward.report.reconciliation.contactOutcomes.balanced, true);
  assert.equal(forward.report.reconciliation.campaignHistory.balanced, true);
  assert.deepEqual(forward.report.categoryCounts.blockReasons, reverse.report.categoryCounts.blockReasons);
  assert.equal(forward.contacts[0].firstName, "Canonical");
  assert.equal(reverse.contacts[0].firstName, "Canonical");
  assert.equal(forward.contacts[0].email, "promo@radio.example.test");
  assert.equal(forward.contacts[0].contactBasis, "Explicit Submission Address");
  assert.equal(forward.contacts[0].blockReasons.length, 0);
});

test("snapshot acquisition reads both legacy sources twice and rejects drift", async () => {
  const calls = [];
  const stableEspo = {
    async *iterate(entityType) {
      calls.push(entityType);
      yield entityType === "Lead" ? [{
        id: "stable-lead",
        emailAddress: "stable@radio.example.test",
        description: VALID_DESCRIPTION,
        modifiedAt: "2026-07-01 10:00:00"
      }] : [];
    }
  };
  const analysis = await acquireVerifiedLegacySnapshot(stableEspo);
  assert.equal(analysis.report.sourceTotal, 1);
  assert.deepEqual(calls, ["Lead", "CampaignLogRecord", "Lead", "CampaignLogRecord"]);

  let leadRead = 0;
  const driftingEspo = {
    async *iterate(entityType) {
      if (entityType === "CampaignLogRecord") {
        yield [];
        return;
      }
      leadRead += 1;
      yield [{
        id: "drifting-lead",
        firstName: leadRead === 1 ? "Before" : "After",
        emailAddress: "drift@radio.example.test",
        description: VALID_DESCRIPTION,
        modifiedAt: "2026-07-01 10:00:00"
      }];
    }
  };
  await assert.rejects(
    () => acquireVerifiedLegacySnapshot(driftingEspo),
    (error) => error.code === "LEGACY_MIGRATION_UNSTABLE_SNAPSHOT"
  );
});

test("legacy migration canary requires staging, both send locks, explicit digests, and at most five contacts", () => {
  const analysis = analyzeLegacyLeads([{
    id: "lead-canary",
    emailAddress: "canary@radio.example.test",
    description: VALID_DESCRIPTION,
    modifiedAt: "2026-07-01 10:00:00"
  }]);
  const report = structuredClone(analysis.report);
  report.approval.approved = true;
  report.approval.approvedBy = "CHANGE-123/privacy-owner";
  report.approval.approvedAt = "2026-07-15T10:00:00.000Z";
  const gate = {
    report,
    expectedSourceDigest: report.sourceDigest,
    expectedReportDigest: report.reportDigest,
    environmentName: LEGACY_CANARY_ENVIRONMENT,
    killSwitch: "true",
    sendEnabled: "false",
    limit: 5
  };
  assert.equal(assertLegacyCanaryGate(gate), true);
  assert.throws(() => assertLegacyCanaryGate({ ...gate, environmentName: "production" }), /restricted to outreach-staging/u);
  assert.throws(() => assertLegacyCanaryGate({ ...gate, killSwitch: "false" }), /requires OUTREACH_KILL_SWITCH/u);
  assert.throws(() => assertLegacyCanaryGate({ ...gate, expectedReportDigest: "0".repeat(64) }), /do not match/u);
  assert.throws(() => assertLegacyCanaryGate({ ...gate, limit: 6 }), /between 1 and 5/u);
});

test("unknown legacy contact basis is blocked in analysis and remains non-contactable on apply", async () => {
  const analysis = analyzeLegacyLeads([{
    id: "lead-unknown",
    name: "Editorial Desk",
    emailAddress: "desk@unknown.example.test",
    description: [
      "Outlet: Editorial Desk",
      "Website: https://unknown.example.test",
      "Proof URL: https://unknown.example.test/contact",
      "Proof Text: General editorial contact address.",
      "Verification Status: valid"
    ].join("\n"),
    modifiedAt: "2026-07-03 10:00:00"
  }]);

  assert.equal(analysis.report.automaticEligibilityBlocked, 1);
  assert.equal(analysis.contacts[0].contactPurpose, "Unknown");
  assert.equal(analysis.contacts[0].contactBasis, "Unknown");
  assert.deepEqual(analysis.contacts[0].blockReasons, ["contact_basis_unknown", "contact_purpose_unknown"]);

  const upserts = [];
  const espocrm = {
    async upsertByUnique(entityType, uniqueField, uniqueValue, payload) {
      upserts.push({ entityType, uniqueField, uniqueValue, payload });
      return { id: entityType === "MediaOutlet" ? "outlet-1" : "contact-1" };
    }
  };
  const result = await applyLegacyMigration({
    analysis,
    espocrm,
    logger: { info() {} }
  });

  assert.equal(result.outletsUpserted, 1);
  assert.equal(result.contactsUpserted, 1);
  assert.equal(result.eventsUpserted, 0);
  assert.equal(result.completedOperations, 2);
  const contact = upserts.find(({ entityType }) => entityType === "MediaContact");
  assert.ok(contact);
  assert.equal(contact.payload.contactBasis, "Unknown");
  assert.equal(contact.payload.contactPurpose, "Unknown");
  assert.equal(contact.payload.doNotContact, true);
  assert.equal(contact.payload.status, "Needs Validation");
});

test("legacy quarantine does not create a permanent suppression without negative history", async () => {
  const analysis = analyzeLegacyLeads([{
    id: "lead-safe-but-quarantined",
    name: "Radio Example",
    emailAddress: "promo@radio.example.test",
    description: VALID_DESCRIPTION,
    modifiedAt: "2026-07-03 10:00:00"
  }], [{
    id: "campaign-log-1",
    targetId: "lead-safe-but-quarantined",
    targetType: "Lead",
    action: "Sent",
    modifiedAt: "2026-07-04 10:00:00"
  }]);
  let suppressions = 0;
  const espocrm = fakeEspo();
  await applyLegacyMigration({
    analysis,
    espocrm,
    repository: { async suppress() { suppressions += 1; } },
    logger: { info() {} }
  });

  assert.equal(analysis.contacts[0].priorSend, true);
  assert.equal(analysis.contacts[0].historicNegativeType, undefined);
  assert.equal(suppressions, 0);
  assert.equal(espocrm.records.find((record) => record.entityType === "MediaContact").payload.doNotContact, true);
});

test("legacy hard bounce becomes a deny-wins permanent suppression", async () => {
  const analysis = analyzeLegacyLeads([{
    id: "lead-bounced",
    name: "Radio Example",
    emailAddress: "bounce@radio.example.test",
    description: VALID_DESCRIPTION,
    modifiedAt: "2026-07-03 10:00:00"
  }], [{
    id: "campaign-log-2",
    targetId: "lead-bounced",
    targetType: "Lead",
    action: "Hard Bounced",
    modifiedAt: "2026-07-04 10:00:00"
  }]);
  const suppressions = [];
  const espocrm = fakeEspo();
  await applyLegacyMigration({
    analysis,
    espocrm,
    repository: {
      async suppress(value) {
        suppressions.push(value);
        return "suppression-hash";
      }
    },
    logger: { info() {} }
  });

  assert.equal(analysis.contacts[0].historicNegativeType, "hard_bounce");
  assert.deepEqual(suppressions, [{
    subjectType: "contact",
    subject: "contact-1",
    reason: "hard_bounce",
    source: LEGACY_MIGRATION_VERSION
  }]);
  const contact = espocrm.records.find((record) => record.entityType === "MediaContact");
  const suppression = espocrm.records.find((record) => record.entityType === "OutreachSuppression");
  assert.equal(contact.payload.hardBounced, true);
  assert.equal(suppression.payload.active, true);
  assert.equal(suppression.payload.subjectHash, "suppression-hash");
  const event = espocrm.records.find((record) => record.entityType === "OutreachEvent");
  assert.equal(event.payload.eventType, "Hard Bounced");
  assert.equal(event.payload.mediaContactId, "contact-1");
  assert.equal("outreachMatchId" in event.payload, false);
});

test("approval is explicit, digest-bound, and refuses a changed source snapshot", () => {
  const original = analyzeLegacyLeads([{
    id: "lead-approval",
    name: "Radio Example",
    firstName: "Before",
    emailAddress: "approval@radio.example.test",
    description: VALID_DESCRIPTION,
    modifiedAt: "2026-07-03 10:00:00"
  }]);
  const approved = structuredClone(original.report);
  approved.approval.approved = true;
  approved.approval.approvedBy = "migration-owner";
  approved.approval.approvedAt = "2026-07-15T10:00:00.000Z";

  assert.equal(calculateLegacyReportDigest(approved), approved.reportDigest);
  assert.equal(assertApprovedLegacyReport(approved, original.report), true);

  const tampered = structuredClone(approved);
  tampered.categoryCounts.sourceRows.canonicalContacts = 99;
  assert.throws(() => assertApprovedLegacyReport(tampered, original.report), /contents changed/u);

  const changed = analyzeLegacyLeads([{
    id: "lead-approval",
    name: "Radio Example",
    firstName: "After",
    emailAddress: "approval@radio.example.test",
    description: VALID_DESCRIPTION,
    modifiedAt: "2026-07-03 10:00:00"
  }]);
  assert.notEqual(changed.report.sourceDigest, original.report.sourceDigest);
  assert.throws(() => assertApprovedLegacyReport(approved, changed.report), /snapshot changed/u);
});

test("dry-run exposes balanced reconciliation, conflict counts, and only redacted samples", () => {
  const analysis = analyzeLegacyLeads([{
    id: "lead-a",
    firstName: "Alice",
    emailAddress: "private@radio.example.test",
    description: VALID_DESCRIPTION,
    modifiedAt: "2026-07-01 10:00:00"
  }, {
    id: "lead-b",
    firstName: "Bob",
    emailAddress: "private@radio.example.test",
    description: VALID_DESCRIPTION,
    modifiedAt: "2026-07-02 10:00:00"
  }, {
    id: "lead-invalid",
    name: "No Address",
    description: "Website: https://invalid.example.test",
    modifiedAt: "2026-07-03 10:00:00"
  }], [{
    id: "history-importable",
    targetId: "lead-a",
    targetType: "Lead",
    action: "Delivered",
    createdAt: "2026-07-04 10:00:00"
  }, {
    id: "history-unsupported",
    targetId: "lead-a",
    targetType: "Lead",
    action: "Campaign Created",
    createdAt: "2026-07-04 11:00:00"
  }, {
    id: "history-unlinked",
    targetId: "does-not-exist",
    targetType: "Lead",
    action: "Sent",
    createdAt: "2026-07-04 12:00:00"
  }]);

  assert.equal(analysis.report.reconciliation.sourceRows.left, 3);
  assert.equal(analysis.report.reconciliation.sourceRows.right, 3);
  assert.equal(analysis.report.reconciliation.campaignHistory.left, 3);
  assert.equal(analysis.report.reconciliation.campaignHistory.right, 3);
  assert.equal(analysis.report.fieldConflicts.groupsWithConflicts, 1);
  assert.equal(analysis.report.fieldConflicts.byField.firstName, 1);
  assert.equal(analysis.report.categoryCounts.campaignHistory.importableEvents, 1);
  assert.equal(analysis.report.categoryCounts.campaignHistory.unsupportedActionRows, 1);
  assert.equal(analysis.report.categoryCounts.campaignHistory.unlinkedTargetRows, 1);
  const serialized = JSON.stringify(analysis.report);
  assert.equal(serialized.includes("private@radio.example.test"), false);
  assert.equal(serialized.includes("Alice"), false);
  assert.equal(serialized.includes("Bob"), false);
});

test("same campaign identity with conflicting facts blocks apply without breaking reconciliation", () => {
  const analysis = analyzeLegacyLeads([{
    id: "lead-conflict",
    emailAddress: "conflict@radio.example.test",
    description: VALID_DESCRIPTION,
    modifiedAt: "2026-07-01 10:00:00"
  }], [{
    id: "same-history-id",
    targetId: "lead-conflict",
    targetType: "Lead",
    action: "Sent",
    createdAt: "2026-07-02 10:00:00"
  }, {
    id: "same-history-id",
    targetId: "lead-conflict",
    targetType: "Lead",
    action: "Delivered",
    createdAt: "2026-07-02 11:00:00"
  }]);

  assert.equal(analysis.report.categoryCounts.campaignHistory.importableEvents, 1);
  assert.equal(analysis.report.categoryCounts.campaignHistory.duplicateEventRows, 1);
  assert.equal(analysis.report.categoryCounts.campaignHistory.identityConflictRows, 1);
  assert.equal(analysis.report.reconciliation.campaignHistory.balanced, true);
  assert.equal(analysis.report.applyAllowed, false);
});

test("soft bounce is imported and quarantined but never becomes a permanent suppression", async () => {
  const analysis = analyzeLegacyLeads([{
    id: "lead-soft-bounce",
    emailAddress: "soft@radio.example.test",
    description: VALID_DESCRIPTION,
    modifiedAt: "2026-07-01 10:00:00"
  }], [{
    id: "soft-bounce-history",
    targetId: "lead-soft-bounce",
    targetType: "Lead",
    action: "Soft Bounced",
    createdAt: "2026-07-02 10:00:00"
  }]);
  let suppressionCalls = 0;
  const espocrm = fakeEspo();
  const result = await applyLegacyMigration({
    analysis,
    espocrm,
    repository: { async suppress() { suppressionCalls += 1; } },
    logger: { info() {} }
  });

  assert.equal(analysis.contacts[0].priorSend, true);
  assert.equal(analysis.contacts[0].historicNegative, false);
  assert.equal(suppressionCalls, 0);
  assert.equal(result.eventsUpserted, 1);
  const contact = espocrm.records.find((record) => record.entityType === "MediaContact");
  const event = espocrm.records.find((record) => record.entityType === "OutreachEvent");
  assert.equal(contact.payload.doNotContact, true);
  assert.equal(contact.payload.status, "Needs Validation");
  assert.equal(event.payload.eventType, "Soft Bounced");
});

test("only opt-out, spam complaint, and hard bounce history qualifies for permanent suppression", () => {
  const cases = [
    ["Unsubscribed", "opt_out"],
    ["Spam Complaint", "spam_complaint"],
    ["Hard Bounced", "hard_bounce"],
    ["Soft Bounced", undefined],
    ["Delivered", undefined]
  ];
  for (const [action, expected] of cases) {
    const analysis = analyzeLegacyLeads([{
      id: `lead-${action}`,
      emailAddress: `${action.replaceAll(" ", "-").toLowerCase()}@radio.example.test`,
      description: VALID_DESCRIPTION,
      modifiedAt: "2026-07-01 10:00:00"
    }], [{
      id: `event-${action}`,
      targetId: `lead-${action}`,
      targetType: "Lead",
      action,
      createdAt: "2026-07-02 10:00:00"
    }]);
    assert.equal(analysis.contacts[0].historicNegativeType, expected, action);
  }
});

test("operation checkpoint resumes event import without offsets losing or duplicating work", async () => {
  const leads = [{
    id: "lead-one",
    emailAddress: "one@radio.example.test",
    description: VALID_DESCRIPTION,
    modifiedAt: "2026-07-01 10:00:00"
  }, {
    id: "lead-two",
    emailAddress: "two@radio.example.test",
    description: VALID_DESCRIPTION,
    modifiedAt: "2026-07-01 10:00:00"
  }];
  const history = leads.map((lead, index) => ({
    id: `event-${index + 1}`,
    targetId: lead.id,
    targetType: "Lead",
    action: "Sent",
    createdAt: `2026-07-0${index + 2} 10:00:00`
  }));
  const analysis = analyzeLegacyLeads(leads, history);
  const espocrm = fakeEspo();
  const upsert = espocrm.upsertByUnique.bind(espocrm);
  let failFirstEvent = true;
  espocrm.upsertByUnique = async (...args) => {
    if (args[0] === "OutreachEvent" && failFirstEvent) {
      failFirstEvent = false;
      throw new Error("simulated interruption");
    }
    return upsert(...args);
  };
  let checkpoint = 0;

  await assert.rejects(() => applyLegacyMigration({
    analysis,
    espocrm,
    logger: { info() {} },
    batchSize: 1,
    onCheckpoint: async (nextOffset) => { checkpoint = nextOffset; }
  }), /simulated interruption/u);
  assert.equal(checkpoint, 3);

  const result = await applyLegacyMigration({
    analysis,
    espocrm,
    logger: { info() {} },
    batchSize: 1,
    startOffset: checkpoint,
    onCheckpoint: async (nextOffset) => { checkpoint = nextOffset; }
  });
  assert.equal(checkpoint, 5);
  assert.deepEqual(result, {
    outletsUpserted: 1,
    contactsUpserted: 2,
    eventsUpserted: 2,
    permanentSuppressionsUpserted: 0,
    completedOperations: 5,
    totalOperations: 5
  });
  assert.equal([...espocrm.stored.keys()].filter((key) => key.startsWith("OutreachEvent:")).length, 2);

  await applyLegacyMigration({ analysis, espocrm, logger: { info() {} }, batchSize: 2 });
  assert.equal([...espocrm.stored.keys()].filter((key) => key.startsWith("OutreachEvent:")).length, 2);
});

test("contact apply order is stable by modifiedAt then source id", () => {
  const analysis = analyzeLegacyLeads([{
    id: "z-id",
    emailAddress: "z@radio.example.test",
    description: VALID_DESCRIPTION,
    modifiedAt: "2026-07-01 10:00:00"
  }, {
    id: "a-id",
    emailAddress: "a@radio.example.test",
    description: VALID_DESCRIPTION,
    modifiedAt: "2026-07-01 10:00:00"
  }]);
  assert.deepEqual(analysis.contacts.map((item) => item.sourceCursor.id), ["a-id", "z-id"]);
});

test("duplicate no-submissions evidence is merged deny-wins", async () => {
  const blockedDescription = [
    "Station: Radio Example",
    "Website: https://radio.example.test",
    "Proof URL: https://radio.example.test/policy",
    "Proof Text: Do not send music to this address; no submissions accepted.",
    "Verification Status: valid"
  ].join("\n");
  const analysis = analyzeLegacyLeads([{
    id: "lead-allow",
    emailAddress: "policy@radio.example.test",
    description: VALID_DESCRIPTION,
    modifiedAt: "2026-07-01 10:00:00"
  }, {
    id: "lead-deny",
    emailAddress: "policy@radio.example.test",
    description: blockedDescription,
    modifiedAt: "2026-07-02 10:00:00"
  }]);
  assert.equal(analysis.contacts[0].submissionPolicy, "No Submissions");
  assert.ok(analysis.contacts[0].blockReasons.includes("no_submissions"));

  const espocrm = fakeEspo();
  await applyLegacyMigration({ analysis, espocrm, logger: { info() {} } });
  const outlet = espocrm.records.find((record) => record.entityType === "MediaOutlet");
  assert.equal(outlet.payload.acceptsEmail, false);
  assert.equal(outlet.payload.activityStatus, "Needs Validation");
});

test("Espo event schema supports either live match or legacy contact provenance", () => {
  const metadataRoot = new URL("../../../deploy/espocrm/extensions/marcsmusic-outreach/files/custom/Espo/Modules/MarcsMusicOutreach/Resources/metadata/entityDefs/", import.meta.url);
  const eventDefs = JSON.parse(readFileSync(new URL("OutreachEvent.json", metadataRoot), "utf8"));
  const contactDefs = JSON.parse(readFileSync(new URL("MediaContact.json", metadataRoot), "utf8"));

  assert.equal(eventDefs.fields.outreachMatch.required, undefined);
  assert.equal(eventDefs.fields.outreachMatch.readOnlyAfterCreate, true);
  assert.equal(eventDefs.fields.mediaContact.readOnlyAfterCreate, true);
  assert.deepEqual(eventDefs.links.mediaContact, {
    type: "belongsTo",
    entity: "MediaContact",
    foreign: "outreachEvents"
  });
  assert.deepEqual(contactDefs.links.outreachEvents, {
    type: "hasMany",
    entity: "OutreachEvent",
    foreign: "mediaContact"
  });
});

function fakeEspo() {
  const records = [];
  const stored = new Map();
  const entitySequence = new Map();
  return {
    records,
    stored,
    async upsertByUnique(entityType, uniqueField, uniqueValue, payload) {
      const key = `${entityType}:${uniqueField}:${uniqueValue}`;
      let record = stored.get(key);
      if (!record) {
        const next = (entitySequence.get(entityType) ?? 0) + 1;
        entitySequence.set(entityType, next);
        const prefix = entityType === "MediaOutlet" ? "outlet" : entityType === "MediaContact" ? "contact" : entityType === "OutreachEvent" ? "event" : "suppression";
        record = { id: `${prefix}-${next}`, entityType, uniqueField, uniqueValue, payload };
        stored.set(key, record);
      }
      records.push({ entityType, uniqueField, uniqueValue, payload, id: record.id });
      return { id: record.id };
    },
    async findOne(entityType, uniqueField, uniqueValue) {
      return stored.get(`${entityType}:${uniqueField}:${uniqueValue}`);
    }
  };
}
