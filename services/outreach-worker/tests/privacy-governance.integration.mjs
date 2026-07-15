import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import pg from "pg";
import { createPrivacyGovernanceService } from "../src/application/privacy-governance-service.mjs";
import { loadPrivacyPolicy, PRIVACY_DATA_CLASSES } from "../src/domain/privacy-policy.mjs";
import { CryptoBox } from "../src/infrastructure/crypto-box.mjs";
import { OutreachRepository } from "../src/infrastructure/outreach-repository.mjs";
import { PrivacyGovernanceRepository } from "../src/infrastructure/privacy-governance-repository.mjs";
import { startPostgresTestCluster } from "./helpers/postgres-test-cluster.mjs";

const { Pool } = pg;
const migrationDirectory = new URL("../migrations/", import.meta.url);
const ACTOR = "privacy-owner-integration";
const POPULATED_ROWS = 20_000;
const POLICY = loadPrivacyPolicy({
  OUTREACH_RETENTION_POLICY_JSON: JSON.stringify({
    schemaVersion: 1,
    policyVersion: "privacy-integration-v1",
    enabled: true,
    approvedPolicyReference: "privacy-approval-integration-001",
    dataClasses: Object.fromEntries(PRIVACY_DATA_CLASSES.map((dataClass) => [dataClass, dataClass === "inbound_event_evidence" ? {
      retentionDays: 30,
      minimumRetentionDays: 1,
      maximumRetentionDays: 365,
      batchSize: 2,
      maximumRecordsPerPlan: 100
    } : {
      retentionDays: 36_500,
      minimumRetentionDays: 1,
      maximumRetentionDays: 36_500,
      batchSize: 2,
      maximumRecordsPerPlan: 100
    }]))
  })
});

