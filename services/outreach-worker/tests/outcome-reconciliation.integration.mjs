import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import { createOutcomeReconcileService } from "../src/application/outcome-reconcile-service.mjs";
import { canonicalMailgunEventId } from "../src/domain/provider-event-identity.mjs";
import { CryptoBox } from "../src/infrastructure/crypto-box.mjs";
import { Metrics } from "../src/infrastructure/metrics.mjs";
import { OutcomeReconcileRepository } from "../src/infrastructure/outcome-reconcile-repository.mjs";
import { OutreachRepository } from "../src/infrastructure/outreach-repository.mjs";
import { createPostgresPool, runMigrations } from "../src/infrastructure/postgres.mjs";
import { startPostgresTestCluster } from "./helpers/postgres-test-cluster.mjs";

const logger = Object.freeze({ info() {}, warn() {}, error() {} });
const cryptoBox = new CryptoBox({
  encryptionKey: Buffer.alloc(32, 12),
  keyVersion: "v-test-outcome",
  hashKey: Buffer.alloc(32, 13)
});
let cluster;

describe("provider outcome reconciliation PostgreSQL contracts", { concurrency: 1 }, () => {
  before(async () => {
    cluster = await startPostgresTestCluster();
  });

  after(async () => {
    await cluster?.stop();
  });

  test("one fenced owner resumes an identical fixed window/cursor after a crash", async (t) => {
    const { pool, outcomeRepository } = await migrated(t);
    const first = await outcomeRepository.acquire({
      ownerId: "replica-a",
      watermarkFrom: new Date("2026-07-15T09:55:00Z"),
      watermarkTo: new Date("2026-07-15T11:00:00Z"),
      leaseSeconds: 60
    });
    assert.equal(first.acquired, true);
    assert.deepEqual(await outcomeRepository.acquire({
      ownerId: "replica-b",
      watermarkFrom: new Date("2026-07-15T10:55:00Z"),
      watermarkTo: new Date("2026-07-15T12:00:00Z"),
      leaseSeconds: 60
    }), { acquired: false, reason: "lease_held" });

    await outcomeRepository.checkpoint(first, {
      routeIndex: 0,
      cursor: { timestamp: "2026-07-15T10:30:00.000Z", id: "opaque-event-id" },
      pageToken: "opaque_page_token",
      counters: { mailgunSeen: 12 },
      leaseSeconds: 60
    });
    await outcomeRepository.fail(first, { counters: { mailgunSeen: 12 }, errorCode: "SIMULATED_CRASH" });

    const resumed = await outcomeRepository.acquire({
      ownerId: "replica-b",
      watermarkFrom: new Date("2026-07-15T10:55:00Z"),
      watermarkTo: new Date("2026-07-15T12:00:00Z"),
      leaseSeconds: 60
    });
    assert.equal(resumed.acquired, true);
    assert.equal(resumed.resumed, true);
    assert.equal(resumed.watermarkFrom.toISOString(), first.watermarkFrom.toISOString());
    assert.equal(resumed.watermarkTo.toISOString(), first.watermarkTo.toISOString());
    assert.deepEqual(resumed.cursor, { timestamp: "2026-07-15T10:30:00.000Z", id: "opaque-event-id" });
    assert.equal(resumed.pageToken, "opaque_page_token");
    assert.equal(resumed.counters.mailgunSeen, 12);
    assert.ok(resumed.fenceToken > first.fenceToken);
    await assert.rejects(
      outcomeRepository.checkpoint(first, {
        routeIndex: 1,
        counters: {},
        leaseSeconds: 60
      }),
      (error) => error.code === "OUTCOME_RECONCILE_LEASE_LOST"
    );
    await outcomeRepository.complete(resumed, { routeIndex: 3, counters: resumed.counters });
    assert.equal(
      (await pool.query("SELECT value FROM watermarks WHERE name='provider-outcome-events'")).rows[0].value.toISOString(),
      first.watermarkTo.toISOString()
    );
  });

  test("missed provider events and poll/webhook replay create one encrypted inbox/work identity", async (t) => {
    const { pool, outcomeRepository, outreachRepository } = await migrated(t);
    const copyArtifactId = await outreachRepository.saveCopyArtifact({
      matchId: "match-replay",
      sequenceStep: 0,
      templateVersion: "test-v1",
      copy: { subject: "Subject", bodyText: "Body" },
      contentHash: "outcome-replay-copy",
      validationStatus: "valid",
      confidence: 1
    });
    await pool.query(
      `INSERT INTO send_queue
        (match_id,release_id,contact_id,recipient_hash,outlet_id,sequence_step,idempotency_key,
         deterministic_message_id,copy_artifact_id,send_at,status,provider_message_id,sent_at)
       VALUES ($1,$2,$3,$4,$5,0,$6,$7,$8,now(),'sent',$9,now())`,
      [
        "match-replay", "release-replay", "contact-replay", "recipient-hash", "outlet-replay",
        "send-replay", "<send-replay@mail.example.test>", copyArtifactId,
        "<provider-replay@mail.example.test>"
      ]
    );
    const event = {
      id: "provider-event-replay",
      event: "delivered",
      timestamp: Date.parse("2026-07-15T10:00:00Z") / 1_000,
      domain: { name: "mail.example.test" },
      tags: ["marcsmusic-outreach"],
      message: { headers: { "message-id": "<provider-replay@mail.example.test>" } },
      subject: "encrypted-only-subject@example.test"
    };
    const service = createOutcomeReconcileService({
      mailgun: { async listOutcomeEvents() { return { events: [event], rejected: 0 }; } },
      espocrm: { async *iterateModifiedBetween() {} },
      repository: outcomeRepository,
      inboxRepository: outreachRepository,
      config: { outcomeReconcile: runtime({ mailgunEnabled: true }) },
      logger,
      metrics: new Metrics()
    });
    assert.equal((await service.run({ now: new Date("2026-07-15T10:10:00Z") })).succeeded, true);

    const externalId = canonicalMailgunEventId(event);
    const webhookReplay = await outreachRepository.receiveEvent({
      source: "mailgun",
      externalId,
      eventType: "delivered",
      entityType: "MailgunEvent",
      entityId: externalId,
      payload: event,
      workKind: "process_mailgun_event",
      priority: 5
    });
    assert.equal(webhookReplay.inserted, false);
    assert.equal((await pool.query(
      "SELECT count(*)::int AS count FROM encrypted_event_inbox WHERE source='mailgun' AND external_id=$1",
      [externalId]
    )).rows[0].count, 1);
    assert.equal((await pool.query(
      "SELECT count(*)::int AS count FROM work_items WHERE dedupe_key=$1",
      [`mailgun:${externalId}:process_mailgun_event`]
    )).rows[0].count, 1);
    const ciphertext = (await pool.query(
      "SELECT payload_ciphertext FROM encrypted_event_inbox WHERE source='mailgun' AND external_id=$1",
      [externalId]
    )).rows[0].payload_ciphertext;
    assert.equal(ciphertext.includes(Buffer.from(event.subject)), false);
  });

  test("due schedule work is replay-safe, revives only incomplete work, and never overrides send/dead-letter evidence", async (t) => {
    const { pool, outcomeRepository, outreachRepository } = await migrated(t);
    const first = await outcomeRepository.recoverDueSequenceStep({ matchId: "match-due", sequenceStep: 1 });
    assert.equal(first.queued, true);
    assert.equal((await outcomeRepository.recoverDueSequenceStep({ matchId: "match-due", sequenceStep: 1 })).queued, false);
    await pool.query("UPDATE work_items SET status='completed',completed_at=now() WHERE dedupe_key='schedule-step:match-due:1'");
    const recovered = await outcomeRepository.recoverDueSequenceStep({ matchId: "match-due", sequenceStep: 1 });
    assert.deepEqual(recovered, { queued: true, recovered: true });

    const copyArtifactId = await outreachRepository.saveCopyArtifact({
      matchId: "match-due",
      sequenceStep: 1,
      templateVersion: "test-v1",
      copy: { subject: "Follow-up", bodyText: "Body" },
      contentHash: "due-copy",
      validationStatus: "valid",
      confidence: 1
    });
    await pool.query(
      `INSERT INTO send_queue
        (match_id,release_id,contact_id,recipient_hash,outlet_id,sequence_step,idempotency_key,
         deterministic_message_id,copy_artifact_id,send_at,status)
       VALUES ('match-due','release-due','contact-due','recipient-due','outlet-due',1,
               'send-due-1','<send-due-1@mail.example.test>',$1,now(),'ready')`,
      [copyArtifactId]
    );
    await pool.query("UPDATE work_items SET status='completed',completed_at=now() WHERE dedupe_key='schedule-step:match-due:1'");
    assert.deepEqual(
      await outcomeRepository.recoverDueSequenceStep({ matchId: "match-due", sequenceStep: 1 }),
      { queued: false, reason: "send_exists" }
    );
    assert.equal((await pool.query(
      "SELECT status FROM work_items WHERE dedupe_key='schedule-step:match-due:1'"
    )).rows[0].status, "completed");

    await outcomeRepository.recoverDueSequenceStep({ matchId: "match-dead", sequenceStep: 1 });
    await pool.query("UPDATE work_items SET status='dead_letter' WHERE dedupe_key='schedule-step:match-dead:1'");
    assert.deepEqual(
      await outcomeRepository.recoverDueSequenceStep({ matchId: "match-dead", sequenceStep: 1 }),
      { queued: false, reason: "already_active_or_dead_letter" }
    );
    assert.equal((await pool.query(
      "SELECT status FROM work_items WHERE dedupe_key='schedule-step:match-dead:1'"
    )).rows[0].status, "dead_letter");
  });

  test("accepted evidence can atomically recover only an identity-bound delivery_unknown send", async (t) => {
    const { pool, outcomeRepository, outreachRepository } = await migrated(t);
    const copyArtifactId = await outreachRepository.saveCopyArtifact({
      matchId: "match-unknown",
      sequenceStep: 0,
      templateVersion: "test-v1",
      copy: { subject: "Subject", bodyText: "Body" },
      contentHash: "unknown-copy",
      validationStatus: "valid",
      confidence: 1
    });
    const queue = (await pool.query(
      `INSERT INTO send_queue
        (match_id,release_id,contact_id,recipient_hash,outlet_id,sequence_step,idempotency_key,
         deterministic_message_id,copy_artifact_id,send_at,status,attempts,last_error_code)
       VALUES ('match-unknown','release-unknown','contact-unknown','recipient-unknown','outlet-unknown',0,
               'send-unknown','<send-unknown@mail.example.test>',$1,now(),'delivery_unknown',1,'provider_timeout')
       RETURNING *`,
      [copyArtifactId]
    )).rows[0];
    await pool.query(
      `INSERT INTO delivery_attempts
        (send_queue_id,attempt_number,status,correlation_id,started_at,finished_at,error_code)
       VALUES ($1,1,'delivery_unknown','correlation-unknown',now()-interval '1 minute',now(),'MAILGUN_TIMEOUT')`,
      [queue.id]
    );

    assert.deepEqual(
      await outcomeRepository.confirmDeliveryUnknownAccepted({
        messageIds: ["<forged@mail.example.test>"],
        providerMessageId: "<provider-unknown@mail.example.test>",
        providerEventId: "event-forged",
        occurredAt: new Date("2026-07-15T11:00:00Z")
      }),
      { recovered: false, reason: "not_uniquely_bound" }
    );
    const recovered = await outcomeRepository.confirmDeliveryUnknownAccepted({
      messageIds: [queue.deterministic_message_id],
      providerMessageId: "<provider-unknown@mail.example.test>",
      providerEventId: "event-accepted",
      occurredAt: new Date("2026-07-15T11:00:00Z")
    });
    assert.equal(recovered.recovered, true);
    assert.deepEqual((await pool.query(
      "SELECT status,provider_message_id,sent_at FROM send_queue WHERE id=$1",
      [queue.id]
    )).rows[0], {
      status: "sent",
      provider_message_id: "<provider-unknown@mail.example.test>",
      sent_at: new Date("2026-07-15T11:00:00Z")
    });
    assert.equal((await pool.query(
      "SELECT count(*)::int AS count FROM crm_delivery_projections WHERE send_queue_id=$1",
      [queue.id]
    )).rows[0].count, 1);
    assert.equal((await pool.query(
      "SELECT count(*)::int AS count FROM work_items WHERE dedupe_key=$1",
      [`crm-delivery:${queue.id}`]
    )).rows[0].count, 1);
    assert.equal((await outcomeRepository.confirmDeliveryUnknownAccepted({
      messageIds: [queue.deterministic_message_id],
      providerMessageId: "<provider-unknown@mail.example.test>",
      providerEventId: "event-accepted",
      occurredAt: new Date("2026-07-15T11:00:00Z")
    })).recovered, false);
  });
});

async function migrated(t) {
  const database = await cluster.createDatabase();
  const pool = createPostgresPool({ url: database.url, ssl: false });
  t.after(async () => pool.end());
  await runMigrations(pool);
  return {
    pool,
    outcomeRepository: new OutcomeReconcileRepository({ pool }),
    outreachRepository: new OutreachRepository({ pool, cryptoBox })
  };
}

function runtime(overrides = {}) {
  return {
    enabled: true,
    mailgunEnabled: false,
    espoEmailEnabled: false,
    dueMatchesEnabled: false,
    mailgunStoredRepliesEnabled: false,
    mailgunMode: "logs",
    overlapSeconds: 300,
    settleDelaySeconds: 300,
    initialLookbackHours: 24,
    leaseSeconds: 60,
    pageSize: 100,
    maxPagesPerInvocation: 25,
    maximumBacklog: 10_000,
    ...overrides
  };
}
