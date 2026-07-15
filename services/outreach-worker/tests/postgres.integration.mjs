import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import { createSendService } from "../src/application/send-service.mjs";
import { createMatchService } from "../src/application/match-service.mjs";
import { businessDate } from "../src/application/date-utils.mjs";
import { evaluateContactEvidence, evaluateOutletEvidence } from "../src/domain/evidence-policy.mjs";
import { CryptoBox } from "../src/infrastructure/crypto-box.mjs";
import { reencryptStoredData } from "../src/infrastructure/data-reencryption.mjs";
import { OutreachRepository } from "../src/infrastructure/outreach-repository.mjs";
import { createPostgresPool, runMigrations, withTransaction } from "../src/infrastructure/postgres.mjs";
import { Metrics } from "../src/infrastructure/metrics.mjs";
import { SourceIngestionRepository } from "../src/infrastructure/source-ingestion-repository.mjs";
import { startPostgresTestCluster } from "./helpers/postgres-test-cluster.mjs";

const logger = Object.freeze({ info() {}, warn() {}, error() {} });
const cryptoBox = new CryptoBox({
  encryptionKey: Buffer.alloc(32, 7),
  keyVersion: "integration-test-v1",
  hashKey: "integration-test-privacy-key"
});
let cluster;

describe("PostgreSQL repository contracts", { concurrency: 1 }, () => {
  before(async () => {
    cluster = await startPostgresTestCluster();
  });

  after(async () => {
    await cluster?.stop();
  });

  test("migrations are transactionally idempotent under concurrent startup", async (t) => {
    const { pool } = await createMigratedRepository(t, { migrate: false });

    await Promise.all([runMigrations(pool), runMigrations(pool)]);
    const first = await pool.query("SELECT version, applied_at FROM schema_migrations ORDER BY version");
    await runMigrations(pool);
    const second = await pool.query("SELECT version, applied_at FROM schema_migrations ORDER BY version");

    assert.ok(first.rows.some(({ version }) => version === "001_initial.sql"));
    assert.ok(first.rows.some(({ version }) => version === "012_daily_report_query_indexes.sql"));
    assert.ok(first.rows.some(({ version }) => version === "013_daily_report_work_index.sql"));
    assert.equal(new Set(first.rows.map(({ version }) => version)).size, first.rowCount);
    assert.deepEqual(second.rows, first.rows, "a repeated startup must not reapply or retimestamp a migration");
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM safety_state WHERE name='global-send-circuit'")).rows[0].count, 1);
    assert.deepEqual(
      (await pool.query(
        `SELECT indexrelid::regclass::text AS index_name,indisready,indisvalid
         FROM pg_index
         WHERE indexrelid IN (
           'outcome_events_report_window_idx'::regclass,
           'work_items_report_window_idx'::regclass
         )
         ORDER BY index_name`
      )).rows,
      [
        { index_name: "outcome_events_report_window_idx", indisready: true, indisvalid: true },
        { index_name: "work_items_report_window_idx", indisready: true, indisvalid: true }
      ],
      "online report indexes must be ready and valid before the migration is recorded"
    );
  });

  test("send capacity fails closed when the durable safety circuit row is unavailable", async (t) => {
    const { pool, repository } = await createMigratedRepository(t);
    const copyArtifactId = await saveCopy(repository);
    assert.equal((await repository.tryAcquireAllocation({
      email: "circuit@radio.example",
      matchId: "match-circuit",
      releaseId: "release-circuit",
      contactId: "contact-circuit",
      outletId: "outlet-circuit"
    })).acquired, true);
    await repository.enqueueSend({
      matchId: "match-circuit",
      releaseId: "release-circuit",
      contactId: "contact-circuit",
      outletId: "outlet-circuit",
      recipientEmail: "circuit@radio.example",
      sequenceStep: 0,
      idempotencyKey: "send-circuit",
      deterministicMessageId: "<send-circuit@example.test>",
      copyArtifactId,
      sendAt: new Date(Date.now() - 1_000)
    });
    const claimed = await repository.claimSend("circuit-worker");
    await pool.query("DELETE FROM safety_state WHERE name='global-send-circuit'");

    const result = await repository.reserveSendCapacity(claimed, "radio.example", {
      dailyLimit: 25,
      releaseLimit: 25,
      domainLimit: 2,
      businessDate: businessDate()
    });

    assert.deepEqual(result, { allowed: false, reason: "circuit_state_unavailable" });
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM send_counters")).rows[0].count, 0);
  });

  test("safety-critical ingress opens the circuit in the same durable transaction", async (t) => {
    const { pool, repository } = await createMigratedRepository(t);
    const received = await repository.receiveEvent({
      source: "mailgun",
      externalId: "signed-complaint-1",
      eventType: "complained",
      entityType: "MailgunEvent",
      entityId: "complaint-1",
      payload: { event: "complained" },
      workKind: "process_mailgun_event",
      priority: 0,
      openCircuitReason: "signed_mailgun_complaint:test"
    });

    assert.equal(received.circuitOpened, true);
    assert.deepEqual(
      (await pool.query("SELECT state,reason FROM safety_state WHERE name='global-send-circuit'")).rows[0],
      { state: "open", reason: "signed_mailgun_complaint:test" }
    );
    assert.deepEqual(
      (await pool.query("SELECT priority,status FROM work_items WHERE payload->>'eventInboxId'=$1", [received.id])).rows[0],
      { priority: 0, status: "pending" }
    );
  });

  test("capacity reservation and finalization retain the explicit Amsterdam business date across midnight", async (t) => {
    const { pool, repository } = await createMigratedRepository(t);
    const copyArtifactId = await saveCopy(repository);
    await repository.tryAcquireAllocation({
      email: "midnight@radio.example",
      matchId: "match-midnight",
      releaseId: "release-midnight",
      contactId: "contact-midnight",
      outletId: "outlet-midnight"
    });
    await repository.enqueueSend({
      matchId: "match-midnight",
      releaseId: "release-midnight",
      contactId: "contact-midnight",
      outletId: "outlet-midnight",
      recipientEmail: "midnight@radio.example",
      sequenceStep: 0,
      idempotencyKey: "send-midnight",
      deterministicMessageId: "<send-midnight@example.test>",
      copyArtifactId,
      sendAt: new Date(Date.now() - 1_000)
    });
    const claimed = await repository.claimSend("midnight-worker");
    const approvedDate = "2025-10-26";
    assert.equal((await repository.reserveSendCapacity(claimed, "radio.example", {
      dailyLimit: 5,
      releaseLimit: 5,
      domainLimit: 5,
      businessDate: approvedDate
    })).allowed, true);
    const correlationId = await repository.beginDeliveryAttempt(claimed);
    assert.equal(await repository.markSendAccepted(claimed, correlationId, "provider-midnight"), true);

    const reservation = (await pool.query(
      "SELECT counter_date::text,status FROM send_capacity_reservations WHERE send_queue_id=$1",
      [claimed.id]
    )).rows[0];
    assert.deepEqual(reservation, { counter_date: approvedDate, status: "consumed" });
    assert.deepEqual(
      (await pool.query("SELECT DISTINCT counter_date::text AS counter_date FROM send_counters")).rows,
      [{ counter_date: approvedDate }]
    );
  });

  test("provider acceptance atomically persists one replay-safe CRM projection receipt and work item", async (t) => {
    const { pool, repository } = await createMigratedRepository(t);
    const copyArtifactId = await saveCopy(repository);
    assert.equal((await repository.tryAcquireAllocation({
      email: "receipt@radio.example",
      matchId: "match-crm-receipt",
      releaseId: "release-crm-receipt",
      contactId: "contact-crm-receipt",
      outletId: "outlet-crm-receipt"
    })).acquired, true);
    await repository.enqueueSend({
      matchId: "match-crm-receipt",
      releaseId: "release-crm-receipt",
      contactId: "contact-crm-receipt",
      outletId: "outlet-crm-receipt",
      recipientEmail: "receipt@radio.example",
      sequenceStep: 0,
      idempotencyKey: "crm-receipt-send",
      deterministicMessageId: "<crm-receipt@mail.example.test>",
      copyArtifactId,
      sendAt: new Date(Date.now() - 1_000)
    });
    const claimed = await repository.claimSend("crm-receipt-worker");
    const correlationId = await repository.beginDeliveryAttempt(claimed);

    assert.equal(await repository.markSendAccepted(claimed, correlationId, "provider-crm-receipt"), true);
    assert.equal(await repository.markSendAccepted(claimed, correlationId, "provider-crm-receipt"), false);

    const projection = (await pool.query(
      `SELECT send_queue_id::text,match_id,release_id,contact_id,outlet_id,provider_message_id,
              deterministic_message_id,correlation_id,campaign_projection_key,email_projection_key,
              event_projection_key,status,target_list_status
       FROM crm_delivery_projections WHERE send_queue_id=$1`,
      [claimed.id]
    )).rows[0];
    assert.deepEqual(projection, {
      send_queue_id: claimed.id,
      match_id: "match-crm-receipt",
      release_id: "release-crm-receipt",
      contact_id: "contact-crm-receipt",
      outlet_id: "outlet-crm-receipt",
      provider_message_id: "provider-crm-receipt",
      deterministic_message_id: "<crm-receipt@mail.example.test>",
      correlation_id: correlationId,
      campaign_projection_key: "music-release:release-crm-receipt",
      email_projection_key: `send:${claimed.id}`,
      event_projection_key: `sent:${claimed.id}`,
      status: "pending",
      target_list_status: "review_required"
    });
    const work = (await pool.query(
      "SELECT kind,entity_type,entity_id,dedupe_key,payload,status FROM work_items WHERE dedupe_key=$1",
      [`crm-delivery:${claimed.id}`]
    )).rows[0];
    assert.equal(work.kind, "sync_delivery_to_crm");
    assert.equal(work.entity_type, "OutreachMatch");
    assert.equal(work.entity_id, "match-crm-receipt");
    assert.equal(work.status, "pending");
    assert.equal(work.payload.sendQueueId, claimed.id);
    assert.equal(work.payload.providerMessageId, "provider-crm-receipt");
    assert.equal(work.payload.correlationId, correlationId);

    await pool.query("DELETE FROM work_items WHERE dedupe_key=$1", [`crm-delivery:${claimed.id}`]);
    const reconciled = await repository.reconcileCrmProjectionWork({ limit: 10 });
    assert.equal(reconciled.deliveryWork, 1);
    assert.equal((await pool.query(
      "SELECT count(*)::int AS count FROM work_items WHERE dedupe_key=$1",
      [`crm-delivery:${claimed.id}`]
    )).rows[0].count, 1);
  });

  test("delivery-unknown evidence uses the stable provider-attempt receipt", async (t) => {
    const { repository } = await createMigratedRepository(t);
    const copyArtifactId = await saveCopy(repository);
    assert.equal((await repository.tryAcquireAllocation({
      email: "unknown@radio.example",
      matchId: "match-unknown-evidence",
      releaseId: "release-unknown-evidence",
      contactId: "contact-unknown-evidence",
      outletId: "outlet-unknown-evidence"
    })).acquired, true);
    await repository.enqueueSend({
      matchId: "match-unknown-evidence",
      releaseId: "release-unknown-evidence",
      contactId: "contact-unknown-evidence",
      outletId: "outlet-unknown-evidence",
      recipientEmail: "unknown@radio.example",
      sequenceStep: 0,
      idempotencyKey: "unknown-evidence-send",
      deterministicMessageId: "<unknown-evidence@mail.example.test>",
      copyArtifactId,
      sendAt: new Date(Date.now() - 1_000)
    });
    const claimed = await repository.claimSend("unknown-evidence-worker");
    const correlationId = await repository.beginDeliveryAttempt(claimed);
    assert.equal(await repository.markSendFailure(claimed, correlationId, {
      code: "MAILGUN_TIMEOUT",
      retryable: false,
      deliveryUnknown: true
    }), true);

    const first = await repository.getDeliveryUnknownEvidence(claimed.id);
    const second = await repository.getDeliveryUnknownEvidence(claimed.id);
    assert.equal(first.correlation_id, correlationId);
    assert.equal(first.attempt_number, 1);
    assert.equal(first.error_code, "MAILGUN_TIMEOUT");
    assert.equal(first.occurred_at.toISOString(), second.occurred_at.toISOString());
  });

  test("concurrent genre-denial writes converge to a deny-wins contact union", async (t) => {
    const { pool, repository } = await createMigratedRepository(t);
    await Promise.all([
      repository.recordContactGenreDenials({
        contactId: "contact-denials",
        genres: ["Indie", "Rock"],
        sourceEventId: "reply-denial-1",
        matchId: "match-denial-1",
        releaseId: "release-denial-1"
      }),
      repository.recordContactGenreDenials({
        contactId: "contact-denials",
        genres: ["Electronic", "INDIE"],
        sourceEventId: "reply-denial-2",
        matchId: "match-denial-2",
        releaseId: "release-denial-2"
      })
    ]);

    assert.deepEqual(await repository.getContactGenreDenials("contact-denials"), ["electronic", "indie", "rock"]);
    assert.equal(await repository.hasContactGenreDenial("contact-denials", ["Indie"]), true);
    assert.equal(await repository.hasContactGenreDenial("contact-denials", ["Jazz"]), false);
    assert.equal((await pool.query(
      "SELECT count(*)::int AS count FROM contact_genre_denials WHERE contact_id='contact-denials'"
    )).rows[0].count, 3);
  });

  test("human-review evidence is encrypted and decisions remain attributable", async (t) => {
    const { pool, repository } = await createMigratedRepository(t);
    const id = await repository.enqueueHumanReview({
      reviewType: "outlet_suppression_proposal",
      source: "inbound_reply",
      sourceEventId: "reply-review-1",
      matchId: "match-1",
      contactId: "contact-1",
      outletId: "outlet-1",
      reason: "Not Accepting Music",
      proposedAction: "review_outlet_and_domain_suppression",
      evidence: { replySnippet: "Do not submit music to this inbox." },
      createdBy: "reply-policy-v2"
    });
    const stored = (await pool.query(
      "SELECT evidence_ciphertext,status,decision,decided_by FROM human_review_items WHERE id=$1",
      [id]
    )).rows[0];
    assert.equal(stored.evidence_ciphertext.includes(Buffer.from("Do not submit")), false);
    assert.deepEqual({ status: stored.status, decision: stored.decision, decided_by: stored.decided_by }, {
      status: "pending", decision: null, decided_by: null
    });
    assert.deepEqual(await repository.readHumanReviewEvidence(id), {
      replySnippet: "Do not submit music to this inbox."
    });
    const decision = await repository.decideHumanReview({
      id,
      decision: "rejected",
      reason: "Message applied to one desk only; no domain suppression.",
      actor: "privacy-owner@example.test"
    });
    assert.equal(decision.status, "rejected");
    assert.equal(decision.decided_by, "privacy-owner@example.test");
  });

  test("priority-isolated claims keep safety events ahead of matching work", async (t) => {
    const { repository } = await createMigratedRepository(t);
    await repository.enqueueWork({
      kind: "match_release",
      entityType: "MusicRelease",
      entityId: "release-1",
      dedupeKey: "lane-match",
      priority: 0
    });
    await repository.enqueueWork({
      kind: "process_mailgun_event",
      entityType: "MailgunEvent",
      entityId: "complaint-1",
      dedupeKey: "lane-safety",
      priority: 50
    });
    const safety = await repository.claimWork("safety-lane", 120, { kinds: ["process_mailgun_event"] });
    const matching = await repository.claimWork("matching-lane", 120, { kinds: ["match_release"] });
    assert.equal(safety.kind, "process_mailgun_event");
    assert.equal(matching.kind, "match_release");
  });

  test("concurrent replicas reserve at most one first email per outlet for fourteen days", async (t) => {
    const { pool, repository } = await createMigratedRepository(t);
    const allocationAttempts = await Promise.all([
      repository.tryAcquireAllocation({
        email: "desk-a@radio.example",
        matchId: "match-outlet-a",
        releaseId: "release-a",
        contactId: "contact-a",
        outletId: "shared-outlet",
        maxActivePerOutlet: 1,
        outletCooldownDays: 14
      }),
      repository.tryAcquireAllocation({
        email: "desk-b@radio.example",
        matchId: "match-outlet-b",
        releaseId: "release-b",
        contactId: "contact-b",
        outletId: "shared-outlet",
        maxActivePerOutlet: 1,
        outletCooldownDays: 14
      })
    ]);
    assert.equal(allocationAttempts.filter(({ acquired }) => acquired).length, 1, "allocation lock must fence the outlet race");
    const allocationWinner = allocationAttempts.find(({ acquired }) => acquired);
    await pool.query(
      `UPDATE sequence_allocations SET status='released',initial_sent_at=now(),released_at=now()
       WHERE match_id=$1`,
      [allocationWinner.matchId]
    );
    assert.deepEqual(await repository.tryAcquireAllocation({
      email: "desk-c@radio.example",
      matchId: "match-outlet-c",
      releaseId: "release-c",
      contactId: "contact-c",
      outletId: "shared-outlet",
      maxActivePerOutlet: 1,
      outletCooldownDays: 14
    }), { acquired: false, reason: "outlet_first_send_cooldown_active" });

    // Exercise the independent last-moment fence even if upstream state is
    // malformed or imported concurrently: two claimed first sends with the
    // same outlet still cannot both reach the provider.
    for (const suffix of ["one", "two"]) {
      const matchId = `guard-match-${suffix}`;
      const email = `guard-${suffix}@radio.example`;
      await repository.tryAcquireAllocation({
        email,
        matchId,
        releaseId: `guard-release-${suffix}`,
        contactId: `guard-contact-${suffix}`,
        outletId: `allocation-outlet-${suffix}`
      });
      const copyArtifactId = await saveCopy(repository);
      await repository.enqueueSend({
        matchId,
        releaseId: `guard-release-${suffix}`,
        contactId: `guard-contact-${suffix}`,
        outletId: "shared-pre-send-outlet",
        recipientEmail: email,
        sequenceStep: 0,
        idempotencyKey: `guard-send-${suffix}`,
        deterministicMessageId: `<guard-send-${suffix}@example.test>`,
        copyArtifactId,
        sendAt: new Date(Date.now() - 1_000)
      });
    }
    const claimed = await Promise.all([
      repository.claimSend("guard-worker-one"),
      repository.claimSend("guard-worker-two")
    ]);
    const capacity = await Promise.all(claimed.map((item) => repository.reserveSendCapacity(item, "radio.example", {
      dailyLimit: 20,
      releaseLimit: 20,
      domainLimit: 20,
      businessDate: businessDate(),
      outletCooldownDays: 14
    })));
    assert.equal(capacity.filter(({ allowed }) => allowed).length, 1);
    assert.equal(capacity.find(({ allowed }) => !allowed)?.reason, "outlet_first_send_cooldown_active");
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM outlet_first_send_guards WHERE status='reserved'")).rows[0].count, 1);
    assert.equal((await pool.query("SELECT sum(sent_count)::int AS total FROM send_counters WHERE counter_type='global'")).rows[0].total, 1);
  });

  test("every suppression subject type fences an in-flight send authorization", async (t) => {
    const { repository } = await createMigratedRepository(t);
    let enteredFence;
    let releaseFence;
    const entered = new Promise((resolve) => { enteredFence = resolve; });
    const release = new Promise((resolve) => { releaseFence = resolve; });

    const heldFence = repository.withSendAuthorizationFence({
      contactId: "contact-1",
      outletId: "outlet-1",
      email: "Editor@Radio.Example",
      domain: "Radio.Example"
    }, async () => {
      enteredFence();
      await release;
    });
    await entered;

    let suppressionCompleted = false;
    const suppression = repository.suppress({
      subjectType: "outlet",
      subject: "OUTLET-1",
      reason: "manual_block",
      source: "integration_test"
    }).then(() => { suppressionCompleted = true; });
    await delay(75);
    assert.equal(suppressionCompleted, false, "a suppression must wait until provider authorization has left its fence");

    releaseFence();
    await Promise.all([heldFence, suppression]);
    assert.equal(await repository.isSuppressed({ outletId: "outlet-1" }), true);
  });

  test("legacy migration checkpoint binds scope and never regresses", async (t) => {
    const { pool, repository } = await createMigratedRepository(t);
    const contract = {
      runId: "legacy-leads-v2-integration:5",
      migrationVersion: "legacy-leads-v2",
      sourceDigest: "a".repeat(64),
      scopeLimit: 5
    };
    const started = await repository.beginLegacyMigrationRun(contract);
    assert.equal(started.status, "running");
    assert.equal(started.nextOffset, 0);

    await repository.checkpointLegacyMigration(contract.runId, 4, { completedOperations: 4 });
    await repository.checkpointLegacyMigration(contract.runId, 2, { completedOperations: 2 });
    const checkpoint = await pool.query("SELECT next_contact_offset,counters FROM legacy_migration_runs WHERE run_id=$1", [contract.runId]);
    assert.equal(checkpoint.rows[0].next_contact_offset, 4);
    assert.equal(checkpoint.rows[0].counters.completedOperations, 4);

    await assert.rejects(
      () => repository.beginLegacyMigrationRun({ ...contract, scopeLimit: 6 }),
      (error) => error.code === "LEGACY_MIGRATION_CHECKPOINT_MISMATCH"
    );
    await repository.finishLegacyMigrationRun(contract.runId, { succeeded: true, counters: { completedOperations: 4 } });
    const complete = await repository.beginLegacyMigrationRun(contract);
    assert.equal(complete.status, "succeeded");
    await assert.rejects(
      () => repository.finishLegacyMigrationRun(contract.runId, { succeeded: false, counters: {}, errorCode: "LATE_FAILURE" }),
      (error) => error.code === "LEGACY_MIGRATION_CHECKPOINT_MISMATCH"
    );
  });

  test("concurrent replicas acquire one active sequence per normalized email", async (t) => {
    const { pool, repository } = await createMigratedRepository(t);
    const secondReplica = new OutreachRepository({ pool, cryptoBox });
    const variants = [
      " Editor@Radio.Example ",
      "editor@radio.example",
      "EDITOR@RADIO.EXAMPLE",
      "\teditor@radio.example\n"
    ];

    const attempts = await Promise.all(Array.from({ length: 24 }, (_, index) => {
      const contender = {
        email: variants[index % variants.length],
        matchId: `match-${index}`,
        releaseId: `release-${index}`,
        contactId: `contact-${index}`,
        outletId: `outlet-${index}`
      };
      return (index % 2 ? repository : secondReplica).tryAcquireAllocation(contender);
    }));

    const winners = attempts.map((result, index) => ({ ...result, index })).filter(({ acquired }) => acquired);
    assert.equal(winners.length, 1, "only one replica may own an active sequence for an email identity");
    const winner = winners[0];
    const allocationRows = await pool.query("SELECT * FROM sequence_allocations");
    assert.equal(allocationRows.rowCount, 1);
    assert.match(allocationRows.rows[0].recipient_hash, /^[a-f0-9]{64}$/u);
    assert.deepEqual(
      Object.keys(allocationRows.rows[0]).filter((column) => /email/iu.test(column)),
      [],
      "raw recipient addresses must not enter the technical database"
    );

    const idempotentRetry = await repository.tryAcquireAllocation({
      email: "editor@radio.example",
      matchId: `match-${winner.index}`,
      releaseId: `release-${winner.index}`,
      contactId: `contact-${winner.index}`,
      outletId: `outlet-${winner.index}`
    });
    assert.equal(idempotentRetry.acquired, true, "the current owner must be able to retry allocation idempotently");

    await repository.releaseAllocation({
      matchId: `match-${winner.index}`,
      cooldownUntil: new Date(Date.now() + 60_000),
      reason: "sequence_completed"
    });
    const duringCooldown = await secondReplica.tryAcquireAllocation({
      email: "EDITOR@RADIO.EXAMPLE",
      matchId: "match-after-release",
      releaseId: "release-after-release",
      contactId: "contact-after-release",
      outletId: "outlet-after-release"
    });
    assert.equal(duringCooldown.acquired, false, "release must retain the configured contact cooldown");
  });

  test("campaign/outlet lifetime ledger remains capped at two beyond the fourteen-day window", async (t) => {
    const { pool, repository } = await createMigratedRepository(t);
    const pair = { releaseId: "release-lifetime-cap", outletId: "outlet-lifetime-cap" };
    for (let index = 1; index <= 2; index += 1) {
      const matchId = `match-lifetime-${index}`;
      const result = await repository.tryAcquireAllocation({
        ...pair,
        email: `lifetime-${index}@radio.example`,
        matchId,
        contactId: `contact-lifetime-${index}`,
        maxActivePerOutlet: 10
      });
      assert.equal(result.acquired, true);
      await repository.releaseAllocation({
        matchId,
        cooldownUntil: new Date(Date.now() - 22 * 86_400_000),
        reason: "integration_sequence_completed"
      });
      await pool.query(
        "UPDATE sequence_allocations SET initial_sent_at=now()-interval '15 days' WHERE match_id=$1",
        [matchId]
      );
    }

    const third = await repository.tryAcquireAllocation({
      ...pair,
      email: "lifetime-3@radio.example",
      matchId: "match-lifetime-3",
      contactId: "contact-lifetime-3",
      maxActivePerOutlet: 10
    });
    assert.deepEqual(third, { acquired: false, reason: "campaign_outlet_lifetime_cap_reached" });
    assert.equal((await pool.query("SELECT allocated_count FROM campaign_outlet_allocation_counters")).rows[0].allocated_count, 2);
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM campaign_outlet_allocation_ledger")).rows[0].count, 2);
  });

  test("parallel campaign/outlet allocations across replicas converge to exactly two", async (t) => {
    const { pool, repository } = await createMigratedRepository(t);
    const replicas = Array.from({ length: 8 }, () => new OutreachRepository({ pool, cryptoBox }));
    const attempts = await Promise.all(replicas.map((replica, index) => replica.tryAcquireAllocation({
      email: `parallel-cap-${index}@radio.example`,
      matchId: `match-parallel-cap-${index}`,
      releaseId: "release-parallel-cap",
      contactId: `contact-parallel-cap-${index}`,
      outletId: "outlet-parallel-cap",
      maxActivePerOutlet: 10
    })));

    assert.equal(attempts.filter(({ acquired }) => acquired).length, 2);
    assert.equal(attempts.filter(({ reason }) => reason === "campaign_outlet_lifetime_cap_reached").length, 6);
    assert.equal((await pool.query("SELECT allocated_count FROM campaign_outlet_allocation_counters")).rows[0].allocated_count, 2);
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM campaign_outlet_allocation_ledger")).rows[0].count, 2);

    const winner = attempts.findIndex(({ acquired }) => acquired);
    assert.equal((await replicas[0].tryAcquireAllocation({
      email: `parallel-cap-${winner}@radio.example`,
      matchId: `match-parallel-cap-${winner}`,
      releaseId: "release-parallel-cap",
      contactId: `contact-parallel-cap-${winner}`,
      outletId: "outlet-parallel-cap",
      maxActivePerOutlet: 10
    })).acquired, true, "an exact winner replay must not consume a third lifetime slot");
  });

  test("concurrent release events compare the complete active set and allocate the deterministic best release", async (t) => {
    const { pool, repository } = await createMigratedRepository(t);
    const secondReplica = new OutreachRepository({ pool, cryptoBox });
    const contact = {
      id: "contact-multi-release",
      name: "Sam Editor",
      firstName: "Sam",
      emailAddress: "multi-release@radio.example",
      status: "Active",
      mediaOutletId: "outlet-multi-release",
      preferredLanguage: "en",
      timezone: "Europe/Amsterdam",
      contactSourceUrl: "https://radio.example/submissions",
      contactEvidence: "The outlet explicitly publishes this submission address.",
      contactPurpose: "Explicit Music Submission",
      contactBasis: "Explicit Submission Address",
      emailValidationStatus: "Valid",
      lastValidatedAt: "2026-07-01T00:00:00.000Z",
      previousPositiveReply: true
    };
    const outlet = {
      id: "outlet-multi-release",
      name: "Multi Release Radio",
      website: "https://radio.example",
      country: "NL",
      language: "en",
      timezone: "Europe/Amsterdam",
      genres: ["indie"],
      subGenres: ["dream pop"],
      formatGenres: ["indie"],
      submissionPolicy: "Explicit",
      acceptsEmail: true,
      activityStatus: "Active"
    };
    const release = (id, { priority, genres = ["indie"] } = {}) => ({
      id,
      name: id,
      artistName: "Marc Rene",
      status: "Active",
      genres,
      subGenres: genres.includes("indie") ? ["dream pop"] : [],
      languages: genres.includes("indie") ? ["en"] : [],
      territories: genres.includes("indie") ? ["NL"] : [],
      epkUrl: `https://artist.example/${id}`,
      priority
    });
    const activeReleases = [
      release("release-high-priority-low-score", { priority: 100, genres: ["techno"] }),
      release("release-b", { priority: 20 }),
      release("release-a", { priority: 20 })
    ];
    const matchesByKey = new Map();
    const matchesById = new Map();
    const crm = {
      async get(entityType, id) {
        if (entityType === "MediaContact" && id === contact.id) return contact;
        if (entityType === "MediaOutlet" && id === outlet.id) return outlet;
        if (entityType === "MusicRelease") throw new Error("release event hints must not scope contact matching");
        throw new Error(`unexpected CRM get ${entityType}/${id}`);
      },
      async list(entityType, options) {
        if (entityType === "MusicRelease") return activeReleases;
        if (entityType === "OutreachMatch") {
          if (options.where.some(({ attribute }) => attribute === "lastSentAt")) return [];
          return [...matchesById.values()];
        }
        throw new Error(`unexpected CRM list ${entityType}`);
      },
      async upsertByUnique(entityType, _attribute, key, payload) {
        if (entityType === "OutreachEvent") return { id: key, ...payload };
        if (entityType !== "OutreachMatch") throw new Error(`unexpected CRM upsert ${entityType}`);
        const current = matchesByKey.get(key);
        const record = {
          ...current,
          ...payload,
          id: current?.id ?? `match-${payload.musicReleaseId}`,
          versionNumber: (current?.versionNumber ?? 0) + 1
        };
        matchesByKey.set(key, record);
        matchesById.set(record.id, record);
        return { ...record };
      },
      async updateConditional(entityType, id, patch, versionNumber) {
        assert.equal(entityType, "OutreachMatch");
        const current = matchesById.get(id);
        if (!current || current.versionNumber !== versionNumber) {
          throw Object.assign(new Error("version conflict"), { statusCode: 409 });
        }
        const updated = { ...current, ...patch, versionNumber: versionNumber + 1 };
        matchesById.set(id, updated);
        matchesByKey.set(updated.idempotencyKey, updated);
        return { ...updated };
      }
    };
    const config = {
      policy: { outletCooldownDays: 14, matchThreshold: 80, waitlistThreshold: 65, maxFollowUps: 2 },
      mailgun: { domain: "mail.example.test" }
    };
    const serviceFor = (ownedRepository) => createMatchService({
      espocrm: crm,
      repository: ownedRepository,
      contactIntakeService: attestedIntakeService(crm),
      copyService: {
        async prepare({ match }) {
          const artifactId = await ownedRepository.saveCopyArtifact({
            matchId: match.id,
            sequenceStep: 0,
            templateVersion: "multi-release-test-v1",
            copy: { subject: "Winner", bodyText: "Deterministic winner" },
            contentHash: `content-${match.id}`,
            validationStatus: "valid",
            confidence: 1
          });
          return { artifactId, templateVersion: "multi-release-test-v1" };
        }
      },
      config,
      logger,
      metrics: new Metrics()
    });

    const outcomes = await Promise.all([
      serviceFor(repository).processContact(contact.id, { releaseId: "release-high-priority-low-score" }),
      serviceFor(secondReplica).processContact(contact.id, { releaseId: "release-b" })
    ]);

    assert.equal(outcomes.reduce((sum, outcome) => sum + outcome.allocated, 0), 1);
    assert.deepEqual(
      (await pool.query("SELECT release_id,contact_id,outlet_id,status FROM sequence_allocations")).rows,
      [{
        release_id: "release-a",
        contact_id: contact.id,
        outlet_id: outlet.id,
        status: "active"
      }]
    );
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM send_queue")).rows[0].count, 1);
  });

  test("preexisting send history rebuilds the lifetime cap and fails closed on historical overflow", async (t) => {
    const first = await createMigratedRepository(t);
    await insertHistoricalCampaignOutletSends(first.pool, first.repository, {
      releaseId: "release-history-two",
      outletId: "outlet-history-two",
      count: 2
    });
    const capped = await first.repository.tryAcquireAllocation({
      email: "history-new@radio.example",
      matchId: "match-history-new",
      releaseId: "release-history-two",
      contactId: "contact-history-new",
      outletId: "outlet-history-two",
      maxActivePerOutlet: 10
    });
    assert.deepEqual(capped, { acquired: false, reason: "campaign_outlet_lifetime_cap_reached" });
    assert.equal((await first.pool.query("SELECT count(*)::int AS count FROM campaign_outlet_allocation_ledger")).rows[0].count, 2);

    const overflow = await createMigratedRepository(t);
    await insertHistoricalCampaignOutletSends(overflow.pool, overflow.repository, {
      releaseId: "release-history-overflow",
      outletId: "outlet-history-overflow",
      count: 3
    });
    await assert.rejects(
      () => overflow.repository.tryAcquireAllocation({
        email: "history-overflow-new@radio.example",
        matchId: "match-history-overflow-new",
        releaseId: "release-history-overflow",
        contactId: "contact-history-overflow-new",
        outletId: "outlet-history-overflow",
        maxActivePerOutlet: 10
      }),
      (error) => error.code === "CAMPAIGN_OUTLET_HISTORICAL_CAP_EXCEEDED"
    );
    assert.equal((await overflow.pool.query("SELECT count(*)::int AS count FROM campaign_outlet_allocation_ledger")).rows[0].count, 0);
    assert.equal((await overflow.pool.query("SELECT count(*)::int AS count FROM campaign_outlet_allocation_counters")).rows[0].count, 0);
  });

  test("send queue deduplicates by release, recipient hash, and sequence step", async (t) => {
    const { pool, repository } = await createMigratedRepository(t);
    const copyArtifactId = await saveCopy(repository);
    const allocation = await repository.tryAcquireAllocation({
      email: "editor@radio.example",
      matchId: "match-1",
      releaseId: "release-1",
      contactId: "contact-1",
      outletId: "outlet-1"
    });
    assert.equal(allocation.acquired, true);
    const common = {
      releaseId: "release-1",
      outletId: "outlet-1",
      sequenceStep: 0,
      copyArtifactId,
      sendAt: new Date(Date.now() - 1_000)
    };

    const inserted = await Promise.all([
      repository.enqueueSend({
        ...common,
        matchId: "match-1",
        contactId: "contact-1",
        recipientEmail: "Editor@Radio.Example",
        idempotencyKey: "send-a",
        deterministicMessageId: "<send-a@example.test>"
      }),
      repository.enqueueSend({
        ...common,
        matchId: "match-1",
        contactId: "contact-duplicate",
        recipientEmail: " editor@radio.example ",
        idempotencyKey: "send-b",
        deterministicMessageId: "<send-b@example.test>"
      })
    ]);
    assert.equal(inserted.filter(Boolean).length, 1, "duplicate CRM contacts must not produce duplicate recipient sends");

    const stepOneCopyArtifactId = await saveCopy(repository, 1);
    const stepOne = await repository.enqueueSend({
      ...common,
      matchId: "match-1",
      contactId: "contact-1",
      recipientEmail: "editor@radio.example",
      sequenceStep: 1,
      copyArtifactId: stepOneCopyArtifactId,
      idempotencyKey: "send-step-1",
      deterministicMessageId: "<send-step-1@example.test>"
    });
    await repository.releaseAllocation({ matchId: "match-1", cooldownUntil: new Date(0), reason: "integration_test" });
    assert.equal((await repository.tryAcquireAllocation({
      email: "editor@radio.example",
      matchId: "match-2",
      releaseId: "release-2",
      contactId: "contact-1",
      outletId: "outlet-1"
    })).acquired, true);
    const otherRelease = await repository.enqueueSend({
      ...common,
      matchId: "match-2",
      releaseId: "release-2",
      contactId: "contact-1",
      recipientEmail: "editor@radio.example",
      idempotencyKey: "send-release-2",
      deterministicMessageId: "<send-release-2@example.test>"
    });
    assert.equal((await repository.tryAcquireAllocation({
      email: "other@radio.example",
      matchId: "match-3",
      releaseId: "release-1",
      contactId: "contact-3",
      outletId: "outlet-2"
    })).acquired, true);
    const otherRecipient = await repository.enqueueSend({
      ...common,
      matchId: "match-3",
      contactId: "contact-3",
      recipientEmail: "other@radio.example",
      idempotencyKey: "send-other-recipient",
      deterministicMessageId: "<send-other-recipient@example.test>"
    });

    assert.ok(stepOne);
    assert.ok(otherRelease);
    assert.ok(otherRecipient);
    const rows = await pool.query("SELECT release_id,recipient_hash,sequence_step FROM send_queue ORDER BY id");
    assert.equal(rows.rowCount, 4);
    assert.equal(new Set(rows.rows.map(({ recipient_hash: hash }) => hash)).size, 2);
  });

  test("work completion and failure are fenced by lease ownership", async (t) => {
    const { pool, repository } = await createMigratedRepository(t);
    await repository.enqueueWork({
      kind: "integration_test",
      entityType: "MusicRelease",
      entityId: "release-1",
      dedupeKey: "lease-fence-1"
    });

    const firstLease = await repository.claimWork("worker-a", 120);
    assert.equal(firstLease.locked_by, "worker-a");

    const forgedLease = { ...firstLease, locked_by: "worker-b" };
    await repository.completeWork(forgedLease);
    await repository.failWork(forgedLease, "WRONG_OWNER_FAILURE", false);
    let stored = (await pool.query("SELECT status,locked_by,last_error_code FROM work_items WHERE id=$1", [firstLease.id])).rows[0];
    assert.deepEqual(stored, { status: "processing", locked_by: "worker-a", last_error_code: null });

    await pool.query("UPDATE work_items SET locked_until=now()-interval '1 second' WHERE id=$1", [firstLease.id]);
    const secondLease = await repository.claimWork("worker-a", 120);
    assert.equal(secondLease.id, firstLease.id);
    assert.equal(secondLease.locked_by, "worker-a");
    assert.equal(secondLease.attempts, 2);
    assert.ok(secondLease.lease_version > firstLease.lease_version);

    await repository.completeWork(firstLease);
    stored = (await pool.query("SELECT status,locked_by,last_error_code FROM work_items WHERE id=$1", [firstLease.id])).rows[0];
    assert.deepEqual(stored, { status: "processing", locked_by: "worker-a", last_error_code: null });

    await repository.failWork(firstLease, "STALE_OWNER_FAILURE", false);
    stored = (await pool.query("SELECT status,locked_by,last_error_code FROM work_items WHERE id=$1", [firstLease.id])).rows[0];
    assert.deepEqual(stored, { status: "processing", locked_by: "worker-a", last_error_code: null });

    await repository.completeWork(secondLease);
    stored = (await pool.query("SELECT status,locked_by,completed_at IS NOT NULL AS completed FROM work_items WHERE id=$1", [firstLease.id])).rows[0];
    assert.deepEqual(stored, { status: "completed", locked_by: null, completed: true });
  });

  test("shutdown releases pre-provider leases but quarantines attempts that reached the provider phase", async (t) => {
    const { pool, repository } = await createMigratedRepository(t);
    async function claimedSend(suffix, workerId) {
      const matchId = `shutdown-match-${suffix}`;
      const email = `shutdown-${suffix}@radio.example`;
      await repository.tryAcquireAllocation({
        email,
        matchId,
        releaseId: `shutdown-release-${suffix}`,
        contactId: `shutdown-contact-${suffix}`,
        outletId: `shutdown-outlet-${suffix}`
      });
      const copyArtifactId = await saveCopy(repository);
      await repository.enqueueSend({
        matchId,
        releaseId: `shutdown-release-${suffix}`,
        contactId: `shutdown-contact-${suffix}`,
        outletId: `shutdown-outlet-${suffix}`,
        recipientEmail: email,
        sequenceStep: 0,
        idempotencyKey: `shutdown-send-${suffix}`,
        deterministicMessageId: `<shutdown-send-${suffix}@example.test>`,
        copyArtifactId,
        sendAt: new Date(Date.now() - 1_000)
      });
      const item = await repository.claimSend(workerId);
      assert.equal((await repository.reserveSendCapacity(item, "radio.example", {
        dailyLimit: 10,
        releaseLimit: 10,
        domainLimit: 10,
        businessDate: businessDate(),
        outletCooldownDays: 14
      })).allowed, true);
      return item;
    }

    const safe = await claimedSend("safe", "shutdown-safe-worker");
    const safeResult = await repository.relinquishWorkerLeases(["shutdown-safe-worker"]);
    assert.equal(safeResult.safeSends, 1);
    assert.deepEqual((await pool.query(
      `SELECT q.status AS queue_status,r.status AS reservation_status,g.status AS guard_status
       FROM send_queue q
       JOIN send_capacity_reservations r ON r.send_queue_id=q.id
       JOIN outlet_first_send_guards g ON g.send_queue_id=q.id
       WHERE q.id=$1`,
      [safe.id]
    )).rows[0], { queue_status: "ready", reservation_status: "released", guard_status: "released" });

    const uncertain = await claimedSend("uncertain", "shutdown-unknown-worker");
    await repository.beginDeliveryAttempt(uncertain);
    const unknownResult = await repository.relinquishWorkerLeases(["shutdown-unknown-worker"]);
    assert.equal(unknownResult.unknownSends, 1);
    assert.deepEqual((await pool.query(
      `SELECT q.status AS queue_status,r.status AS reservation_status,g.status AS guard_status,a.status AS attempt_status
       FROM send_queue q
       JOIN send_capacity_reservations r ON r.send_queue_id=q.id
       JOIN outlet_first_send_guards g ON g.send_queue_id=q.id
       JOIN delivery_attempts a ON a.send_queue_id=q.id
       WHERE q.id=$1`,
      [uncertain.id]
    )).rows[0], {
      queue_status: "delivery_unknown",
      reservation_status: "consumed",
      guard_status: "consumed",
      attempt_status: "delivery_unknown"
    });
  });

  test("event inbox failure follows its fenced work item through retry and dead letter", async (t) => {
    const { pool, repository } = await createMigratedRepository(t);
    const received = await repository.receiveEvent({
      source: "mailgun",
      externalId: "event-work-lifecycle-1",
      eventType: "complained",
      entityType: "MailgunEvent",
      entityId: "provider-event-1",
      payload: { event: "complained" },
      workKind: "process_mailgun_event"
    });
    const firstLease = await repository.claimWork("event-worker-a", 120);
    assert.equal(firstLease.payload.eventInboxId, received.id);

    assert.equal(await repository.failWork(firstLease, "CRM_TEMPORARY_FAILURE", true), true);
    let lifecycle = (await pool.query(
      `SELECT w.status AS work_status,i.status AS inbox_status,i.attempts,i.last_error_code
         FROM work_items w
         JOIN encrypted_event_inbox i ON i.id=(w.payload->>'eventInboxId')::uuid
        WHERE w.id=$1`,
      [firstLease.id]
    )).rows[0];
    assert.deepEqual(lifecycle, {
      work_status: "failed",
      inbox_status: "failed",
      attempts: 1,
      last_error_code: "CRM_TEMPORARY_FAILURE"
    });

    await pool.query("UPDATE work_items SET available_at=now()-interval '1 second' WHERE id=$1", [firstLease.id]);
    const secondLease = await repository.claimWork("event-worker-b", 120);
    assert.equal(await repository.failWork(secondLease, "EVENT_CONTRACT_INVALID", false), true);
    lifecycle = (await pool.query(
      `SELECT w.status AS work_status,i.status AS inbox_status,i.attempts,i.last_error_code
         FROM work_items w
         JOIN encrypted_event_inbox i ON i.id=(w.payload->>'eventInboxId')::uuid
        WHERE w.id=$1`,
      [firstLease.id]
    )).rows[0];
    assert.deepEqual(lifecycle, {
      work_status: "dead_letter",
      inbox_status: "dead_letter",
      attempts: 2,
      last_error_code: "EVENT_CONTRACT_INVALID"
    });
  });

  test("bounded data re-encryption rotates every encrypted table and is idempotent", async (t) => {
    const { pool } = await createMigratedRepository(t);
    const historicalKey = Buffer.alloc(32, 17);
    const activeKey = Buffer.alloc(32, 23);
    const hashKey = "integration-data-rotation-hash-key";
    const historicalBox = new CryptoBox({ encryptionKey: historicalKey, keyVersion: "v1", hashKey });
    const historicalRepository = new OutreachRepository({ pool, cryptoBox: historicalBox });
    const event = await historicalRepository.receiveEvent({
      source: "mailgun",
      externalId: "rotation-event-1",
      eventType: "delivered",
      entityType: "MailgunEvent",
      entityId: "provider-rotation-1",
      payload: { event: "delivered", private: "event evidence" },
      workKind: "process_mailgun_event"
    });
    const copyId = await historicalRepository.saveCopyArtifact({
      matchId: "rotation-match-1",
      sequenceStep: 0,
      templateVersion: "rotation-template-v1",
      copy: { subject: "Rotation", bodyText: "Encrypted copy" },
      contentHash: "rotation-content-hash-1",
      validationStatus: "valid",
      confidence: 1
    });
    const responseId = await historicalRepository.enqueueResponse({
      matchId: "rotation-match-1",
      releaseId: "rotation-release-1",
      contactId: "rotation-contact-1",
      outletId: "rotation-outlet-1",
      idempotencyKey: "rotation-response-1",
      deterministicMessageId: "<rotation-response-1@example.test>",
      payload: { to: "editor@example.test", bodyText: "Encrypted response" }
    });
    const humanReviewId = await historicalRepository.enqueueHumanReview({
      reviewType: "ambiguous_reply",
      source: "mailgun",
      sourceEventId: "rotation-event-1",
      matchId: "rotation-match-1",
      contactId: "rotation-contact-1",
      outletId: "rotation-outlet-1",
      reason: "rotation evidence",
      evidence: { replySnippet: "Encrypted review evidence" }
    });
    const rotatingBox = new CryptoBox({
      encryptionKey: activeKey,
      keyVersion: "v2",
      decryptionKeys: { v1: historicalKey },
      hashKey
    });

    const preview = await reencryptStoredData({ pool, cryptoBox: rotatingBox });
    assert.equal(preview.applied, false);
    assert.equal(preview.versions.encrypted_event_inbox.v1, 1);
    assert.equal(preview.versions.copy_artifacts.v1, 1);
    assert.equal(preview.versions.response_queue.v1, 1);
    assert.equal(preview.versions.human_review_items.v1, 1);

    const bounded = await reencryptStoredData({
      pool,
      cryptoBox: rotatingBox,
      apply: true,
      batchSize: 1,
      maxBatches: 1
    });
    assert.equal(Object.values(bounded.updated).reduce((sum, count) => sum + count, 0), 1);

    const completed = await reencryptStoredData({
      pool,
      cryptoBox: rotatingBox,
      apply: true,
      batchSize: 1,
      maxBatches: 9
    });
    assert.deepEqual(completed.versionsAfter, {
      encrypted_event_inbox: { v2: 1 },
      copy_artifacts: { v2: 1 },
      response_queue: { v2: 1 },
      human_review_items: { v2: 1 },
      privacy_legal_holds: {},
      privacy_dsar_requests: {},
      privacy_dsar_artifacts: {},
      privacy_espo_mutation_plans: {}
    });
    const rotatingRepository = new OutreachRepository({ pool, cryptoBox: rotatingBox });
    assert.deepEqual((await rotatingRepository.readEvent(event.id)).payload, { event: "delivered", private: "event evidence" });
    assert.deepEqual(await rotatingRepository.readCopyArtifact(copyId), {
      subject: "Rotation",
      bodyText: "Encrypted copy",
      templateVersion: "rotation-template-v1",
      promptVersion: null,
      authorizationSnapshotDigest: null,
      authorizationSnapshotVersion: null
    });
    const response = (await pool.query("SELECT * FROM response_queue WHERE id=$1", [responseId])).rows[0];
    assert.deepEqual(rotatingRepository.readResponsePayload(response), { to: "editor@example.test", bodyText: "Encrypted response" });
    assert.deepEqual(await rotatingRepository.readHumanReviewEvidence(humanReviewId), {
      replySnippet: "Encrypted review evidence"
    });

    const repeated = await reencryptStoredData({
      pool,
      cryptoBox: rotatingBox,
      apply: true,
      batchSize: 10,
      maxBatches: 3
    });
    assert.deepEqual(repeated.updated, {
      encrypted_event_inbox: 0,
      copy_artifacts: 0,
      response_queue: 0,
      human_review_items: 0,
      privacy_legal_holds: 0,
      privacy_dsar_requests: 0,
      privacy_dsar_artifacts: 0,
      privacy_espo_mutation_plans: 0
    });
  });

  test("a deferred preflight creates no delivery attempt and consumes no retry", async (t) => {
    const { pool, repository } = await createMigratedRepository(t);
    const copyArtifactId = await saveCopy(repository, 1);
    assert.equal((await repository.tryAcquireAllocation({
      email: "editor@radio.example",
      matchId: "match-preflight",
      releaseId: "release-preflight",
      contactId: "contact-preflight",
      outletId: "outlet-preflight"
    })).acquired, true);
    await repository.enqueueSend({
      matchId: "match-preflight",
      releaseId: "release-preflight",
      contactId: "contact-preflight",
      outletId: "outlet-preflight",
      recipientEmail: "editor@radio.example",
      sequenceStep: 1,
      idempotencyKey: "preflight-defer",
      deterministicMessageId: "<preflight-defer@example.test>",
      copyArtifactId,
      sendAt: new Date(Date.now() - 1_000)
    });
    const records = authoritativeRecords({ campaignStatus: "Ready" });
    let providerCalls = 0;
    const service = createSendService({
      espocrm: { async get(entityType) { return records[entityType]; } },
      repository,
      contactIntakeRepository: { async getEvidenceAttestation() { return undefined; } },
      mailgun: { async send() { providerCalls += 1; throw new Error("provider must not be called"); } },
      config: {
        safety: { killSwitch: false, sendEnabled: true, dailySendLimit: 25, domainDailyLimit: 2 },
        mailgun: { domain: "mail.example.test" }
      },
      logger,
      metrics: new Metrics()
    });

    const result = await service.sendOne("preflight-worker");

    assert.equal(result.error, "PREVIOUS_SEQUENCE_STEP_NOT_CONFIRMED");
    assert.equal(providerCalls, 0);
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM delivery_attempts")).rows[0].count, 0);
    const queue = (await pool.query("SELECT status,attempts,locked_by,locked_until,last_error_code FROM send_queue")).rows[0];
    assert.deepEqual(queue, {
      status: "ready",
      attempts: 0,
      locked_by: null,
      locked_until: null,
      last_error_code: "PREVIOUS_SEQUENCE_STEP_NOT_CONFIRMED"
    });
  });

  test("source ingestion receipts fence replays, collisions and cached validations", async (t) => {
    const { pool } = await createMigratedRepository(t);
    const repository = new SourceIngestionRepository({ pool });
    const timestamp = new Date();
    const nonce = {
      sourceId: "dj-finder",
      nonce: "postgres-nonce-1234567890",
      timestamp,
      ttlSeconds: 600
    };
    assert.equal(await repository.reserveNonce(nonce), true);
    assert.equal(await repository.reserveNonce(nonce), false);

    const artifact = {
      sourceId: "dj-finder",
      artifactId: "artifact-integration-1",
      contentDigest: "a".repeat(64),
      generatedAt: timestamp
    };
    const claimed = await repository.beginArtifact({ ...artifact, leaseOwner: "source-worker-a", leaseSeconds: 120 });
    assert.equal(claimed.claimed, true);
    assert.equal(claimed.completed, false);
    assert.equal(claimed.lease.leaseOwner, "source-worker-a");
    assert.equal(claimed.lease.leaseVersion, 1);
    await repository.completeArtifact({
      ...claimed.lease,
      result: { records: 2 }
    });
    assert.deepEqual(await repository.beginArtifact(artifact), {
      claimed: false,
      completed: true,
      result: { records: 2 }
    });
    await assert.rejects(
      repository.beginArtifact({ ...artifact, contentDigest: "b".repeat(64) }),
      (error) => error.code === "SOURCE_ARTIFACT_ID_COLLISION"
    );

    const recipientHash = "c".repeat(64);
    await repository.putEmailValidation({
      recipientHash,
      status: "Valid",
      checkedAt: timestamp,
      providerReference: "provider-check-1",
      ttlDays: 30
    });
    const cached = await repository.getEmailValidation(recipientHash);
    assert.equal(cached.status, "Valid");
    assert.equal(cached.providerReference, "provider-check-1");
    assert.equal(cached.method, "http");
    assert.equal(
      (await pool.query("SELECT count(*)::int AS count FROM source_ingestion_nonces")).rows[0].count,
      1
    );
  });

  test("source ingestion lease theft fences heartbeat, links, fail and completion", async (t) => {
    const { pool } = await createMigratedRepository(t);
    const repository = new SourceIngestionRepository({ pool });
    const artifact = {
      sourceId: "dj-finder",
      artifactId: "artifact-fenced-lease-1",
      contentDigest: "d".repeat(64),
      generatedAt: new Date()
    };
    const first = await repository.beginArtifact({
      ...artifact,
      leaseOwner: "source-worker-a",
      leaseSeconds: 120
    });
    assert.equal(await repository.renewArtifactLease({ ...first.lease, leaseSeconds: 180 }), true);
    await pool.query(
      `UPDATE source_ingestion_receipts
          SET locked_until=now()-interval '1 second'
        WHERE source_id=$1 AND artifact_id=$2`,
      [artifact.sourceId, artifact.artifactId]
    );
    const second = await repository.beginArtifact({
      ...artifact,
      leaseOwner: "source-worker-b",
      leaseSeconds: 120
    });
    assert.equal(second.lease.leaseOwner, "source-worker-b");
    assert.ok(second.lease.leaseVersion > first.lease.leaseVersion);
    assert.equal(await repository.renewArtifactLease({ ...first.lease, leaseSeconds: 120 }), false);

    const link = {
      sourceId: artifact.sourceId,
      artifactId: artifact.artifactId,
      externalId: "outlet-1",
      entityType: "MediaOutlet",
      crmEntityId: "crm-outlet-1",
      evidenceDigest: "e".repeat(64),
      evidenceCapturedAt: new Date()
    };
    await assert.rejects(
      repository.linkRecord({ ...link, leaseOwner: first.lease.leaseOwner, leaseVersion: first.lease.leaseVersion }),
      (error) => error.code === "SOURCE_ARTIFACT_LEASE_LOST"
    );
    assert.equal(await repository.failArtifact({ ...first.lease, errorCode: "STALE_FAILURE" }), false);
    await assert.rejects(
      repository.completeArtifact({ ...first.lease, result: { records: 1 } }),
      (error) => error.code === "SOURCE_ARTIFACT_LEASE_LOST"
    );
    assert.equal(
      (await pool.query("SELECT count(*)::int AS count FROM source_ingestion_record_links")).rows[0].count,
      0
    );

    await repository.linkRecord({ ...link, ...second.lease });
    await repository.completeArtifact({ ...second.lease, result: { records: 1 } });
    const stored = (await pool.query(
      `SELECT status,lease_owner,locked_until,lease_version,result
         FROM source_ingestion_receipts
        WHERE source_id=$1 AND artifact_id=$2`,
      [artifact.sourceId, artifact.artifactId]
    )).rows[0];
    assert.equal(stored.status, "completed");
    assert.equal(stored.lease_owner, null);
    assert.equal(stored.locked_until, null);
    assert.equal(Number(stored.lease_version), second.lease.leaseVersion);
    assert.deepEqual(stored.result, { records: 1 });
  });

  test("PostgreSQL statements and advisory locks fail within bounded retryable policies", async (t) => {
    const database = await cluster.createDatabase();
    const pool = createPostgresPool({
      url: database.url,
      ssl: false,
      statementTimeoutMs: 250,
      queryTimeoutMs: 500,
      lockTimeoutMs: 50,
      idleInTransactionTimeoutMs: 1_000,
      advisoryLockTimeoutMs: 100,
      advisoryLockRetryMs: 10
    });
    t.after(async () => pool.end());
    await runMigrations(pool);

    const statementStarted = Date.now();
    await assert.rejects(
      withTransaction(pool, (client) => client.query("SELECT pg_sleep(2)")),
      (error) => error.code === "POSTGRES_STATEMENT_TIMEOUT" && error.retryable === true
    );
    assert.ok(Date.now() - statementStarted < 1_000, "statement timeout must release the connection promptly");

    const holder = await pool.connect();
    await holder.query("SELECT pg_advisory_lock(hashtext($1))", ["outreach-send-authorization:contact:locked-contact"]);
    try {
      const repository = new OutreachRepository({
        pool,
        cryptoBox,
        database: { advisoryLockTimeoutMs: 100, advisoryLockRetryMs: 10 }
      });
      let entered = false;
      const lockStarted = Date.now();
      await assert.rejects(
        repository.withSendAuthorizationFence({ contactId: "locked-contact" }, async () => { entered = true; }),
        (error) => error.code === "POSTGRES_ADVISORY_LOCK_TIMEOUT" && error.retryable === true
      );
      assert.equal(entered, false);
      assert.ok(Date.now() - lockStarted < 1_000, "advisory contention must not consume a pool slot indefinitely");
    } finally {
      await holder.query("SELECT pg_advisory_unlock(hashtext($1))", ["outreach-send-authorization:contact:locked-contact"]).catch(() => {});
      holder.release();
    }
  });

  test("reconcile workflow ownership is singleton, resumable and fenced across replicas", async (t) => {
    const { pool, repository } = await createMigratedRepository(t);
    const secondReplica = new OutreachRepository({ pool, cryptoBox });
    const input = {
      leaseName: "outreach-full-reconcile",
      workflowName: "outreach-full-reconcile",
      scopeKind: "full",
      watermarkFrom: new Date(0),
      watermarkTo: new Date("2026-07-15T12:00:00Z"),
      leaseSeconds: 120
    };
    const contenders = await Promise.all([
      repository.acquireReconcileWorkflow({ ...input, ownerId: "replica-a" }),
      secondReplica.acquireReconcileWorkflow({ ...input, ownerId: "replica-b" })
    ]);
    const first = contenders.find(({ acquired }) => acquired);
    const rejected = contenders.find(({ acquired }) => !acquired);
    assert.ok(first);
    assert.deepEqual(rejected, { acquired: false, reason: "lease_held" });

    await repository.checkpointReconcileWorkflow(first, {
      routeIndex: 2,
      cursor: { modifiedAt: "2026-07-15T10:30:00Z", id: "contact-0042" },
      counters: { MusicRelease: 12, MediaOutlet: 30, MediaContact: 42 },
      leaseSeconds: 120
    });
    await pool.query(
      "UPDATE workflow_leases SET locked_until=now()-interval '1 second' WHERE lease_name=$1",
      [input.leaseName]
    );

    const takeover = await secondReplica.acquireReconcileWorkflow({
      ...input,
      ownerId: first.ownerId === "replica-a" ? "replica-b" : "replica-a",
      watermarkTo: new Date("2026-07-15T13:00:00Z")
    });
    assert.equal(takeover.acquired, true);
    assert.equal(takeover.resumed, true);
    assert.ok(takeover.fenceToken > first.fenceToken);
    assert.equal(takeover.watermarkTo.toISOString(), "2026-07-15T12:00:00.000Z");
    assert.equal(takeover.routeIndex, 2);
    assert.deepEqual(takeover.cursor, { modifiedAt: "2026-07-15T10:30:00.000Z", id: "contact-0042" });
    assert.equal(takeover.counters.MediaContact, 42);

    await assert.rejects(
      repository.checkpointReconcileWorkflow(first, {
        routeIndex: 4,
        cursor: { modifiedAt: "2026-07-15T11:00:00Z", id: "stale" },
        counters: {},
        leaseSeconds: 120
      }),
      (error) => error.code === "RECONCILE_LEASE_LOST"
    );
    await secondReplica.checkpointReconcileWorkflow(takeover, {
      routeIndex: 4,
      cursor: { modifiedAt: "2026-07-15T11:00:00Z", id: "suppression-9" },
      counters: { ...takeover.counters, OutreachSuppression: 9 },
      leaseSeconds: 120
    });
    await assert.rejects(
      repository.completeReconcileWorkflow(first, {
        routeIndex: 5,
        counters: {},
        watermarkName: "espocrm-business-records",
        watermarkValue: input.watermarkTo
      }),
      (error) => error.code === "RECONCILE_LEASE_LOST"
    );
    await secondReplica.completeReconcileWorkflow(takeover, {
      routeIndex: 5,
      counters: { ...takeover.counters, OutreachSuppression: 9 },
      watermarkName: "espocrm-business-records",
      watermarkValue: takeover.watermarkTo
    });

    const stored = (await pool.query(
      `SELECT owner_id,locked_until,fence_token,route_index,cursor_modified_at,cursor_id,
              checkpoint_status,checkpoint_version
         FROM workflow_leases WHERE lease_name=$1`,
      [input.leaseName]
    )).rows[0];
    assert.equal(stored.owner_id, null);
    assert.equal(stored.locked_until, null);
    assert.equal(Number(stored.fence_token), takeover.fenceToken);
    assert.equal(stored.route_index, 5);
    assert.equal(stored.cursor_modified_at, null);
    assert.equal(stored.cursor_id, null);
    assert.equal(stored.checkpoint_status, "succeeded");
    assert.ok(Number(stored.checkpoint_version) >= 3);
    assert.equal(
      (await pool.query("SELECT value FROM watermarks WHERE name='espocrm-business-records'")).rows[0].value.toISOString(),
      takeover.watermarkTo.toISOString()
    );
  });
});