test("privacy retention and DSAR PostgreSQL contracts", async (t) => {
  const cluster = await startPostgresTestCluster();
  const database = await cluster.createDatabase();
  const pool = new Pool({ connectionString: database.url, max: 6 });
  const cryptoBox = new CryptoBox({
    encryptionKey: Buffer.alloc(32, 71),
    keyVersion: "privacy-v1",
    hashKey: "privacy-integration-hash-key"
  });
  const eventId = randomUUID();
  try {
    await applyMigrations(pool, [
      "001_initial.sql", "002_source_ingestion.sql", "003_email_validation_method.sql",
      "004_source_ingestion_fenced_lease.sql", "005_runtime_safety.sql",
      "006_db_workflow_hardening.sql", "007_source_identity_dedup.sql"
    ]);
    const eventCipher = cryptoBox.encryptJson({ sender: "person@example.com", body: "private evidence" }, "mailgun:event-old");
    await pool.query(
      `INSERT INTO encrypted_event_inbox
        (id,source,external_id,event_type,entity_type,entity_id,payload_ciphertext,payload_iv,payload_tag,key_version,status,created_at,processed_at)
       VALUES ($1,'mailgun','event-old','delivered','MediaContact','crm-contact-42',$2,$3,$4,$5,'processed','2020-01-01','2020-01-02')`,
      [eventId, eventCipher.ciphertext, eventCipher.iv, eventCipher.tag, eventCipher.keyVersion]
    );
    await seedPopulatedNaturalKeyTables(pool, cryptoBox);

    await t.test("migration 008 is lock-bounded and performs no volatile privacy-id backfill", async () => {
      const sql = await readMigration("008_privacy_governance.sql");
      const blocker = await pool.connect();
      const migrator = await pool.connect();
      try {
        await blocker.query("BEGIN");
        await blocker.query("LOCK TABLE sequence_allocations IN ACCESS SHARE MODE");
        await migrator.query("BEGIN");
        await migrator.query("SET LOCAL lock_timeout='200ms'");
        const startedAt = Date.now();
        await assert.rejects(
          () => migrator.query(sql),
          (error) => error.code === "55P03"
        );
        assert.ok(Date.now() - startedAt < 2_000);
        await migrator.query("ROLLBACK");
      } finally {
        await blocker.query("ROLLBACK").catch(() => {});
        blocker.release();
        migrator.release();
      }
      const migrationClient = await pool.connect();
      try {
        await migrationClient.query("BEGIN");
        await migrationClient.query("SET LOCAL lock_timeout='2s'");
        await migrationClient.query(sql);
        await migrationClient.query("COMMIT");
      } catch (error) {
        await migrationClient.query("ROLLBACK");
        throw error;
      } finally {
        migrationClient.release();
      }
      const untouched = await pool.query(
        `SELECT
          (SELECT count(*)::int FROM sequence_allocations WHERE privacy_record_id IS NOT NULL) AS allocations,
          (SELECT count(*)::int FROM source_ingestion_record_links WHERE privacy_record_id IS NOT NULL) AS source_links,
          (SELECT count(*)::int FROM email_validation_cache WHERE privacy_record_id IS NOT NULL) AS validations`
      );
      assert.deepEqual(untouched.rows[0], { allocations: 0, source_links: 0, validations: 0 });
    });

    await applyMigrations(pool, ["009_crm_projection.sql"]);
    await pool.query("CREATE ROLE outreach_privacy_runtime NOLOGIN");
    await pool.query("CREATE ROLE privacy_unauthorized NOLOGIN");
    await applyMigrations(pool, ["014_privacy_governance_hardening.sql"]);
    await applyMigrations(pool, [
      "015_matching_allocation_hardening.sql",
      "017_direct_crm_intake.sql",
      "018_hash_key_attestation.sql"
    ]);

    const repository = new PrivacyGovernanceRepository({
      pool,
      cryptoBox,
      database: { lockTimeoutMs: 200, statementTimeoutMs: 15_000 }
    });
    const service = createPrivacyGovernanceService({ repository, cryptoBox, policy: POLICY });

    await t.test("audit append boundary denies PUBLIC, grants only the runtime role and rejects forged parameters", async () => {
      const client = await pool.connect();
      const appendSql = `SELECT * FROM append_privacy_audit_event(
        $1::text,$2::text,$3::text,$4::text,NULL::char(64),NULL::text,NULL::text,NULL::text,$5::jsonb
      )`;
      try {
        await client.query("BEGIN");
        await client.query("SET LOCAL ROLE privacy_unauthorized");
        await assert.rejects(
          () => client.query(appendSql, ["privacy_schema_prepared", "privacy_record_index", "unauthorized", ACTOR, "{}"]),
          (error) => error.code === "42501"
        );
        await client.query("ROLLBACK");

        await client.query("BEGIN");
        await client.query("SET LOCAL ROLE outreach_privacy_runtime");
        await assert.rejects(
          () => client.query(appendSql, ["forged_event", "privacy_record_index", "forged", ACTOR, "{}"]),
          (error) => error.code === "22023"
        );
        await client.query("ROLLBACK");

        await client.query("BEGIN");
        await client.query("SET LOCAL ROLE outreach_privacy_runtime");
        await client.query(appendSql, ["privacy_schema_prepared", "privacy_record_index", "runtime-boundary-test", ACTOR, "{}"]);
        await client.query("ROLLBACK");
      } finally {
        await client.query("ROLLBACK").catch(() => {});
        client.release();
      }
    });

    await t.test("online privacy schema preparation is singleton, duplicate-safe and recovers invalid indexes", async () => {
      const dryRun = await repository.ensurePrivacyIndexes({ actorId: ACTOR, apply: false });
      assert.equal(dryRun.applied, false);
      assert.equal(dryRun.after.indexesReady, false);
      assert.equal(dryRun.after.constraintsReady, false);

      const blocker = await pool.connect();
      try {
        await blocker.query("SELECT pg_advisory_lock(hashtext($1))", ["privacy-index-build-v1"]);
        await assert.rejects(
          () => repository.ensurePrivacyIndexes({ actorId: ACTOR, apply: true }),
          (error) => error.code === "PRIVACY_INDEX_BUILD_ALREADY_RUNNING"
        );
      } finally {
        await blocker.query("SELECT pg_advisory_unlock(hashtext($1))", ["privacy-index-build-v1"]).catch(() => {});
        blocker.release();
      }

      const duplicateId = randomUUID();
      await pool.query(
        `UPDATE sequence_allocations SET privacy_record_id=$1
         WHERE recipient_hash IN (SELECT recipient_hash FROM sequence_allocations ORDER BY recipient_hash LIMIT 2)`,
        [duplicateId]
      );
      await assert.rejects(
        () => repository.ensurePrivacyIndexes({ actorId: ACTOR, apply: true }),
        (error) => error.code === "23505"
      );
      await pool.query(
        `WITH reset AS (
           SELECT recipient_hash FROM sequence_allocations WHERE privacy_record_id=$1 ORDER BY recipient_hash LIMIT 1
         )
         UPDATE sequence_allocations target SET privacy_record_id=NULL
         FROM reset WHERE target.recipient_hash=reset.recipient_hash`,
        [duplicateId]
      );
      const recovered = await repository.ensurePrivacyIndexes({ actorId: ACTOR, apply: true });
      assert.equal(recovered.after.indexesReady, true);
      assert.equal(recovered.after.constraintsReady, true);
      assert.ok(recovered.changed.some(({ action }) => action === "invalid_index_dropped"));
      assert.ok(recovered.after.indexes.every(({ status }) => status === "valid"));
    });

    await t.test("interrupted FK validation remains fail-closed and resumes one constraint at a time", async () => {
      await pool.query(
        `UPDATE pg_constraint SET convalidated=false WHERE conname='encrypted_event_inbox_privacy_plan_fk'`
      );
      const blocker = await pool.connect();
      try {
        await blocker.query("BEGIN");
        await blocker.query("LOCK TABLE encrypted_event_inbox IN SHARE UPDATE EXCLUSIVE MODE");
        await assert.rejects(
          () => repository.ensurePrivacyIndexes({ actorId: ACTOR, apply: true }),
          (error) => error.code === "55P03" || error.code === "57014"
        );
      } finally {
        await blocker.query("ROLLBACK").catch(() => {});
        blocker.release();
      }
      const resumed = await repository.ensurePrivacyIndexes({ actorId: ACTOR, apply: true });
      assert.equal(resumed.after.constraintsReady, true);
    });

    await t.test("privacy record index backfill uses bounded natural-key batches, skips locks and is resumable", async () => {
      const dryRun = await repository.backfillPrivacyRecordIds({ actorId: ACTOR, apply: false, batchSize: 10, maxBatches: 3 });
      assert.equal(dryRun.applied, false);
      assert.equal(dryRun.before.sequence_allocations, POPULATED_ROWS - 1);

      const blocker = await pool.connect();
      let lockedRecipient;
      try {
        await blocker.query("BEGIN");
        const locked = await blocker.query(
          `SELECT recipient_hash FROM sequence_allocations WHERE privacy_record_id IS NULL ORDER BY recipient_hash LIMIT 1 FOR UPDATE`
        );
        lockedRecipient = locked.rows[0].recipient_hash;
        const startedAt = Date.now();
        const skipped = await repository.backfillPrivacyRecordIds({ actorId: ACTOR, apply: true, batchSize: 10, maxBatches: 1 });
        assert.equal(skipped.updated.sequence_allocations, 10);
        assert.ok(Date.now() - startedAt < 2_000);
        const stillNull = await blocker.query(
          "SELECT privacy_record_id IS NULL AS value FROM sequence_allocations WHERE recipient_hash=$1",
          [lockedRecipient]
        );
        assert.equal(stillNull.rows[0].value, true);
      } finally {
        await blocker.query("ROLLBACK").catch(() => {});
        blocker.release();
      }

      const applied = await repository.backfillPrivacyRecordIds({ actorId: ACTOR, apply: true, batchSize: 10, maxBatches: 3 });
      assert.equal(applied.updated.sequence_allocations, 10);
      assert.equal(applied.updated.source_ingestion_record_links, 10);
      assert.equal(applied.updated.email_validation_cache, 10);
      assert.equal(applied.after.sequence_allocations, POPULATED_ROWS - 21);
      await assert.rejects(
        () => service.planRetention({ actorId: ACTOR, snapshotAt: new Date("2026-07-15T10:00:00.000Z") }),
        (error) => error.code === "PRIVACY_INDEX_NOT_READY"
      );
      const completed = await service.preparePrivacyIndex({
        actorId: ACTOR,
        apply: true,
        batchSize: 500,
        maxBatches: 1_000
      });
      assert.equal(completed.ready, true);
      assert.deepEqual(completed.state.backfill, {
        sequence_allocations: 0,
        source_ingestion_record_links: 0,
        email_validation_cache: 0,
        source_identity_bindings: 0,
        source_identity_claim_items: 0,
        send_counters: 0,
        send_capacity_reservations: 0,
        outlet_first_send_guards: 0,
        source_ingestion_receipts: 0,
        contact_genre_denials: 0,
        campaign_outlet_allocation_counters: 0,
        campaign_outlet_allocation_ledger: 0,
        crm_intake_receipts: 0,
        purpose_bound_evidence_attestations: 0
      });
    });

    await t.test("record-id defaults and NOT NULL contracts finalize online, fail closed and resume after lock timeout", async () => {
      await pool.query(
        `ALTER TABLE email_validation_cache ALTER COLUMN privacy_record_id DROP NOT NULL,
         ALTER COLUMN privacy_record_id DROP DEFAULT`
      );
      const recipientHash = cryptoBox.privacyHash("contract-race@example.test");
      await pool.query(
        `INSERT INTO email_validation_cache
          (recipient_hash,status,checked_at,expires_at,provider_reference,validator_type)
         VALUES ($1,'Unknown',now(),now()+interval '1 day','contract-test','http')`,
        [recipientHash]
      );
      const incomplete = await repository.inspectPrivacyIndexState();
      assert.equal(incomplete.ready, false);
      assert.equal(incomplete.recordIdContractsReady, false);
      assert.equal(incomplete.backfillComplete, false);

      const blocker = await pool.connect();
      try {
        await blocker.query("BEGIN");
        await blocker.query("LOCK TABLE email_validation_cache IN ACCESS SHARE MODE");
        await assert.rejects(
          () => service.preparePrivacyIndex({ actorId: ACTOR, apply: true, batchSize: 10, maxBatches: 10 }),
          (error) => error.code === "55P03" || error.code === "57014"
        );
      } finally {
        await blocker.query("ROLLBACK").catch(() => {});
        blocker.release();
      }
      const interrupted = await repository.inspectPrivacyIndexState();
      assert.equal(interrupted.backfillComplete, true);
      assert.equal(interrupted.recordIdContractsReady, false);
      await assert.rejects(
        () => service.planRetention({ actorId: ACTOR, snapshotAt: new Date("2026-07-15T10:00:00.000Z") }),
        (error) => error.code === "PRIVACY_INDEX_NOT_READY"
      );

      const resumed = await service.preparePrivacyIndex({ actorId: ACTOR, apply: true, batchSize: 10, maxBatches: 10 });
      assert.equal(resumed.ready, true);
      const defaultRecipientHash = cryptoBox.privacyHash("contract-default@example.test");
      const inserted = await pool.query(
        `INSERT INTO email_validation_cache
          (recipient_hash,status,checked_at,expires_at,provider_reference,validator_type)
         VALUES ($1,'Unknown',now(),now()+interval '1 day','contract-test','http')
         RETURNING privacy_record_id`,
        [defaultRecipientHash]
      );
      assert.match(String(inserted.rows[0].privacy_record_id), /^[0-9a-f-]{36}$/u);
    });

    await t.test("canonical plan is idempotent, legal holds deny execution, and suppressions survive tombstoning", async () => {
      const snapshotAt = new Date("2026-07-15T10:00:00.000Z");
      const plan = await service.planRetention({ actorId: ACTOR, snapshotAt });
      const replay = await service.planRetention({ actorId: ACTOR, snapshotAt });
      assert.equal(replay.replayed, true);
      assert.equal(replay.planId, plan.planId);
      assert.equal(replay.digest, plan.digest);
      assert.deepEqual(plan.counts, {
        total: 1,
        planned: 1,
        held: 0,
        byDataClass: { inbound_event_evidence: { total: 1, planned: 1, held: 0 } }
      });
      await assert.rejects(
        () => pool.query(
          "UPDATE privacy_governance_plan_items SET action='metadata_anonymize' WHERE plan_id=$1",
          [plan.planId]
        ),
        (error) => error.code === "55000"
      );
      await assert.rejects(
        () => pool.query("UPDATE privacy_governance_plans SET canonical_digest=$2 WHERE id=$1", [plan.planId, "f".repeat(64)]),
        (error) => error.code === "55000"
      );

      const hold = await service.createLegalHold({
        subjectType: "global",
        subject: "global",
        scopeDataClass: "inbound_event_evidence",
        caseReference: "legal-case-integration-001",
        evidence: { authority: "test" },
        actorId: ACTOR
      });
      await assert.rejects(
        () => service.createLegalHold({
          subjectType: "global",
          subject: "global",
          scopeDataClass: "inbound_event_evidence",
          caseReference: "legal-case-integration-001",
          evidence: { authority: "changed" },
          actorId: ACTOR
        }),
        (error) => error.code === "PRIVACY_LEGAL_HOLD_REFERENCE_COLLISION"
      );
      const blocked = await execute(service, plan);
      assert.equal(blocked.blocked, true);
      assert.equal(await tombstoned(pool, "encrypted_event_inbox", eventId), false);
      await service.releaseLegalHold({ holdId: hold.holdId, releaseReference: "legal-release-integration-001", actorId: ACTOR });

      const completed = await execute(service, plan);
      assert.equal(completed.completed, true);
      const event = await pool.query("SELECT * FROM encrypted_event_inbox WHERE id=$1", [eventId]);
      assert.ok(event.rows[0].privacy_tombstoned_at);
      assert.equal(event.rows[0].entity_id, null);
      const tombstone = cryptoBox.decryptJson({
        ciphertext: event.rows[0].payload_ciphertext,
        iv: event.rows[0].payload_iv,
        tag: event.rows[0].payload_tag,
        keyVersion: event.rows[0].key_version
      }, `${event.rows[0].source}:${event.rows[0].external_id}`);
      assert.equal(tombstone.privacyTombstone, true);
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM suppression_cache WHERE active=true")).rows[0].count, 1);

      const repeatedExecution = await execute(service, plan);
      assert.equal(repeatedExecution.completed, true);
      await assert.rejects(
        () => execute(service, plan, { approvalId: "approval-privacy-different" }),
        (error) => error.code === "PRIVACY_EXECUTION_BINDING_MISMATCH"
      );
      await assert.rejects(
        () => pool.query("UPDATE privacy_audit_events SET event_type='tampered' WHERE aggregate_id=$1", [plan.planId]),
        (error) => error.code === "55000"
      );
      await assert.rejects(() => pool.query("TRUNCATE privacy_audit_events"), (error) => error.code === "55000");
      const audit = (await pool.query("SELECT previous_hash,event_hash FROM privacy_audit_events ORDER BY sequence_id")).rows;
      for (let index = 1; index < audit.length; index += 1) assert.equal(audit[index].previous_hash, audit[index - 1].event_hash);
    });

    await t.test("subject-scoped holds preserve only matching records and are rechecked inside the execution fence", async () => {
      const contactA = "crm-contact-hold-a";
      const contactB = "crm-contact-hold-b";
      const [heldEvent, unrelatedEvent] = await insertOldContactEvents(pool, cryptoBox, [contactA, contactB], "subject-hold");
      const hold = await service.createLegalHold({
        subjectType: "contact",
        subject: contactA,
        scopeDataClass: "inbound_event_evidence",
        caseReference: "legal-case-subject-hold-001",
        evidence: { authority: "test" },
        actorId: ACTOR
      });
      const scopedPlan = await service.planRetention({ actorId: ACTOR, snapshotAt: new Date("2026-07-15T10:00:30.000Z") });
      assert.deepEqual(scopedPlan.counts, {
        total: 2,
        planned: 1,
        held: 1,
        byDataClass: { inbound_event_evidence: { total: 2, planned: 1, held: 1 } }
      });
      const scopedExecution = await execute(service, scopedPlan);
      assert.equal(scopedExecution.completed, true);
      assert.equal(await tombstoned(pool, "encrypted_event_inbox", heldEvent), false);
      assert.equal(await tombstoned(pool, "encrypted_event_inbox", unrelatedEvent), true);
      await service.releaseLegalHold({ holdId: hold.holdId, releaseReference: "legal-release-subject-hold-001", actorId: ACTOR });
      const releasedPlan = await service.planRetention({ actorId: ACTOR, snapshotAt: new Date("2026-07-15T10:00:40.000Z") });
      assert.equal((await execute(service, releasedPlan)).completed, true);
      assert.equal(await tombstoned(pool, "encrypted_event_inbox", heldEvent), true);

      const contactC = "crm-contact-hold-race";
      const contactD = "crm-contact-hold-unrelated";
      const [raceHeld, raceUnrelated] = await insertOldContactEvents(pool, cryptoBox, [contactC, contactD], "hold-race");
      const racePlan = await service.planRetention({ actorId: ACTOR, snapshotAt: new Date("2026-07-15T10:00:50.000Z") });
      const raceHold = await service.createLegalHold({
        subjectType: "contact",
        subject: contactC,
        scopeDataClass: "inbound_event_evidence",
        caseReference: "legal-case-subject-race-001",
        evidence: { authority: "test" },
        actorId: ACTOR
      });
      const blocked = await execute(service, racePlan);
      assert.equal(blocked.blocked, true);
      assert.equal(await tombstoned(pool, "encrypted_event_inbox", raceHeld), false);
      assert.equal(await tombstoned(pool, "encrypted_event_inbox", raceUnrelated), false);
      await service.releaseLegalHold({ holdId: raceHold.holdId, releaseReference: "legal-release-subject-race-001", actorId: ACTOR });
      assert.equal((await execute(service, racePlan)).completed, true);
      assert.equal(await tombstoned(pool, "encrypted_event_inbox", raceHeld), true);
      assert.equal(await tombstoned(pool, "encrypted_event_inbox", raceUnrelated), true);
    });

    await t.test("fenced leases resume after a crash without duplicate tombstones", async () => {
      const ids = await insertOldEvents(pool, cryptoBox, 2, "resume");
      const plan = await service.planRetention({ actorId: ACTOR, snapshotAt: new Date("2026-07-15T10:01:00.000Z") });
      const leaseA = await repository.acquireExecutionLease({ planId: plan.planId, ownerId: "privacy-crashed-worker", leaseSeconds: 30 });
      const binding = executionBinding(plan);
      await repository.beginExecution({ lease: leaseA, ...binding, actorId: ACTOR, leaseSeconds: 30 });
      const first = await repository.executeBatch({ lease: leaseA, batchSize: 1, actorId: ACTOR, leaseSeconds: 30 });
      assert.equal(first.processed, 1);
      assert.equal(first.completed, false);
      await pool.query("UPDATE privacy_execution_leases SET locked_until=now()-interval '1 second' WHERE lease_name=$1", [leaseA.leaseName]);
      const leaseB = await repository.acquireExecutionLease({ planId: plan.planId, ownerId: "privacy-recovery-worker", leaseSeconds: 30 });
      assert.ok(leaseB.fenceToken > leaseA.fenceToken);
      await assert.rejects(
        () => repository.executeBatch({ lease: leaseA, batchSize: 1, actorId: ACTOR, leaseSeconds: 30 }),
        (error) => error.code === "PRIVACY_EXECUTION_LEASE_LOST"
      );
      await repository.beginExecution({ lease: leaseB, ...binding, actorId: ACTOR, leaseSeconds: 30 });
      const recovered = await repository.executeBatch({ lease: leaseB, batchSize: 2, actorId: ACTOR, leaseSeconds: 30 });
      assert.equal(recovered.completed, true);
      const rows = await pool.query("SELECT count(*)::int AS count FROM encrypted_event_inbox WHERE id=ANY($1::uuid[]) AND privacy_tombstoned_at IS NOT NULL", [ids]);
      assert.equal(rows.rows[0].count, 2);
    });

    await t.test("drift aborts the exact approved plan before mutation", async () => {
      const [id] = await insertOldEvents(pool, cryptoBox, 1, "drift");
      const plan = await service.planRetention({ actorId: ACTOR, snapshotAt: new Date("2026-07-15T10:02:00.000Z") });
      await pool.query("UPDATE encrypted_event_inbox SET event_type='changed-after-plan' WHERE id=$1", [id]);
      await assert.rejects(() => execute(service, plan), (error) => error.code === "PRIVACY_PLAN_DRIFT");
      assert.equal(await tombstoned(pool, "encrypted_event_inbox", id), false);
      assert.equal((await repository.getPlan(plan.planId)).status, "failed");
    });

    await t.test("DSAR export and Espo correction plans stay encrypted and no live CRM mutation exists", async () => {
      const fixtures = await insertDsarFixtures(pool, cryptoBox);
      const created = await service.createDsarRequest({
        requestType: "export",
        subjectType: "email",
        subject: "person@example.com",
        requestReference: "dsar-export-integration-001",
        evidence: { verifiedBy: "restricted-portal" },
        actorId: ACTOR
      });
      await assert.rejects(
        () => service.createDsarRequest({
          requestType: "export",
          subjectType: "email",
          subject: "person@example.com",
          requestReference: "dsar-export-integration-001",
          evidence: { verifiedBy: "different-evidence" },
          actorId: ACTOR
        }),
        (error) => error.code === "PRIVACY_DSAR_REFERENCE_COLLISION"
      );
      const planned = await service.planDsarRequest({ requestId: created.requestId, actorId: ACTOR, maximumRecords: 100 });
      assert.equal(JSON.stringify(planned).includes("person@example.com"), false);
      const stored = await pool.query("SELECT payload_ciphertext::text AS ciphertext FROM privacy_dsar_artifacts WHERE id=$1", [planned.artifactId]);
      assert.equal(stored.rows[0].ciphertext.includes("person@example.com"), false);
      const exportArtifact = await repository.readDsarArtifact({ requestId: created.requestId, artifactId: planned.artifactId });
      assert.equal(exportArtifact.subject.value, "person@example.com");
      assert.equal(exportArtifact.snapshot.records.responseQueue[0].payload.to, "person@example.com");
      assert.equal(exportArtifact.suppressionTreatment, "preserve_hashed_deny_wins_evidence");
      for (const recordType of [
        "campaignOutletAllocations",
        "campaignOutletCounters",
        "crmIntakeReceipts",
        "purposeBoundEvidence",
        "workItems",
        "deliveryAttempts",
        "responseDeliveryAttempts",
        "sourceIngestionRecordLinks",
        "emailValidationCache",
        "sourceIdentityBindings",
        "sourceIdentityClaimItems",
        "sourceIdentityClaims",
        "crmDeliveryProjections",
        "contactGenreDenials"
      ]) assert.equal(exportArtifact.snapshot.records[recordType].length, 1, recordType);
      const verifiedArtifactExport = await service.exportDsarArtifact({
        requestId: created.requestId,
        artifactId: planned.artifactId,
        actorId: ACTOR
      });
      assert.equal(verifiedArtifactExport.manifest.digest, planned.digest);
      assert.equal(JSON.stringify(verifiedArtifactExport.manifest).includes("person@example.com"), false);
      assert.equal(verifiedArtifactExport.payload.subject.value, "person@example.com");

      const unrelated = await service.createDsarRequest({
        requestType: "correction",
        subjectType: "contact",
        subject: "crm-contact-42",
        requestReference: "dsar-unrelated-entity-integration-001",
        evidence: { verifiedBy: "restricted-portal" },
        espoMutations: [{
          entityType: "MediaContact",
          entityId: "crm-contact-unrelated",
          expectedVersion: 1,
          mutationType: "correction",
          patch: { name: "Unauthorized" }
        }],
        actorId: ACTOR
      });
      await assert.rejects(
        () => service.planDsarRequest({ requestId: unrelated.requestId, actorId: ACTOR, maximumRecords: 100 }),
        (error) => error.code === "PRIVACY_ESPO_SUBJECT_GRAPH_MISMATCH"
      );

      const correction = await service.createDsarRequest({
        requestType: "correction",
        subjectType: "contact",
        subject: "crm-contact-42",
        requestReference: "dsar-correction-integration-001",
        evidence: { verifiedBy: "restricted-portal" },
        requestedCorrection: { name: "Corrected" },
        espoMutations: [{
          entityType: "MediaContact",
          entityId: "crm-contact-42",
          expectedVersion: 7,
          mutationType: "correction",
          patch: { name: "Corrected" }
        }],
        actorId: ACTOR
      });
      await service.planDsarRequest({ requestId: correction.requestId, actorId: ACTOR, maximumRecords: 100 });
      const espoRow = await pool.query("SELECT id,status,expected_version FROM privacy_espo_mutation_plans WHERE request_id=$1", [correction.requestId]);
      assert.equal(espoRow.rows[0].status, "planned");
      assert.equal(Number(espoRow.rows[0].expected_version), 7);
      const espoPlan = await repository.readEspoMutationPlan(espoRow.rows[0].id);
      assert.equal(espoPlan.entityId, "crm-contact-42");
      assert.equal(typeof repository.executeEspoMutationPlan, "undefined");
      const exportedEspoPlan = await service.exportEspoMutationPlan({ planId: espoRow.rows[0].id, actorId: ACTOR });
      assert.equal(exportedEspoPlan.manifest.digest.length, 64);
      assert.equal(exportedEspoPlan.payload.entityId, "crm-contact-42");
      assert.equal(JSON.stringify(exportedEspoPlan.manifest).includes("crm-contact-42"), false);
      assert.equal(
        (await pool.query(
          "SELECT count(*)::int AS count FROM privacy_audit_events WHERE event_type='espo_mutation_plan_exported' AND aggregate_id=$1",
          [espoRow.rows[0].id]
        )).rows[0].count,
        1
      );
      await assert.rejects(
        () => pool.query("UPDATE privacy_espo_mutation_plans SET plan_digest=$2 WHERE id=$1", [espoRow.rows[0].id, "b".repeat(64)]),
        (error) => error.code === "55000"
      );
      const privilegedCorruptor = await pool.connect();
      try {
        await privilegedCorruptor.query("ALTER TABLE privacy_espo_mutation_plans DISABLE TRIGGER privacy_espo_plan_immutable_update");
        await privilegedCorruptor.query(
          "UPDATE privacy_espo_mutation_plans SET plan_digest=$2 WHERE id=$1",
          [espoRow.rows[0].id, "b".repeat(64)]
        );
      } finally {
        await privilegedCorruptor.query("ALTER TABLE privacy_espo_mutation_plans ENABLE TRIGGER privacy_espo_plan_immutable_update").catch(() => {});
        privilegedCorruptor.release();
      }
      await assert.rejects(
        () => service.exportEspoMutationPlan({ planId: espoRow.rows[0].id, actorId: ACTOR }),
        (error) => error.code === "PRIVACY_ESPO_PLAN_INTEGRITY_FAILED"
      );

      await pool.query(
        `UPDATE email_validation_cache SET expires_at='2027-01-01',updated_at=now()
         WHERE provider_reference='seed'`
      );
      const emailHold = await service.createLegalHold({
        subjectType: "email",
        subject: "person@example.com",
        scopeDataClass: "email_validation_metadata",
        caseReference: "legal-case-email-hash-001",
        evidence: { authority: "test" },
        actorId: ACTOR
      });
      const validationPolicy = policyWithShortRetention("email_validation_metadata");
      const validationService = createPrivacyGovernanceService({ repository, cryptoBox, policy: validationPolicy });
      const heldValidationPlan = await validationService.planRetention({
        actorId: ACTOR,
        snapshotAt: new Date("2026-07-15T10:59:00.000Z")
      });
      assert.equal(heldValidationPlan.counts.total, 1);
      assert.equal(heldValidationPlan.counts.held, 1);
      assert.equal((await executeWithPolicy(validationService, heldValidationPlan)).completed, true);
      assert.equal(await tombstonedByPrivacyId(pool, "email_validation_cache", fixtures.validationPrivacyId), false);
      await service.releaseLegalHold({ holdId: emailHold.holdId, releaseReference: "legal-release-email-hash-001", actorId: ACTOR });
      const releasedValidationPlan = await validationService.planRetention({
        actorId: ACTOR,
        snapshotAt: new Date("2026-07-15T10:59:30.000Z")
      });
      assert.equal((await executeWithPolicy(validationService, releasedValidationPlan)).completed, true);
      assert.equal(await tombstonedByPrivacyId(pool, "email_validation_cache", fixtures.validationPrivacyId), true);

      await pool.query("UPDATE source_ingestion_record_links SET updated_at=now() WHERE source_id='seed-source' AND external_id LIKE 'external-%'");
      const sourcePolicy = policyWithShortRetention("source_traceability_metadata");
      const sourceService = createPrivacyGovernanceService({ repository, cryptoBox, policy: sourcePolicy });
      const sourcePlan = await sourceService.planRetention({ actorId: ACTOR, snapshotAt: new Date("2026-07-15T11:00:00.000Z") });
      assert.equal(sourcePlan.counts.total, 6);
      assert.equal((await executeWithPolicy(sourceService, sourcePlan)).completed, true);
      assert.equal(await tombstonedByPrivacyId(pool, "source_ingestion_record_links", fixtures.sourceLinkPrivacyId), true);
      assert.equal(await tombstonedByPrivacyId(pool, "source_identity_bindings", fixtures.bindingPrivacyId), true);
      assert.equal(await tombstonedByPrivacyId(pool, "source_identity_claim_items", fixtures.claimItemPrivacyId), true);
      assert.equal(await tombstoned(pool, "source_identity_claims", fixtures.claimId), true);
      assert.equal(await tombstonedByPrivacyId(pool, "crm_intake_receipts", fixtures.crmIntakePrivacyId), true);
      assert.equal(
        (await pool.query(
          "SELECT privacy_tombstoned_at IS NOT NULL AS value FROM source_ingestion_receipts WHERE source_id='seed-source' AND artifact_id='seed-artifact'"
        )).rows[0].value,
        true
      );

      const outcomePolicy = policyWithShortRetention("outcome_metadata");
      const outcomeService = createPrivacyGovernanceService({ repository, cryptoBox, policy: outcomePolicy });
      const outcomePlan = await outcomeService.planRetention({ actorId: ACTOR, snapshotAt: new Date("2026-07-15T11:01:00.000Z") });
      assert.deepEqual(outcomePlan.counts, {
        total: 3,
        planned: 3,
        held: 0,
        byDataClass: { outcome_metadata: { total: 3, planned: 3, held: 0 } }
      });
      assert.equal((await executeWithPolicy(outcomeService, outcomePlan)).completed, true);
      assert.equal(await tombstonedByKey(pool, "crm_delivery_projections", "send_queue_id", fixtures.sendId), true);
      assert.equal(await tombstoned(pool, "outcome_events", fixtures.outcomeId), true);
      const preservedDenial = await pool.query(
        `SELECT genre,contact_id,privacy_tombstoned_at IS NOT NULL AS tombstoned
         FROM contact_genre_denials WHERE contact_hash=$1`,
        [cryptoBox.subjectHash(`contact:${fixtures.contactId}`)]
      );
      assert.equal(preservedDenial.rows[0].genre, fixtures.genre);
      assert.equal(preservedDenial.rows[0].tombstoned, true);
      assert.notEqual(preservedDenial.rows[0].contact_id, fixtures.contactId);

      const exportRace = await service.createDsarRequest({
        requestType: "erasure",
        subjectType: "contact",
        subject: "crm-contact-42",
        requestReference: "dsar-erasure-export-fence-001",
        evidence: { verifiedBy: "restricted-portal" },
        espoMutations: [{
          entityType: "MediaContact",
          entityId: "crm-contact-42",
          expectedVersion: 8,
          mutationType: "erasure_anonymization",
          patch: { name: "[erased]", emailAddress: null }
        }],
        actorId: ACTOR
      });
      const exportRacePlan = await service.planDsarRequest({ requestId: exportRace.requestId, actorId: ACTOR, maximumRecords: 100 });
      const exportFenceHold = await service.createLegalHold({
        subjectType: "contact",
        subject: "crm-contact-42",
        caseReference: "legal-case-export-fence-001",
        evidence: { authority: "test" },
        actorId: ACTOR
      });
      await assert.rejects(
        () => service.exportEspoMutationPlan({ planId: exportRacePlan.espoMutationPlans[0].planId, actorId: ACTOR }),
        (error) => error.code === "PRIVACY_LEGAL_HOLD_ACTIVE"
      );
      await service.releaseLegalHold({
        holdId: exportFenceHold.holdId,
        releaseReference: "legal-release-export-fence-001",
        actorId: ACTOR
      });
      assert.deepEqual(
        await service.closeDsarRequest({
          requestId: exportRace.requestId,
          closureReference: "dsar-closure-export-fence-001",
          actorId: ACTOR
        }),
        { closed: true }
      );
      assert.equal(
        (await pool.query("SELECT status FROM privacy_dsar_requests WHERE id=$1", [exportRace.requestId])).rows[0].status,
        "closed"
      );
      assert.equal(
        (await pool.query("SELECT status FROM privacy_espo_mutation_plans WHERE id=$1", [exportRacePlan.espoMutationPlans[0].planId])).rows[0].status,
        "cancelled"
      );
      assert.deepEqual(
        await service.closeDsarRequest({
          requestId: exportRace.requestId,
          closureReference: "dsar-closure-export-fence-replay-001",
          actorId: ACTOR
        }),
        { closed: false }
      );
      await assert.rejects(
        () => service.exportEspoMutationPlan({ planId: exportRacePlan.espoMutationPlans[0].planId, actorId: ACTOR }),
        (error) => error.code === "PRIVACY_ESPO_PLAN_NOT_EXPORTABLE"
      );

      await service.createLegalHold({
        subjectType: "contact",
        subject: "crm-contact-42",
        caseReference: "legal-case-dsar-erasure-001",
        evidence: { authority: "test" },
        actorId: ACTOR
      });
      const erasure = await service.createDsarRequest({
        requestType: "erasure",
        subjectType: "contact",
        subject: "crm-contact-42",
        requestReference: "dsar-erasure-integration-001",
        evidence: { verifiedBy: "restricted-portal" },
        espoMutations: [{
          entityType: "MediaContact",
          entityId: "crm-contact-42",
          expectedVersion: 7,
          mutationType: "erasure_anonymization",
          patch: { name: "[erased]", emailAddress: null }
        }],
        actorId: ACTOR
      });
      const erasurePlan = await service.planDsarRequest({ requestId: erasure.requestId, actorId: ACTOR, maximumRecords: 100 });
      assert.equal(erasurePlan.status, "blocked");
      assert.equal(
        (await pool.query("SELECT count(*)::int AS count FROM privacy_espo_mutation_plans WHERE request_id=$1", [erasure.requestId])).rows[0].count,
        0
      );
    });
  } finally {
    await pool.end().catch(() => {});
    await cluster.stop();
  }
});

test("new allocation and direct-CRM evidence participate in legal hold and privacy lifecycle", async () => {
  const cluster = await startPostgresTestCluster();
  const database = await cluster.createDatabase();
  const pool = new Pool({ connectionString: database.url, max: 4 });
  const cryptoBox = new CryptoBox({
    encryptionKey: Buffer.alloc(32, 72),
    keyVersion: "privacy-ledger-v1",
    hashKey: "privacy-ledger-integration-hash-key"
  });
  try {
    await applyMigrations(pool, [
      "001_initial.sql", "002_source_ingestion.sql", "003_email_validation_method.sql",
      "004_source_ingestion_fenced_lease.sql", "005_runtime_safety.sql",
      "006_db_workflow_hardening.sql", "007_source_identity_dedup.sql",
      "008_privacy_governance.sql", "009_crm_projection.sql"
    ]);
    await pool.query("CREATE ROLE outreach_privacy_runtime NOLOGIN");
    await applyMigrations(pool, [
      "014_privacy_governance_hardening.sql",
      "015_matching_allocation_hardening.sql",
      "017_direct_crm_intake.sql",
      "018_hash_key_attestation.sql"
    ]);
    const repository = new PrivacyGovernanceRepository({
      pool,
      cryptoBox,
      database: { lockTimeoutMs: 500, statementTimeoutMs: 15_000 }
    });
    const service = createPrivacyGovernanceService({
      repository,
      cryptoBox,
      policy: policyWithShortRetention("queue_routing_metadata")
    });
    assert.equal((await service.preparePrivacyIndex({ actorId: ACTOR, apply: true, batchSize: 100, maxBatches: 100 })).ready, true);

    const contactId = "privacy-ledger-contact";
    const releaseHash = cryptoBox.privacyHash("campaign-outlet-release:privacy-ledger-release");
    const outletHash = cryptoBox.privacyHash("campaign-outlet-outlet:privacy-ledger-outlet");
    const ledgerId = randomUUID();
    await pool.query(
      `INSERT INTO campaign_outlet_allocation_counters
         (release_hash,outlet_hash,allocated_count,created_at,updated_at)
       VALUES ($1,$2,1,'2020-01-01','2020-01-01')`,
      [releaseHash, outletHash]
    );
    await pool.query(
      `INSERT INTO campaign_outlet_allocation_ledger
         (allocation_hash,release_hash,outlet_hash,contact_hash,outlet_subject_hash,recipient_hash,
          privacy_record_id,allocated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'2020-01-01')`,
      [cryptoBox.privacyHash("campaign-outlet-match:privacy-ledger-match"), releaseHash, outletHash,
        cryptoBox.subjectHash(`contact:${contactId}`), cryptoBox.subjectHash("outlet:privacy-ledger-outlet"),
        cryptoBox.privacyHash("email:privacy-ledger@example.test"), ledgerId]
    );

    const hold = await service.createLegalHold({
      subjectType: "contact",
      subject: contactId,
      scopeDataClass: "queue_routing_metadata",
      caseReference: "privacy-ledger-hold-001",
      evidence: { authority: "integration-test" },
      actorId: ACTOR
    });
    const heldPlan = await service.planRetention({ actorId: ACTOR, snapshotAt: new Date("2026-07-15T12:00:00.000Z") });
    assert.deepEqual(heldPlan.counts, {
      total: 2,
      planned: 1,
      held: 1,
      byDataClass: { queue_routing_metadata: { total: 2, planned: 1, held: 1 } }
    });
    assert.equal((await executeWithPolicy(service, heldPlan)).completed, true);
    const retainedCounter = await pool.query(
      `SELECT allocated_count,privacy_tombstoned_at IS NOT NULL AS tombstoned
       FROM campaign_outlet_allocation_counters WHERE release_hash=$1 AND outlet_hash=$2`,
      [releaseHash, outletHash]
    );
    assert.deepEqual(retainedCounter.rows[0], { allocated_count: 2, tombstoned: true });
    assert.equal(await tombstonedByPrivacyId(pool, "campaign_outlet_allocation_ledger", ledgerId), false);

    await service.releaseLegalHold({
      holdId: hold.holdId,
      releaseReference: "privacy-ledger-release-001",
      actorId: ACTOR
    });
    const releasedPlan = await service.planRetention({ actorId: ACTOR, snapshotAt: new Date("2026-07-15T12:01:00.000Z") });
    assert.equal(releasedPlan.counts.total, 1);
    assert.equal((await executeWithPolicy(service, releasedPlan)).completed, true);
    const tombstonedLedger = await pool.query(
      `SELECT allocation_hash,release_hash,outlet_hash,contact_hash,outlet_subject_hash,recipient_hash,
         privacy_tombstoned_at IS NOT NULL AS tombstoned
       FROM campaign_outlet_allocation_ledger WHERE privacy_record_id=$1`,
      [ledgerId]
    );
    assert.equal(tombstonedLedger.rows[0].tombstoned, true);
    assert.equal(new Set([
      tombstonedLedger.rows[0].allocation_hash,
      tombstonedLedger.rows[0].release_hash,
      tombstonedLedger.rows[0].outlet_hash,
      tombstonedLedger.rows[0].contact_hash,
      tombstonedLedger.rows[0].outlet_subject_hash,
      tombstonedLedger.rows[0].recipient_hash
    ]).size, 1);
    assert.equal(retainedCounter.rows[0].allocated_count, 2);

    await pool.query(
      `INSERT INTO sequence_allocations
         (recipient_hash,match_id,release_id,contact_id,outlet_id,status,released_at,cooldown_until,updated_at)
       VALUES ($1,'privacy-ledger-historical-match','privacy-ledger-release',$2,
         'privacy-ledger-outlet','released','2020-01-02','2020-01-03','2020-01-03')`,
      [cryptoBox.privacyHash("email:privacy-ledger-historical@example.test"), contactId]
    );
    const allocationRepository = new OutreachRepository({ pool, cryptoBox });
    const deniedAfterTombstone = await allocationRepository.tryAcquireAllocation({
      email: "privacy-ledger-new@example.test",
      matchId: "privacy-ledger-new-match",
      releaseId: "privacy-ledger-release",
      contactId: "privacy-ledger-new-contact",
      outletId: "privacy-ledger-outlet"
    });
    assert.deepEqual(deniedAfterTombstone, {
      acquired: false,
      reason: "campaign_outlet_lifetime_cap_reached"
    });
    assert.equal((await pool.query(
      `SELECT count(*)::int AS count FROM campaign_outlet_allocation_ledger
        WHERE privacy_tombstoned_at IS NULL AND release_hash=$1 AND outlet_hash=$2`,
      [releaseHash, outletHash]
    )).rows[0].count, 0);

    const traceabilityService = createPrivacyGovernanceService({
      repository,
      cryptoBox,
      policy: policyWithShortRetention("source_traceability_metadata")
    });
    const evidenceContactId = "privacy-evidence-contact";
    const receiptPrivacyId = randomUUID();
    const evidencePrivacyId = randomUUID();
    await pool.query(
      `INSERT INTO crm_intake_receipts
         (entity_type,entity_id,revision_digest,status,result,lease_owner,locked_until,completed_at,
          created_at,updated_at,privacy_record_id)
       VALUES ('MediaContact',$1,$2,'completed','{}'::jsonb,NULL,NULL,'2020-01-02',
         '2020-01-01','2020-01-02',$3)`,
      [evidenceContactId, "3".repeat(64), receiptPrivacyId]
    );
    await pool.query(
      `INSERT INTO purpose_bound_evidence_attestations
         (entity_type,entity_id,entity_version,digest_version,evidence_digest,evidence_captured_at,
          purpose,basis,source_kind,origin_revision_digest,origin_entity_id,status,revocation_reason,
          created_at,updated_at,privacy_record_id)
       VALUES ('MediaContact',$1,3,'purpose-bound-evidence-v1',$2,'2020-01-01',
         'press_outreach','legitimate_interest','direct_crm',$3,$1,'invalid','superseded',
         '2020-01-01','2020-01-02',$4)`,
      [evidenceContactId, "4".repeat(64), "3".repeat(64), evidencePrivacyId]
    );
    const evidenceHold = await traceabilityService.createLegalHold({
      subjectType: "contact",
      subject: evidenceContactId,
      scopeDataClass: "source_traceability_metadata",
      caseReference: "privacy-evidence-hold-001",
      evidence: { authority: "integration-test" },
      actorId: ACTOR
    });
    const evidenceHeldPlan = await traceabilityService.planRetention({
      actorId: ACTOR,
      snapshotAt: new Date("2026-07-15T12:02:00.000Z")
    });
    assert.equal(evidenceHeldPlan.counts.total, 2);
    assert.equal(evidenceHeldPlan.counts.held, 2);
    assert.equal(evidenceHeldPlan.counts.planned, 0);
    await traceabilityService.releaseLegalHold({
      holdId: evidenceHold.holdId,
      releaseReference: "privacy-evidence-release-001",
      actorId: ACTOR
    });
    const evidenceReleasedPlan = await traceabilityService.planRetention({
      actorId: ACTOR,
      snapshotAt: new Date("2026-07-15T12:03:00.000Z")
    });
    assert.equal((await executeWithPolicy(traceabilityService, evidenceReleasedPlan)).completed, true);
    assert.equal(await tombstonedByPrivacyId(pool, "crm_intake_receipts", receiptPrivacyId), true);
    assert.equal(await tombstonedByPrivacyId(pool, "purpose_bound_evidence_attestations", evidencePrivacyId), true);
  } finally {
    await pool.end().catch(() => {});
    await cluster.stop();
  }
});