async function createMigratedRepository(t, { migrate = true } = {}) {
  const database = await cluster.createDatabase();
  const pool = createPostgresPool({ url: database.url, ssl: false });
  t.after(async () => pool.end());
  if (migrate) await runMigrations(pool);
  return { pool, repository: new OutreachRepository({ pool, cryptoBox }) };
}

async function saveCopy(repository, sequenceStep = 0) {
  return repository.saveCopyArtifact({
    matchId: `copy-match-${sequenceStep}`,
    sequenceStep,
    templateVersion: "integration-test-v1",
    promptVersion: undefined,
    copy: { subject: "A safe subject", bodyText: "A deterministic test body." },
    contentHash: `content-hash-${sequenceStep}`,
    validationStatus: "valid",
    confidence: 1
  });
}

async function insertHistoricalCampaignOutletSends(pool, repository, { releaseId, outletId, count }) {
  const copyArtifactId = await repository.saveCopyArtifact({
    matchId: `history-copy-${releaseId}`,
    sequenceStep: 0,
    templateVersion: "history-test-v1",
    copy: { subject: "Historical", bodyText: "Historical allocation evidence" },
    contentHash: `history-content-${releaseId}`,
    validationStatus: "valid",
    confidence: 1
  });
  for (let index = 0; index < count; index += 1) {
    const recipientHash = cryptoBox.privacyHash(`email:history-${releaseId}-${index}@radio.example`);
    await pool.query(
      `INSERT INTO send_queue
        (match_id,release_id,contact_id,recipient_hash,outlet_id,sequence_step,idempotency_key,
         deterministic_message_id,copy_artifact_id,send_at,status,created_at,sent_at)
       VALUES ($1,$2,$3,$4,$5,0,$6,$7,$8,now()-interval '30 days','sent',
               now()-interval '30 days',now()-interval '30 days')`,
      [
        `match-history-${releaseId}-${index}`,
        releaseId,
        `contact-history-${releaseId}-${index}`,
        recipientHash,
        outletId,
        `history-send-${releaseId}-${index}`,
        `<history-send-${releaseId}-${index}@example.test>`,
        copyArtifactId
      ]
    );
  }
}