async function applyMigrations(pool, files) {
  for (const file of files) await pool.query(await readMigration(file));
}

async function readMigration(file) {
  return readFile(join(migrationDirectory.pathname, file), "utf8");
}

async function seedPopulatedNaturalKeyTables(pool, cryptoBox) {
  await pool.query(
    `INSERT INTO sequence_allocations
      (recipient_hash,match_id,release_id,contact_id,outlet_id,status,released_at,cooldown_until,updated_at)
     SELECT md5('recipient-'||value)||md5('recipient-b-'||value),'match-'||value,'release-'||value,
       'contact-'||value,'outlet-'||value,'released','2020-01-01','2020-01-02','2020-01-02'
     FROM generate_series(1,$1) value`,
    [POPULATED_ROWS]
  );
  await pool.query(
    `INSERT INTO source_ingestion_receipts
      (source_id,artifact_id,content_digest,generated_at,status,result,attempts,created_at,updated_at)
     VALUES ('seed-source','seed-artifact',$1,'2020-01-01','completed','{}',1,'2020-01-01','2020-01-01')`,
    ["a".repeat(64)]
  );
  await pool.query(
    `INSERT INTO source_ingestion_record_links
      (source_id,external_id,entity_type,crm_entity_id,artifact_id,evidence_digest,evidence_captured_at,created_at,updated_at)
     SELECT 'seed-source','external-'||value,'MediaContact','crm-'||value,'seed-artifact',
       md5('evidence-'||value)||md5('evidence-b-'||value),'2020-01-01','2020-01-01','2020-01-01'
     FROM generate_series(1,$1) value`,
    [POPULATED_ROWS]
  );
  await pool.query(
    `INSERT INTO email_validation_cache
      (recipient_hash,status,checked_at,expires_at,provider_reference,validator_type,created_at,updated_at)
     SELECT md5('email-'||value)||md5('email-b-'||value),'Unknown','2020-01-01','2020-01-02','seed','http','2020-01-01','2020-01-01'
     FROM generate_series(1,$1) value`,
    [POPULATED_ROWS]
  );
  await pool.query(
    `INSERT INTO suppression_cache(subject_type,subject_hash,reason,source,active)
     VALUES ('email',$1,'unsubscribed','integration',true)`,
    [cryptoBox.privacyHash("email:person@example.com")]
  );
}

async function insertOldEvents(pool, cryptoBox, count, prefix) {
  const ids = [];
  for (let index = 0; index < count; index += 1) {
    const id = randomUUID();
    ids.push(id);
    const externalId = `${prefix}-${index}-${id}`;
    const encrypted = cryptoBox.encryptJson({ marker: externalId }, `mailgun:${externalId}`);
    await pool.query(
      `INSERT INTO encrypted_event_inbox
        (id,source,external_id,event_type,payload_ciphertext,payload_iv,payload_tag,key_version,status,created_at,processed_at)
       VALUES ($1,'mailgun',$2,'delivered',$3,$4,$5,$6,'processed','2020-02-01','2020-02-02')`,
      [id, externalId, encrypted.ciphertext, encrypted.iv, encrypted.tag, encrypted.keyVersion]
    );
  }
  return ids;
}

async function insertOldContactEvents(pool, cryptoBox, contactIds, prefix) {
  const ids = [];
  for (const [index, contactId] of contactIds.entries()) {
    const id = randomUUID();
    ids.push(id);
    const externalId = `${prefix}-${index}-${id}`;
    const encrypted = cryptoBox.encryptJson({ marker: externalId }, `mailgun:${externalId}`);
    await pool.query(
      `INSERT INTO encrypted_event_inbox
        (id,source,external_id,event_type,entity_type,entity_id,payload_ciphertext,payload_iv,payload_tag,key_version,
         status,created_at,processed_at)
       VALUES ($1,'mailgun',$2,'delivered','MediaContact',$3,$4,$5,$6,$7,'processed','2020-02-01','2020-02-02')`,
      [id, externalId, contactId, encrypted.ciphertext, encrypted.iv, encrypted.tag, encrypted.keyVersion]
    );
  }
  return ids;
}