function attestedIntakeService(espocrm) {
  const capturedAt = new Date().toISOString();
  const activeAttestation = (evaluation) => ({
    ...evaluation.attestation,
    evidenceDigest: evaluation.digest,
    status: "active",
    sourceKind: "signed_source",
    originCompleted: true
  });
  return {
    async processContact(id) {
      const raw = await espocrm.get("MediaContact", id);
      const record = {
        ...raw,
        versionNumber: Number.isInteger(raw.versionNumber) ? raw.versionNumber : 1,
        proofCapturedAt: capturedAt,
        contactEvidence: "The outlet publishes this address for music submissions."
      };
      const evaluation = evaluateContactEvidence({
        entityId: record.id,
        entityVersion: record.versionNumber,
        email: record.emailAddress,
        purpose: record.contactPurpose,
        basis: record.contactBasis,
        sourceUrl: record.contactSourceUrl,
        evidenceText: record.contactEvidence,
        capturedAt,
        now: new Date(capturedAt),
        sourceKind: "signed_source"
      });
      return {
        canonicalId: record.id,
        record,
        attestation: activeAttestation(evaluation),
        attested: evaluation.allowed
      };
    },
    async processOutlet(id) {
      const raw = await espocrm.get("MediaOutlet", id);
      const record = {
        ...raw,
        versionNumber: Number.isInteger(raw.versionNumber) ? raw.versionNumber : 1,
        sourceUrl: `${String(raw.website).replace(/\/$/u, "")}/submissions`,
        submissionEvidence: "The outlet accepts music submissions by email.",
        lastValidatedAt: capturedAt
      };
      const evaluation = evaluateOutletEvidence({
        entityId: record.id,
        entityVersion: record.versionNumber,
        submissionPolicy: record.submissionPolicy,
        sourceUrl: record.sourceUrl,
        evidenceText: record.submissionEvidence,
        capturedAt,
        now: new Date(capturedAt),
        sourceKind: "signed_source"
      });
      return {
        canonicalId: record.id,
        record,
        attestation: activeAttestation(evaluation),
        attested: evaluation.allowed
      };
    }
  };
}

function authoritativeRecords({ campaignStatus }) {
  return Object.freeze({
    OutreachMatch: { id: "match-preflight", campaignStatus },
    MusicRelease: { id: "release-preflight", status: "Active", epkUrl: "https://artist.example.test/epk" },
    MediaContact: {
      id: "contact-preflight",
      emailAddress: "editor@radio.example",
      emailValidationStatus: "Valid",
      contactPurpose: "Explicit Music Submission",
      contactBasis: "Explicit Submission Address",
      contactSourceUrl: "https://radio.example/submissions",
      contactEvidence: "Music submissions are accepted by email."
    },
    MediaOutlet: {
      id: "outlet-preflight",
      website: "https://radio.example",
      activityStatus: "Active",
      submissionPolicy: "Explicit",
      acceptsEmail: true
    }
  });
}