async function insertDsarFixtures(pool, cryptoBox) {
  const contactId = "crm-contact-42";
  const genre = "ambient";
  const copyId = randomUUID();
  const copyHash = "c".repeat(64);
  const copy = cryptoBox.encryptJson({ subject: "Track", bodyText: "Private copy" }, `match-dsar:0:${copyHash}`);
  await pool.query(
    `INSERT INTO copy_artifacts
      (id,match_id,sequence_step,template_version,content_sha256,content_ciphertext,content_iv,content_tag,key_version,validation_status,created_at)
     VALUES ($1,'match-dsar',0,'v1',$2,$3,$4,$5,$6,'valid',now())`,
    [copyId, copyHash, copy.ciphertext, copy.iv, copy.tag, copy.keyVersion]
  );
  const sendId = randomUUID();
  await pool.query(
    `INSERT INTO send_queue
      (id,match_id,release_id,contact_id,recipient_hash,outlet_id,sequence_step,idempotency_key,
       deterministic_message_id,copy_artifact_id,send_at,status,created_at,sent_at)
     VALUES ($1,'match-dsar','release-dsar','crm-contact-42',$2,'outlet-dsar',0,$3,$4,$5,now(),'sent',now(),now())`,
    [sendId, cryptoBox.privacyHash("email:person@example.com"), `idem-${sendId}`, `msg-${sendId}@example.test`, copyId]
  );
  const responseId = randomUUID();
  const responseKey = `response-${responseId}`;
  const response = cryptoBox.encryptJson({ to: "person@example.com", bodyText: "Private response" }, `response:${responseKey}`);
  await pool.query(
    `INSERT INTO response_queue
      (id,match_id,release_id,contact_id,outlet_id,idempotency_key,deterministic_message_id,
       payload_ciphertext,payload_iv,payload_tag,key_version,status,send_at,created_at,sent_at)
     VALUES ($1,'match-dsar','release-dsar','crm-contact-42','outlet-dsar',$2,$3,$4,$5,$6,$7,'sent',now(),now(),now())`,
    [responseId, responseKey, `response-${responseId}@example.test`, response.ciphertext, response.iv, response.tag, response.keyVersion]
  );
  const workId = randomUUID();
  await pool.query(
    `INSERT INTO work_items
      (id,kind,entity_type,entity_id,dedupe_key,payload,status,created_at,completed_at)
     VALUES ($1,'match_contact','MediaContact',$2,$3,$4::jsonb,'completed','2020-01-01','2020-01-02')`,
    [workId, contactId, `dsar-work-${workId}`, JSON.stringify({ contactId, privateMarker: "restricted" })]
  );
  const deliveryId = randomUUID();
  await pool.query(
    `INSERT INTO delivery_attempts
      (id,send_queue_id,attempt_number,status,provider_message_id,correlation_id,started_at,finished_at)
     VALUES ($1,$2,1,'accepted',$3,$4,'2020-01-01','2020-01-02')`,
    [deliveryId, sendId, `provider-${deliveryId}`, `correlation-${deliveryId}`]
  );
  const responseDeliveryId = randomUUID();
  await pool.query(
    `INSERT INTO response_delivery_attempts
      (id,response_queue_id,attempt_number,status,provider_message_id,correlation_id,started_at,finished_at)
     VALUES ($1,$2,1,'accepted',$3,$4,'2020-01-01','2020-01-02')`,
    [responseDeliveryId, responseId, `provider-${responseDeliveryId}`, `correlation-${responseDeliveryId}`]
  );
  const outcomeId = randomUUID();
  await pool.query(
    `INSERT INTO outcome_events
      (id,match_id,send_queue_id,event_type,provider_event_id,occurred_at,created_at)
     VALUES ($1,'match-dsar',$2,'delivered',$3,'2020-01-01','2020-01-01')`,
    [outcomeId, sendId, `outcome-${outcomeId}`]
  );
  const sourceLinkPrivacyId = randomUUID();
  await pool.query(
    `INSERT INTO source_ingestion_record_links
      (source_id,external_id,entity_type,crm_entity_id,artifact_id,evidence_digest,evidence_captured_at,
       created_at,updated_at,privacy_record_id)
     VALUES ('seed-source',$1,'MediaContact',$2,'seed-artifact',$3,'2020-01-01','2020-01-01','2020-01-01',$4)`,
    [`dsar-${sourceLinkPrivacyId}`, contactId, "d".repeat(64), sourceLinkPrivacyId]
  );
  const validationRow = await pool.query(
    `INSERT INTO email_validation_cache
      (recipient_hash,status,checked_at,expires_at,provider_reference,validator_type,created_at,updated_at)
     VALUES ($1,'Valid','2020-01-01','2020-01-02','dsar-validation','http','2020-01-01','2020-01-01')
     RETURNING privacy_record_id`,
    [cryptoBox.privacyHash("person@example.com")]
  );
  const sourceIdentityEmailHash = cryptoBox.privacyHash("source-identity:email:person@example.com");
  const bindingPrivacyId = randomUUID();
  await pool.query(
    `INSERT INTO source_identity_bindings
      (entity_type,identity_type,identity_hash,crm_entity_id,evidence_captured_at,evidence_verified,
       source_id,external_id,created_at,updated_at,privacy_record_id)
     VALUES ('MediaContact','email',$1,$2,'2020-01-01',true,'dsar-source','dsar-external','2020-01-01','2020-01-01',$3)`,
    [sourceIdentityEmailHash, contactId, bindingPrivacyId]
  );
  const claimId = randomUUID();
  await pool.query(
    `INSERT INTO source_identity_claims (id,claim_owner,entity_type,locked_until,created_at)
     VALUES ($1,'dsar-claim-owner','MediaContact','2020-01-02','2020-01-01')`,
    [claimId]
  );
  const claimItemPrivacyId = randomUUID();
  await pool.query(
    `INSERT INTO source_identity_claim_items
      (claim_id,entity_type,identity_type,identity_hash,privacy_record_id)
     VALUES ($1,'MediaContact','email',$2,$3)`,
    [claimId, sourceIdentityEmailHash, claimItemPrivacyId]
  );
  await pool.query(
    `INSERT INTO crm_delivery_projections
      (send_queue_id,match_id,release_id,contact_id,outlet_id,provider_message_id,deterministic_message_id,
       correlation_id,accepted_at,campaign_projection_key,email_projection_key,event_projection_key,status,
       campaign_id,email_id,event_id,created_at,updated_at,completed_at)
     VALUES ($1,'match-dsar','release-dsar',$2,'outlet-dsar',$3,$4,$5,'2020-01-01',$6,$7,$8,
       'completed','campaign-dsar','email-dsar','event-dsar','2020-01-01','2020-01-02','2020-01-02')`,
    [sendId, contactId, `provider-projection-${sendId}`, `projection-${sendId}@example.test`,
      `correlation-projection-${sendId}`, `campaign-projection-${sendId}`, `email-projection-${sendId}`,
      `event-projection-${sendId}`]
  );
  await pool.query(
    `INSERT INTO contact_genre_denials
      (contact_id,genre,source_event_id,match_id,release_id,created_at,contact_hash,source_event_hash,match_hash,release_hash)
     VALUES ($1,$2,'source-event-dsar','match-dsar','release-dsar','2020-01-01',$3,$4,$5,$6)`,
    [contactId, genre, cryptoBox.subjectHash(`contact:${contactId}`),
      cryptoBox.integrityHash("genre-denial-event:source-event-dsar"),
      cryptoBox.integrityHash("genre-denial-match:match-dsar"),
      cryptoBox.integrityHash("genre-denial-release:release-dsar")]
  );
  const campaignReleaseHash = cryptoBox.privacyHash("campaign-outlet-release:release-dsar");
  const campaignOutletHash = cryptoBox.privacyHash("campaign-outlet-outlet:outlet-dsar");
  await pool.query(
    `INSERT INTO campaign_outlet_allocation_counters
       (release_hash,outlet_hash,allocated_count,created_at,updated_at)
     VALUES ($1,$2,1,'2020-01-01','2020-01-01')`,
    [campaignReleaseHash, campaignOutletHash]
  );
  await pool.query(
    `INSERT INTO campaign_outlet_allocation_ledger
       (allocation_hash,release_hash,outlet_hash,contact_hash,outlet_subject_hash,recipient_hash,allocated_at)
     VALUES ($1,$2,$3,$4,$5,$6,'2020-01-01')`,
    [cryptoBox.privacyHash("campaign-outlet-match:match-dsar"), campaignReleaseHash, campaignOutletHash,
      cryptoBox.subjectHash(`contact:${contactId}`), cryptoBox.subjectHash("outlet:outlet-dsar"),
      cryptoBox.privacyHash("email:person@example.com")]
  );
  const crmIntakeRow = await pool.query(
    `INSERT INTO crm_intake_receipts
       (entity_type,entity_id,revision_digest,status,result,lease_owner,locked_until,completed_at,created_at,updated_at)
     VALUES ('MediaContact',$1,$2,'completed',$3::jsonb,NULL,NULL,'2020-01-02','2020-01-01','2020-01-02')
     RETURNING privacy_record_id`,
    [contactId, "1".repeat(64), JSON.stringify({ evidenceAccepted: true })]
  );
  await pool.query(
    `INSERT INTO purpose_bound_evidence_attestations
       (entity_type,entity_id,entity_version,digest_version,evidence_digest,evidence_captured_at,
        purpose,basis,source_kind,origin_revision_digest,origin_entity_id,status,created_at,updated_at)
     VALUES ('MediaContact',$1,7,'purpose-bound-evidence-v1',$2,'2020-01-01',
       'press_outreach','legitimate_interest','direct_crm',$3,$1,'active','2020-01-01','2020-01-02')`,
    [contactId, "2".repeat(64), "1".repeat(64)]
  );
  return Object.freeze({
    contactId,
    genre,
    sendId,
    responseId,
    outcomeId,
    validationPrivacyId: validationRow.rows[0].privacy_record_id,
    sourceLinkPrivacyId,
    bindingPrivacyId,
    claimId,
    claimItemPrivacyId,
    crmIntakePrivacyId: crmIntakeRow.rows[0].privacy_record_id
  });
}

async function tombstoned(pool, table, id) {
  const result = await pool.query(`SELECT privacy_tombstoned_at IS NOT NULL AS value FROM ${table} WHERE id=$1`, [id]);
  return result.rows[0]?.value === true;
}

async function tombstonedByPrivacyId(pool, table, privacyRecordId) {
  const result = await pool.query(
    `SELECT privacy_tombstoned_at IS NOT NULL AS value FROM ${table} WHERE privacy_record_id=$1`,
    [privacyRecordId]
  );
  return result.rows[0]?.value === true;
}

async function tombstonedByKey(pool, table, keyName, keyValue) {
  const allowed = new Set(["send_queue_id"]);
  if (!allowed.has(keyName)) throw new Error("Unsupported tombstone test key");
  const result = await pool.query(
    `SELECT privacy_tombstoned_at IS NOT NULL AS value FROM ${table} WHERE ${keyName}=$1`,
    [keyValue]
  );
  return result.rows[0]?.value === true;
}

async function tombstonedByComposite(pool, table, contactId, genre) {
  const result = await pool.query(
    `SELECT privacy_tombstoned_at IS NOT NULL AS value FROM ${table} WHERE contact_id=$1 AND genre=$2`,
    [contactId, genre]
  );
  return result.rows[0]?.value === true;
}

function policyWithShortRetention(selectedDataClass) {
  return loadPrivacyPolicy({
    OUTREACH_RETENTION_POLICY_JSON: JSON.stringify({
      schemaVersion: 1,
      policyVersion: `privacy-integration-${selectedDataClass}-v1`,
      enabled: true,
      approvedPolicyReference: `privacy-approval-${selectedDataClass}-001`,
      dataClasses: Object.fromEntries(PRIVACY_DATA_CLASSES.map((dataClass) => [dataClass, {
        retentionDays: dataClass === selectedDataClass ? 30 : 36_500,
        minimumRetentionDays: 1,
        maximumRetentionDays: 36_500,
        batchSize: 10,
        maximumRecordsPerPlan: 100
      }]))
    })
  });
}

function executionBinding(plan) {
  return {
    expectedDigest: plan.digest,
    policyDigest: POLICY.digest,
    approvalId: "approval-privacy-integration",
    changeId: "change-privacy-integration",
    recoveryId: "recovery-privacy-integration"
  };
}

function execute(service, plan, overrides = {}) {
  return service.executeRetention({
    planId: plan.planId,
    expectedDigest: plan.digest,
    approvalId: "approval-privacy-integration",
    changeId: "change-privacy-integration",
    recoveryId: "recovery-privacy-integration",
    actorId: ACTOR,
    batchSize: 2,
    maxBatches: 10,
    ...overrides
  });
}

function executeWithPolicy(service, plan) {
  return service.executeRetention({
    planId: plan.planId,
    expectedDigest: plan.digest,
    approvalId: "approval-privacy-specialized",
    changeId: "change-privacy-specialized",
    recoveryId: "recovery-privacy-specialized",
    actorId: ACTOR,
    batchSize: 10,
    maxBatches: 20
  });
}
