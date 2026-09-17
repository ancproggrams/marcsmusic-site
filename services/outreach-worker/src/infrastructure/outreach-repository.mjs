import { randomUUID } from "node:crypto";
import {
  acquireSessionAdvisoryLock,
  acquireTransactionAdvisoryLock,
  databaseLimits,
  withTransaction
} from "./postgres.mjs";
import { normalizeEmail } from "../domain/normalization.mjs";

const MAX_ATTEMPTS = 5;
const CAMPAIGN_OUTLET_LIFETIME_CAP = 2;
const SUPPRESSION_SUBJECT_TYPES = new Set(["contact", "outlet", "email", "domain"]);

export class OutreachRepository {
  constructor({ pool, cryptoBox, database = {} }) {
    this.pool = pool;
    this.cryptoBox = cryptoBox;
    this.databaseLimits = databaseLimits({ ...(pool.options ?? {}), ...database });
  }

  async withContactAllocationFence(contactId, work) {
    const normalizedContactId = String(contactId ?? "").trim().toLowerCase();
    if (!normalizedContactId || typeof work !== "function") {
      throw Object.assign(new Error("A contact identity and allocation operation are required"), {
        code: "CONTACT_ALLOCATION_FENCE_INPUT_INVALID",
        retryable: false
      });
    }
    const client = await this.pool.connect();
    const key = `outreach-contact-allocation:${normalizedContactId}`;
    let locked = false;
    try {
      await acquireSessionAdvisoryLock(client, key, this.databaseLimits);
      locked = true;
      return await work();
    } finally {
      if (locked) await client.query("SELECT pg_advisory_unlock(hashtext($1))", [key]).catch(() => {});
      client.release();
    }
  }

  async withContactSendFence(contactId, work) {
    return this.withSendAuthorizationFence({ contactId }, work);
  }

  async withSendAuthorizationFence({ contactId, outletId, email, domain }, work) {
    const client = await this.pool.connect();
    const acquiredKeys = [];
    const keys = [
      ["contact", contactId],
      ["outlet", outletId],
      ["email", email],
      ["domain", domain]
    ]
      .filter(([, subject]) => subject !== undefined && subject !== null && String(subject).trim())
      .map(([subjectType, subject]) => suppressionFenceKey(subjectType, subject))
      .filter((key, index, all) => all.indexOf(key) === index)
      .sort();
    if (!keys.length) {
      client.release();
      throw Object.assign(new Error("At least one send authorization identity is required"), {
        code: "SEND_AUTHORIZATION_IDENTITY_MISSING",
        retryable: false
      });
    }
    try {
      for (const key of keys) {
        await acquireSessionAdvisoryLock(client, key, this.databaseLimits);
        acquiredKeys.push(key);
      }
      return await work();
    } finally {
      for (const key of [...acquiredKeys].reverse()) {
        await client.query("SELECT pg_advisory_unlock(hashtext($1))", [key]).catch(() => {});
      }
      client.release();
    }
  }

  async receiveEvent({
    source,
    externalId,
    eventType,
    entityType,
    entityId,
    payload,
    workKind,
    priority = 10,
    openCircuitReason
  }) {
    const encrypted = this.cryptoBox.encryptJson(payload, `${source}:${externalId}`);
    return withTransaction(this.pool, async (client) => {
      const inserted = await client.query(
        `INSERT INTO encrypted_event_inbox
          (source, external_id, event_type, entity_type, entity_id, payload_ciphertext, payload_iv, payload_tag, key_version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (source, external_id) DO NOTHING
         RETURNING id`,
        [source, externalId, eventType, entityType, entityId, encrypted.ciphertext, encrypted.iv, encrypted.tag, encrypted.keyVersion]
      );
      // A signed complaint or confirmed unauthorized-recipient incident is a
      // synchronous safety decision. Persisting the event and opening the
      // circuit share this transaction, so HTTP ingress cannot acknowledge it
      // while a sender still sees a closed circuit.
      if (openCircuitReason) await openSafetyCircuit(client, openCircuitReason);
      if (!inserted.rowCount) return Object.freeze({ inserted: false, circuitOpened: Boolean(openCircuitReason) });
      await client.query(
        `INSERT INTO work_items (kind, entity_type, entity_id, dedupe_key, payload, priority)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6)
         ON CONFLICT (dedupe_key) DO NOTHING`,
        [workKind, entityType ?? "Unknown", entityId ?? externalId, `${source}:${externalId}:${workKind}`, JSON.stringify({ eventInboxId: inserted.rows[0].id }), priority]
      );
      return Object.freeze({ inserted: true, id: inserted.rows[0].id, circuitOpened: Boolean(openCircuitReason) });
    });
  }

  async readEvent(id) {
    const result = await this.pool.query("SELECT * FROM encrypted_event_inbox WHERE id = $1", [id]);
    const row = result.rows[0];
    if (!row) return undefined;
    return Object.freeze({
      ...row,
      payload: this.cryptoBox.decryptJson(
        { ciphertext: row.payload_ciphertext, iv: row.payload_iv, tag: row.payload_tag, keyVersion: row.key_version },
        `${row.source}:${row.external_id}`
      )
    });
  }

  async markEventProcessed(id) {
    await this.pool.query("UPDATE encrypted_event_inbox SET status='processed', processed_at=now(), locked_until=NULL, locked_by=NULL WHERE id=$1", [id]);
  }

  async enqueueWork({ kind, entityType, entityId, dedupeKey, payload = {}, priority = 100, availableAt = new Date() }) {
    const result = await this.pool.query(
      `INSERT INTO work_items (kind, entity_type, entity_id, dedupe_key, payload, priority, available_at)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)
       ON CONFLICT (dedupe_key) DO NOTHING
       RETURNING id`,
      [kind, entityType, entityId, dedupeKey, JSON.stringify(payload), priority, availableAt]
    );
    return result.rows[0]?.id;
  }

  async enqueueDailyReportWork({ reportDate, scheduleSlot, slotRank, dedupeKey }) {
    assertDailyReportSlot({ reportDate, scheduleSlot, slotRank, dedupeKey });
    return this.enqueueWork({
      kind: "create_daily_report",
      entityType: "OutreachDailyReport",
      entityId: reportDate,
      dedupeKey,
      payload: { reportDate, scheduleSlot, slotRank },
      priority: scheduleSlot === "final-next-day-v1" ? 75 : 80
    });
  }

  async withDailyReportProjectionFence({ reportDate, scheduleSlot, slotRank }, work) {
    assertDailyReportSlot({
      reportDate,
      scheduleSlot,
      slotRank,
      dedupeKey: `daily-report:${reportDate}:${scheduleSlot}`
    });
    if (typeof work !== "function") throw new TypeError("Daily report projection work must be a function");
    const client = await this.pool.connect();
    const lockName = `outreach-daily-report:${reportDate}`;
    try {
      await acquireSessionAdvisoryLock(client, lockName, this.databaseLimits);
      const newer = await client.query(
        `SELECT dedupe_key,payload->>'scheduleSlot' AS schedule_slot
           FROM work_items
          WHERE kind='create_daily_report' AND entity_id=$1
            AND status<>'dead_letter'
            AND payload->>'slotRank' ~ '^[0-9]+$'
            AND (payload->>'slotRank')::integer > $2
          ORDER BY (payload->>'slotRank')::integer DESC
          LIMIT 1`,
        [reportDate, slotRank]
      );
      if (newer.rowCount) {
        return Object.freeze({ skipped: true, newerSlot: newer.rows[0].schedule_slot });
      }
      return Object.freeze({ skipped: false, value: await work() });
    } finally {
      await client.query("SELECT pg_advisory_unlock(hashtext($1))", [lockName]).catch(() => {});
      client.release();
    }
  }

  async enqueueWorkBatch(items) {
    if (!items.length) return 0;
    const payload = items.map((item) => ({
      kind: item.kind,
      entity_type: item.entityType,
      entity_id: item.entityId,
      dedupe_key: item.dedupeKey,
      payload: item.payload ?? {},
      priority: item.priority ?? 100,
      available_at: item.availableAt ?? new Date()
    }));
    const result = await this.pool.query(
      `INSERT INTO work_items (kind,entity_type,entity_id,dedupe_key,payload,priority,available_at)
       SELECT kind,entity_type,entity_id,dedupe_key,payload,priority,available_at
       FROM jsonb_to_recordset($1::jsonb) AS item(
         kind text,entity_type text,entity_id text,dedupe_key text,payload jsonb,priority smallint,available_at timestamptz
       )
       ON CONFLICT (dedupe_key) DO NOTHING`,
      [JSON.stringify(payload)]
    );
    return result.rowCount;
  }

  async claimWork(workerId, leaseSeconds = 120, { kinds } = {}) {
    const laneKinds = Array.isArray(kinds) && kinds.length ? [...new Set(kinds)] : undefined;
    return withTransaction(this.pool, async (client) => {
      const result = await client.query(
        `SELECT * FROM work_items
         WHERE ((status IN ('pending','failed') AND available_at <= now())
            OR (status='processing' AND locked_until < now()))
           AND ($1::text[] IS NULL OR kind = ANY($1::text[]))
         ORDER BY priority ASC, created_at ASC
         FOR UPDATE SKIP LOCKED LIMIT 1`,
        [laneKinds ?? null]
      );
      const row = result.rows[0];
      if (!row) return undefined;
      const updated = await client.query(
        `UPDATE work_items
         SET status='processing', attempts=attempts+1, locked_by=$2,
             locked_until=now()+make_interval(secs => $3), lease_version=lease_version+1
         WHERE id=$1 RETURNING *`,
        [row.id, workerId, leaseSeconds]
      );
      return Object.freeze(updated.rows[0]);
    });
  }

  async completeWork(item) {
    const result = await this.pool.query(
      `UPDATE work_items SET status='completed',completed_at=now(),locked_until=NULL,locked_by=NULL
       WHERE id=$1 AND status='processing' AND locked_by=$2 AND lease_version=$3`,
      [item.id, item.locked_by, item.lease_version]
    );
    return result.rowCount === 1;
  }

  async renewWorkLease(item, leaseSeconds = 120) {
    const result = await this.pool.query(
      `UPDATE work_items SET locked_until=now()+make_interval(secs => $4)
       WHERE id=$1 AND status='processing' AND locked_by=$2 AND lease_version=$3`,
      [item.id, item.locked_by, item.lease_version, leaseSeconds]
    );
    return result.rowCount === 1;
  }

  async relinquishWork(item, code = "worker_shutdown") {
    const result = await this.pool.query(
      `UPDATE work_items SET status='failed',attempts=GREATEST(attempts-1,0),
         available_at=now(),last_error_code=$4,locked_until=NULL,locked_by=NULL
       WHERE id=$1 AND status='processing' AND locked_by=$2 AND lease_version=$3`,
      [item.id, item.locked_by, item.lease_version, code]
    );
    return result.rowCount === 1;
  }

  async failWork(item, code, retryable = true) {
    const terminal = !retryable || item.attempts >= MAX_ATTEMPTS;
    const delaySeconds = Math.min(3_600, 30 * 2 ** Math.max(0, item.attempts - 1));
    const status = terminal ? "dead_letter" : "failed";
    return withTransaction(this.pool, async (client) => {
      const result = await client.query(
        `UPDATE work_items SET status=$2, last_error_code=$3, locked_until=NULL, locked_by=NULL,
           available_at=CASE WHEN $2='failed' THEN now()+make_interval(secs => $4) ELSE available_at END
         WHERE id=$1 AND status='processing' AND locked_by=$5 AND lease_version=$6`,
        [item.id, status, code, delaySeconds, item.locked_by, item.lease_version]
      );
      if (result.rowCount !== 1) return false;
      const eventInboxId = item.payload?.eventInboxId;
      if (eventInboxId) {
        await client.query(
          `UPDATE encrypted_event_inbox
              SET status=$2, attempts=GREATEST(attempts,$3), last_error_code=$4,
                  available_at=CASE WHEN $2='failed' THEN now()+make_interval(secs => $5) ELSE available_at END,
                  locked_until=NULL, locked_by=NULL
            WHERE id=$1 AND status<>'processed'`,
          [eventInboxId, status, item.attempts, code, delaySeconds]
        );
      }
      return true;
    });
  }

  async saveCopyArtifact({
    matchId,
    sequenceStep,
    templateVersion,
    promptVersion,
    copy,
    contentHash,
    authorizationSnapshotDigest,
    authorizationSnapshotVersion = authorizationSnapshotDigest ? 1 : undefined,
    validationStatus,
    confidence
  }) {
    const encrypted = this.cryptoBox.encryptJson(copy, `${matchId}:${sequenceStep}:${contentHash}`);
    const result = await this.pool.query(
      `INSERT INTO copy_artifacts
        (match_id, sequence_step, template_version, prompt_version, content_sha256,
         content_ciphertext, content_iv, content_tag, key_version, authorization_snapshot_digest,
         authorization_snapshot_version, validation_status, confidence)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (match_id, sequence_step, content_sha256)
       DO UPDATE SET
         validation_status=EXCLUDED.validation_status,
         authorization_snapshot_digest=COALESCE(copy_artifacts.authorization_snapshot_digest,EXCLUDED.authorization_snapshot_digest),
         authorization_snapshot_version=COALESCE(copy_artifacts.authorization_snapshot_version,EXCLUDED.authorization_snapshot_version)
       RETURNING id`,
      [matchId, sequenceStep, templateVersion, promptVersion, contentHash, encrypted.ciphertext, encrypted.iv,
        encrypted.tag, encrypted.keyVersion, authorizationSnapshotDigest ?? null,
        authorizationSnapshotVersion ?? null, validationStatus, confidence]
    );
    return result.rows[0].id;
  }

  async readCopyArtifact(id) {
    const result = await this.pool.query("SELECT * FROM copy_artifacts WHERE id=$1", [id]);
    const row = result.rows[0];
    if (!row) return undefined;
    const content = this.cryptoBox.decryptJson(
      { ciphertext: row.content_ciphertext, iv: row.content_iv, tag: row.content_tag, keyVersion: row.key_version },
      `${row.match_id}:${row.sequence_step}:${row.content_sha256}`
    );
    if (!content || typeof content !== "object" || Array.isArray(content)) {
      throw Object.assign(new Error("The copy artifact content is malformed"), {
        code: "COPY_ARTIFACT_CONTENT_INVALID",
        retryable: false
      });
    }
    return Object.freeze({
      ...content,
      templateVersion: row.template_version,
      promptVersion: row.prompt_version,
      authorizationSnapshotDigest: row.authorization_snapshot_digest,
      authorizationSnapshotVersion: row.authorization_snapshot_version
    });
  }

  async tryAcquireAllocation({
    email,
    matchId,
    releaseId,
    contactId,
    outletId,
    maxActivePerOutlet = 1,
    outletCooldownDays = 14
  }) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      throw Object.assign(new Error("A normalized recipient email is required for allocation"), {
        code: "ALLOCATION_EMAIL_INVALID",
        retryable: false
      });
    }
    const normalizedOutletId = String(outletId ?? "").trim();
    if (!normalizedOutletId) {
      throw Object.assign(new Error("An outlet identity is required for allocation"), {
        code: "ALLOCATION_OUTLET_INVALID",
        retryable: false
      });
    }
    const recipientHash = this.cryptoBox.privacyHash(`email:${normalizedEmail}`);
    const releaseHash = this.cryptoBox.privacyHash(`campaign-outlet-release:${releaseId}`);
    const outletHash = this.cryptoBox.privacyHash(`campaign-outlet-outlet:${normalizedOutletId}`);
    const contactHash = this.cryptoBox.subjectHash(`contact:${contactId}`);
    const outletSubjectHash = this.cryptoBox.subjectHash(`outlet:${normalizedOutletId}`);
    const allocationHash = this.cryptoBox.privacyHash(`campaign-outlet-match:${matchId}`);
    return withTransaction(this.pool, async (client) => {
      await acquireTransactionAdvisoryLock(client, `outlet-allocation:${normalizedOutletId}`, this.databaseLimits);
      const outletCapacity = await client.query(
        `SELECT
           count(*) FILTER (WHERE status='active')::int AS active_count,
           coalesce(bool_or(initial_sent_at >= now()-make_interval(days => $3)),false) AS cooldown_active
         FROM sequence_allocations
         WHERE outlet_id=$1 AND match_id<>$2`,
        [normalizedOutletId, matchId, outletCooldownDays]
      );
      if (outletCapacity.rows[0].cooldown_active) {
        return Object.freeze({ acquired: false, reason: "outlet_first_send_cooldown_active" });
      }
      if (outletCapacity.rows[0].active_count >= maxActivePerOutlet) {
        return Object.freeze({ acquired: false, reason: "outlet_active_allocation_limit" });
      }

      await reconcileCampaignOutletLedger(client, this.cryptoBox, {
        releaseId,
        outletId: normalizedOutletId,
        releaseHash,
        outletHash
      });
      const existingLedger = await client.query(
        `SELECT release_hash,outlet_hash,contact_hash,outlet_subject_hash,recipient_hash
           FROM campaign_outlet_allocation_ledger WHERE allocation_hash=$1`,
        [allocationHash]
      );
      if (existingLedger.rowCount && (
        existingLedger.rows[0].release_hash !== releaseHash
        || existingLedger.rows[0].outlet_hash !== outletHash
        || existingLedger.rows[0].contact_hash !== contactHash
        || existingLedger.rows[0].outlet_subject_hash !== outletSubjectHash
        || existingLedger.rows[0].recipient_hash !== recipientHash
      )) {
        throw Object.assign(new Error("An allocation replay changed its durable campaign/outlet identity"), {
          code: "ALLOCATION_LEDGER_IDENTITY_MISMATCH",
          retryable: false
        });
      }
      if (!existingLedger.rowCount) {
        const contactLedger = await client.query(
          `SELECT allocation_hash FROM campaign_outlet_allocation_ledger
            WHERE release_hash=$1 AND outlet_hash=$2 AND contact_hash=$3`,
          [releaseHash, outletHash, contactHash]
        );
        if (contactLedger.rowCount) {
          return Object.freeze({
            acquired: false,
            reason: "campaign_outlet_contact_already_allocated"
          });
        }
      }

      let campaignSlotReserved = false;
      if (!existingLedger.rowCount) {
        const slot = await client.query(
          `INSERT INTO campaign_outlet_allocation_counters
             (release_hash,outlet_hash,allocated_count)
           VALUES ($1,$2,1)
           ON CONFLICT (release_hash,outlet_hash) DO UPDATE SET
             allocated_count=campaign_outlet_allocation_counters.allocated_count+1,
             updated_at=now()
           WHERE campaign_outlet_allocation_counters.allocated_count < $3
           RETURNING allocated_count`,
          [releaseHash, outletHash, CAMPAIGN_OUTLET_LIFETIME_CAP]
        );
        if (!slot.rowCount) {
          return Object.freeze({ acquired: false, reason: "campaign_outlet_lifetime_cap_reached" });
        }
        campaignSlotReserved = true;
      }

      const result = await client.query(
        `INSERT INTO sequence_allocations
          (recipient_hash,match_id,release_id,contact_id,outlet_id,status)
         VALUES ($1,$2,$3,$4,$5,'active')
         ON CONFLICT (recipient_hash) DO UPDATE SET
           match_id=EXCLUDED.match_id,
           release_id=EXCLUDED.release_id,
           contact_id=EXCLUDED.contact_id,
           outlet_id=EXCLUDED.outlet_id,
           status='active',
           acquired_at=CASE
             WHEN sequence_allocations.status='active' AND sequence_allocations.match_id=EXCLUDED.match_id
             THEN sequence_allocations.acquired_at ELSE now() END,
           initial_sent_at=CASE
             WHEN sequence_allocations.status='active' AND sequence_allocations.match_id=EXCLUDED.match_id
             THEN sequence_allocations.initial_sent_at ELSE NULL END,
           released_at=NULL,
           cooldown_until=NULL,
           release_reason=NULL,
           updated_at=now()
         WHERE (sequence_allocations.status='active' AND sequence_allocations.match_id=EXCLUDED.match_id)
            OR (sequence_allocations.status='released'
                AND (sequence_allocations.cooldown_until IS NULL OR sequence_allocations.cooldown_until <= now()))
         RETURNING match_id,recipient_hash`,
        [recipientHash, matchId, releaseId, contactId, normalizedOutletId]
      );
      if (!result.rowCount) {
        if (campaignSlotReserved) {
          await client.query(
            `UPDATE campaign_outlet_allocation_counters
                SET allocated_count=allocated_count-1,updated_at=now()
              WHERE release_hash=$1 AND outlet_hash=$2 AND allocated_count>0`,
            [releaseHash, outletHash]
          );
        }
        const existing = await client.query(
          "SELECT match_id,cooldown_until FROM sequence_allocations WHERE recipient_hash=$1",
          [recipientHash]
        );
        return Object.freeze({
          acquired: false,
          reason: existing.rows[0]?.cooldown_until ? "recipient_cooldown_active" : "recipient_has_active_allocation",
          matchId: existing.rows[0]?.match_id
        });
      }
      if (campaignSlotReserved) {
        await client.query(
          `INSERT INTO campaign_outlet_allocation_ledger
             (allocation_hash,release_hash,outlet_hash,contact_hash,outlet_subject_hash,recipient_hash)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [allocationHash, releaseHash, outletHash, contactHash, outletSubjectHash, recipientHash]
        );
      }
      return Object.freeze({ acquired: true, matchId, recipientHash });
    });
  }

  async releaseAllocation({ matchId, cooldownUntil, reason = "sequence_closed" }) {
    return withTransaction(this.pool, async (client) => {
      const current = await client.query(
        "SELECT contact_id FROM sequence_allocations WHERE match_id=$1",
        [matchId]
      );
      if (!current.rowCount) return false;
      await acquireTransactionAdvisoryLock(
        client,
        suppressionFenceKey("contact", current.rows[0].contact_id),
        this.databaseLimits
      );
      const result = await client.query(
        `UPDATE sequence_allocations SET status='released',released_at=now(),cooldown_until=$2,
           release_reason=$3,updated_at=now()
         WHERE match_id=$1 AND status='active'`,
        [matchId, cooldownUntil ?? null, reason]
      );
      return result.rowCount === 1;
    });
  }

  async getSequenceStart(matchId) {
    const result = await this.pool.query(
      "SELECT initial_sent_at FROM sequence_allocations WHERE match_id=$1 LIMIT 1",
      [matchId]
    );
    return result.rows[0]?.initial_sent_at;
  }

  async getClaimedSendAllocation(item) {
    if (!item?.recipient_hash) return undefined;
    const result = await this.pool.query(
      `SELECT match_id,release_id,contact_id,outlet_id,status,cooldown_until
         FROM sequence_allocations WHERE recipient_hash=$1`,
      [item.recipient_hash]
    );
    return result.rows[0] ? Object.freeze(result.rows[0]) : undefined;
  }

  async enqueueSend({ matchId, releaseId, contactId, outletId, recipientEmail, sequenceStep, idempotencyKey, deterministicMessageId, copyArtifactId, sendAt }) {
    const normalizedEmail = normalizeEmail(recipientEmail);
    if (!normalizedEmail) {
      throw Object.assign(new Error("A normalized recipient email is required for queueing"), {
        code: "SEND_RECIPIENT_INVALID",
        retryable: false
      });
    }
    const recipientHash = this.cryptoBox.privacyHash(`email:${normalizedEmail}`);
    const result = await this.pool.query(
      `INSERT INTO send_queue
        (match_id,release_id,contact_id,recipient_hash,outlet_id,sequence_step,idempotency_key,deterministic_message_id,copy_artifact_id,send_at)
       SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
       WHERE EXISTS (
         SELECT 1 FROM sequence_allocations
         WHERE recipient_hash=$4 AND match_id=$1 AND status='active'
       )
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [matchId, releaseId, contactId, recipientHash, outletId, sequenceStep, idempotencyKey, deterministicMessageId, copyArtifactId, sendAt]
    );
    return result.rows[0]?.id;
  }

  async claimSend(workerId, leaseSeconds = 120) {
    return withTransaction(this.pool, async (client) => {
      const result = await client.query(
        `SELECT * FROM send_queue
         WHERE status IN ('ready','failed') AND send_at <= now()
           AND (locked_until IS NULL OR locked_until < now())
         ORDER BY send_at ASC, created_at ASC
         FOR UPDATE SKIP LOCKED LIMIT 1`
      );
      const row = result.rows[0];
      if (!row) return undefined;
      const updated = await client.query(
        `UPDATE send_queue SET status='sending', attempts=attempts+1, locked_by=$2,
          locked_until=now()+make_interval(secs => $3) WHERE id=$1 RETURNING *`,
        [row.id, workerId, leaseSeconds]
      );
      return Object.freeze(updated.rows[0]);
    });
  }

  async beginDeliveryAttempt(queueItem) {
    const correlationId = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO delivery_attempts (send_queue_id, attempt_number, status, correlation_id)
       SELECT $1,$2,'started',$3
       WHERE EXISTS (
         SELECT 1 FROM send_queue
         WHERE id=$1 AND status='sending' AND locked_by=$4
       )
       RETURNING correlation_id`,
      [queueItem.id, queueItem.attempts, correlationId, queueItem.locked_by]
    );
    if (!result.rowCount) {
      throw Object.assign(new Error("The send queue lease was lost before the provider attempt"), {
        code: "SEND_LEASE_LOST",
        retryable: false,
        deliveryUnknown: false
      });
    }
    return correlationId;
  }

  async markSendAccepted(queueItem, correlationId, providerMessageId) {
    return withTransaction(this.pool, async (client) => {
      const committed = await client.query(
        `UPDATE send_queue SET status='sent', provider_message_id=$2, sent_at=now(), locked_until=NULL, locked_by=NULL
         WHERE id=$1 AND status='sending' AND locked_by=$3
         RETURNING id,sent_at`,
        [queueItem.id, providerMessageId, queueItem.locked_by]
      );
      if (!committed.rowCount) return false;
      await client.query(
        `UPDATE delivery_attempts SET status='accepted', provider_message_id=$3, finished_at=now()
         WHERE send_queue_id=$1 AND attempt_number=$2`,
        [queueItem.id, queueItem.attempts, providerMessageId]
      );
      await client.query(
        `INSERT INTO outcome_events (match_id, send_queue_id, event_type, provider_event_id, occurred_at)
         VALUES ($1,$2,'sent',$3,now()) ON CONFLICT (provider_event_id) DO NOTHING`,
        [queueItem.match_id, queueItem.id, `send:${providerMessageId}`]
      );
      await client.query(
        `UPDATE send_capacity_reservations SET status='consumed',finalized_at=now()
         WHERE send_queue_id=$1 AND status='reserved'`,
        [queueItem.id]
      );
      await client.query(
        `UPDATE outlet_first_send_guards SET status='consumed',consumed_at=now(),updated_at=now()
         WHERE send_queue_id=$1 AND status='reserved'`,
        [queueItem.id]
      );
      if (Number(queueItem.sequence_step) === 0) {
        await client.query(
          `UPDATE sequence_allocations SET initial_sent_at=COALESCE(initial_sent_at,now()),updated_at=now()
           WHERE match_id=$1 AND status='active'`,
          [queueItem.match_id]
        );
      }
      const acceptedAt = committed.rows[0].sent_at;
      const campaignProjectionKey = `music-release:${queueItem.release_id}`;
      const emailProjectionKey = `send:${queueItem.id}`;
      const eventProjectionKey = `sent:${queueItem.id}`;
      await client.query(
        `INSERT INTO crm_delivery_projections
          (send_queue_id,match_id,release_id,contact_id,outlet_id,provider_message_id,
           deterministic_message_id,correlation_id,accepted_at,campaign_projection_key,
           email_projection_key,event_projection_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (send_queue_id) DO NOTHING`,
        [
          queueItem.id,
          queueItem.match_id,
          queueItem.release_id,
          queueItem.contact_id,
          queueItem.outlet_id ?? null,
          providerMessageId,
          queueItem.deterministic_message_id,
          correlationId,
          acceptedAt,
          campaignProjectionKey,
          emailProjectionKey,
          eventProjectionKey
        ]
      );
      await client.query(
        `INSERT INTO work_items (kind,entity_type,entity_id,dedupe_key,payload,priority)
         VALUES ('sync_delivery_to_crm','OutreachMatch',$1,$2,$3::jsonb,20)
         ON CONFLICT (dedupe_key) DO NOTHING`,
        [
          queueItem.match_id,
          `crm-delivery:${queueItem.id}`,
          JSON.stringify({
            sendQueueId: queueItem.id,
            providerMessageId,
            sequenceStep: queueItem.sequence_step,
            correlationId,
            acceptedAt
          })
        ]
      );
      return true;
    });
  }

  async markSendFailure(queueItem, correlationId, { code, retryable, deliveryUnknown }) {
    const attemptStatus = deliveryUnknown ? "delivery_unknown" : "definite_failure";
    const queueStatus = deliveryUnknown ? "delivery_unknown" : retryable && queueItem.attempts < MAX_ATTEMPTS ? "failed" : "dead_letter";
    const delaySeconds = Math.min(3_600, 60 * 2 ** Math.max(0, queueItem.attempts - 1));
    return withTransaction(this.pool, async (client) => {
      const committed = await client.query(
        `UPDATE send_queue SET status=$2, last_error_code=$3, locked_until=NULL, locked_by=NULL,
          send_at=CASE WHEN $2='failed' THEN now()+make_interval(secs => $4) ELSE send_at END
         WHERE id=$1 AND status='sending' AND locked_by=$5
         RETURNING id`,
        [queueItem.id, queueStatus, code, delaySeconds, queueItem.locked_by]
      );
      if (!committed.rowCount) return false;
      await client.query(
        `UPDATE delivery_attempts SET status=$3, error_code=$4, finished_at=now()
         WHERE send_queue_id=$1 AND attempt_number=$2`,
        [queueItem.id, queueItem.attempts, attemptStatus, code]
      );
      await client.query(
        `INSERT INTO outcome_events (match_id, send_queue_id, event_type, provider_event_id, occurred_at)
         VALUES ($1,$2,$3,$4,now()) ON CONFLICT (provider_event_id) DO NOTHING`,
        [queueItem.match_id, queueItem.id, attemptStatus, `attempt:${correlationId}`]
      );
      if (deliveryUnknown) {
        await client.query(
          `UPDATE send_capacity_reservations SET status='consumed',finalized_at=now()
           WHERE send_queue_id=$1 AND status='reserved'`,
          [queueItem.id]
        );
        await client.query(
          `UPDATE outlet_first_send_guards SET status='consumed',consumed_at=now(),updated_at=now()
           WHERE send_queue_id=$1 AND status='reserved'`,
          [queueItem.id]
        );
      } else {
        await releaseCapacityReservation(client, queueItem.id);
      }
      return true;
    });
  }

  async deferClaimedSend(queueItem, { code, delaySeconds = 300 }) {
    const result = await this.pool.query(
      `UPDATE send_queue SET status='ready',attempts=GREATEST(attempts-1,0),last_error_code=$2,
         send_at=now()+make_interval(secs => $3),locked_until=NULL,locked_by=NULL
       WHERE id=$1 AND status='sending' AND locked_by=$4`,
      [queueItem.id, code, delaySeconds, queueItem.locked_by]
    );
    return result.rowCount === 1;
  }

  async markPreflightFailure(queueItem, { code, retryable }) {
    const status = retryable && queueItem.attempts < MAX_ATTEMPTS ? "failed" : "dead_letter";
    const delaySeconds = Math.min(3_600, 30 * 2 ** Math.max(0, queueItem.attempts - 1));
    const result = await this.pool.query(
      `UPDATE send_queue SET status=$2,last_error_code=$3,locked_until=NULL,locked_by=NULL,
         send_at=CASE WHEN $2='failed' THEN now()+make_interval(secs => $4) ELSE send_at END
       WHERE id=$1 AND status='sending' AND locked_by=$5`,
      [queueItem.id, status, code, delaySeconds, queueItem.locked_by]
    );
    return result.rowCount === 1;
  }

  async cancelPendingForMatch(matchId, reason = "sequence_stopped") {
    return withTransaction(this.pool, async (client) => {
      const sends = await client.query(
        `UPDATE send_queue SET status='canceled', canceled_at=now(), last_error_code=$2, locked_until=NULL, locked_by=NULL
         WHERE match_id=$1 AND status IN ('ready','failed')`,
        [matchId, reason]
      );
      const responses = await client.query(
        `UPDATE response_queue SET status='canceled',last_error_code=$2,locked_until=NULL,locked_by=NULL
         WHERE match_id=$1 AND status IN ('ready','failed')`,
        [matchId, reason]
      );
      return sends.rowCount + responses.rowCount;
    });
  }

  async cancelClaimedSend(id, reason = "sequence_stopped") {
    await this.pool.query(
      `UPDATE send_queue SET status='canceled', canceled_at=now(), last_error_code=$2,
         locked_until=NULL, locked_by=NULL
       WHERE id=$1 AND status='sending'`,
      [id, reason]
    );
  }

  async pausePendingForMatch(matchId, resumeAt, reason = "out_of_office") {
    const result = await this.pool.query(
      `UPDATE send_queue SET send_at=GREATEST(send_at,$2), last_error_code=$3
       WHERE match_id=$1 AND status IN ('ready','failed')`,
      [matchId, resumeAt, reason]
    );
    return result.rowCount;
  }

  async cancelPendingForContact(contactId, reason = "contact_suppressed") {
    return withTransaction(this.pool, async (client) => {
      const sends = await client.query(
        `UPDATE send_queue SET status='canceled', canceled_at=now(), last_error_code=$2,
           locked_until=NULL, locked_by=NULL
         WHERE contact_id=$1 AND status IN ('ready','failed')`,
        [contactId, reason]
      );
      const responses = await client.query(
        `UPDATE response_queue SET status='canceled',last_error_code=$2,locked_until=NULL,locked_by=NULL
         WHERE contact_id=$1 AND status IN ('ready','failed')`,
        [contactId, reason]
      );
      return sends.rowCount + responses.rowCount;
    });
  }

  async findSendByMessageId(messageId) {
    if (!messageId) return undefined;
    const result = await this.pool.query(
      "SELECT * FROM send_queue WHERE provider_message_id=$1 OR deterministic_message_id=$1 LIMIT 1",
      [messageId]
    );
    return result.rows[0] ? Object.freeze(result.rows[0]) : undefined;
  }

  async getSend(id) {
    const result = await this.pool.query("SELECT * FROM send_queue WHERE id=$1", [id]);
    return result.rows[0] ? Object.freeze(result.rows[0]) : undefined;
  }

  async getDeliveryUnknownEvidence(id) {
    const result = await this.pool.query(
      `SELECT q.id,
              a.occurred_at,
              a.correlation_id,
              a.attempt_number,
              a.error_code
       FROM send_queue q
       LEFT JOIN LATERAL (
         SELECT COALESCE(finished_at,started_at) AS occurred_at,
                correlation_id,attempt_number,error_code
         FROM delivery_attempts
         WHERE send_queue_id=q.id AND status='delivery_unknown'
         ORDER BY attempt_number DESC
         LIMIT 1
       ) a ON true
       WHERE q.id=$1 AND q.status='delivery_unknown'`,
      [id]
    );
    const row = result.rows[0];
    if (!row?.occurred_at || !row?.correlation_id) return undefined;
    return Object.freeze(row);
  }

  async beginCrmDeliveryProjection(sendQueueId) {
    const result = await this.pool.query(
      `UPDATE crm_delivery_projections
       SET status=CASE WHEN status='completed' THEN status ELSE 'processing' END,
           attempts=attempts+1,updated_at=now()
       WHERE send_queue_id=$1
       RETURNING *`,
      [sendQueueId]
    );
    return result.rows[0] ? Object.freeze(result.rows[0]) : undefined;
  }

  async completeCrmDeliveryProjection({ sendQueueId, campaignId, emailId, eventId }) {
    const result = await this.pool.query(
      `UPDATE crm_delivery_projections
       SET status='completed',campaign_id=$2,email_id=$3,event_id=$4,
           completed_at=COALESCE(completed_at,now()),updated_at=now(),
           last_error_code=NULL,last_failure_retryable=NULL
       WHERE send_queue_id=$1
       RETURNING *`,
      [sendQueueId, campaignId, emailId, eventId]
    );
    return result.rows[0] ? Object.freeze(result.rows[0]) : undefined;
  }

  async failCrmDeliveryProjection(sendQueueId, code, retryable) {
    const result = await this.pool.query(
      `UPDATE crm_delivery_projections
       SET status='failed',last_error_code=$2,last_failure_retryable=$3,updated_at=now()
       WHERE send_queue_id=$1 AND status<>'completed'`,
      [sendQueueId, boundedText(code, 120, "CRM_PROJECTION_FAILED"), Boolean(retryable)]
    );
    return result.rowCount === 1;
  }

  async reconcileCrmProjectionWork({ limit = 1_000 } = {}) {
    const boundedLimit = Math.max(1, Math.min(Number(limit) || 1_000, 10_000));
    return withTransaction(this.pool, async (client) => {
      const recovered = await client.query(
        `WITH candidates AS (
           SELECT q.*,COALESCE(a.correlation_id,'reconciled:' || q.id::text) AS correlation_id
           FROM send_queue q
           LEFT JOIN LATERAL (
             SELECT correlation_id FROM delivery_attempts
             WHERE send_queue_id=q.id AND status='accepted'
             ORDER BY attempt_number DESC LIMIT 1
           ) a ON true
           WHERE q.status='sent' AND q.provider_message_id IS NOT NULL AND q.sent_at IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM crm_delivery_projections p WHERE p.send_queue_id=q.id)
           ORDER BY q.sent_at ASC
           LIMIT $1
         )
         INSERT INTO crm_delivery_projections
           (send_queue_id,match_id,release_id,contact_id,outlet_id,provider_message_id,
            deterministic_message_id,correlation_id,accepted_at,campaign_projection_key,
            email_projection_key,event_projection_key)
         SELECT id,match_id,release_id,contact_id,outlet_id,provider_message_id,
                deterministic_message_id,correlation_id,sent_at,
                'music-release:' || release_id,'send:' || id::text,'sent:' || id::text
         FROM candidates
         ON CONFLICT (send_queue_id) DO NOTHING`,
        [boundedLimit]
      );
      const deliveryWork = await client.query(
        `INSERT INTO work_items (kind,entity_type,entity_id,dedupe_key,payload,priority)
         SELECT 'sync_delivery_to_crm','OutreachMatch',p.match_id,
                'crm-delivery:' || p.send_queue_id::text,
                jsonb_build_object(
                  'sendQueueId',p.send_queue_id,
                  'providerMessageId',p.provider_message_id,
                  'sequenceStep',q.sequence_step,
                  'correlationId',p.correlation_id,
                  'acceptedAt',p.accepted_at
                ),20
         FROM crm_delivery_projections p
         JOIN send_queue q ON q.id=p.send_queue_id
         WHERE p.status<>'completed'
         ORDER BY p.accepted_at ASC
         LIMIT $1
         ON CONFLICT (dedupe_key) DO NOTHING`,
        [boundedLimit]
      );
      const revived = await client.query(
        `UPDATE work_items w
         SET status='failed',attempts=0,available_at=now(),locked_until=NULL,locked_by=NULL,
             last_error_code='crm_projection_reconciled'
         FROM crm_delivery_projections p
         WHERE w.dedupe_key='crm-delivery:' || p.send_queue_id::text
           AND w.status='dead_letter' AND p.status='failed'
           AND p.last_failure_retryable=true`
      );
      const unknownWork = await client.query(
        `INSERT INTO work_items (kind,entity_type,entity_id,dedupe_key,payload,priority)
         SELECT 'sync_delivery_unknown_to_crm','OutreachMatch',q.match_id,
                'crm-delivery-unknown:' || q.id::text,
                jsonb_build_object('sendQueueId',q.id,'errorCode',q.last_error_code),10
         FROM send_queue q
         WHERE q.status='delivery_unknown'
         ORDER BY q.created_at ASC
         LIMIT $1
         ON CONFLICT (dedupe_key) DO NOTHING`,
        [boundedLimit]
      );
      const responseWork = await client.query(
        `INSERT INTO work_items (kind,entity_type,entity_id,dedupe_key,payload,priority)
         SELECT 'sync_response_to_crm','OutreachMatch',q.match_id,
                'crm-response:' || q.id::text,
                jsonb_build_object(
                  'responseQueueId',q.id,
                  'providerMessageId',q.provider_message_id,
                  'correlationId',COALESCE(a.correlation_id,'reconciled:' || q.id::text),
                  'acceptedAt',q.sent_at
                ),20
         FROM response_queue q
         LEFT JOIN LATERAL (
           SELECT correlation_id FROM response_delivery_attempts
           WHERE response_queue_id=q.id AND status='accepted'
           ORDER BY attempt_number DESC LIMIT 1
         ) a ON true
         WHERE q.status='sent' AND q.provider_message_id IS NOT NULL AND q.sent_at IS NOT NULL
         ORDER BY q.sent_at ASC
         LIMIT $1
         ON CONFLICT (dedupe_key) DO NOTHING`,
        [boundedLimit]
      );
      return Object.freeze({
        recovered: recovered.rowCount,
        deliveryWork: deliveryWork.rowCount,
        revived: revived.rowCount,
        unknownWork: unknownWork.rowCount,
        responseWork: responseWork.rowCount
      });
    });
  }

  async recordContactGenreDenials({ contactId, genres, sourceEventId, matchId, releaseId }) {
    const normalizedGenres = normalizeGenreDenials(genres);
    if (!normalizedGenres.length) {
      throw Object.assign(new Error("At least one canonical release genre is required"), {
        code: "CONTACT_GENRE_DENIAL_EMPTY",
        retryable: false
      });
    }
    const contactHash = this.cryptoBox.subjectHash(`contact:${contactId}`);
    const result = await this.pool.query(
      `INSERT INTO contact_genre_denials
        (contact_id,genre,source_event_id,match_id,release_id,privacy_record_id,contact_hash,
         source_event_hash,match_hash,release_hash)
       SELECT $1,genre,$3,$4,$5,gen_random_uuid(),$6,$7,$8,$9 FROM unnest($2::text[]) AS genre
       ON CONFLICT (contact_hash,genre) WHERE contact_hash IS NOT NULL DO NOTHING`,
      [contactId, normalizedGenres, sourceEventId, matchId, releaseId, contactHash,
        this.cryptoBox.integrityHash(`genre-denial-event:${sourceEventId}`),
        this.cryptoBox.integrityHash(`genre-denial-match:${matchId}`),
        this.cryptoBox.integrityHash(`genre-denial-release:${releaseId}`)]
    );
    return result.rowCount;
  }

  async hasContactGenreDenial(contactId, genres) {
    const normalizedGenres = normalizeGenreDenials(genres);
    if (!contactId || !normalizedGenres.length) return false;
    const contactHash = this.cryptoBox.subjectHash(`contact:${contactId}`);
    const result = await this.pool.query(
      `SELECT 1 FROM contact_genre_denials
       WHERE (contact_hash=$1 OR (contact_hash IS NULL AND contact_id=$2))
         AND genre=ANY($3::text[]) LIMIT 1`,
      [contactHash, contactId, normalizedGenres]
    );
    return result.rowCount > 0;
  }

  async getContactGenreDenials(contactId) {
    if (!contactId) return Object.freeze([]);
    const contactHash = this.cryptoBox.subjectHash(`contact:${contactId}`);
    const result = await this.pool.query(
      `SELECT genre FROM contact_genre_denials
       WHERE contact_hash=$1 OR (contact_hash IS NULL AND contact_id=$2) ORDER BY genre ASC`,
      [contactHash, contactId]
    );
    return Object.freeze(result.rows.map((row) => row.genre));
  }

  async getSendByIdempotencyKey(idempotencyKey) {
    const result = await this.pool.query("SELECT * FROM send_queue WHERE idempotency_key=$1", [idempotencyKey]);
    return result.rows[0] ? Object.freeze(result.rows[0]) : undefined;
  }

  async enqueueResponse({ matchId, releaseId, contactId, outletId, idempotencyKey, deterministicMessageId, payload, sendAt = new Date() }) {
    const encrypted = this.cryptoBox.encryptJson(payload, `response:${idempotencyKey}`);
    const result = await this.pool.query(
      `INSERT INTO response_queue
        (match_id,release_id,contact_id,outlet_id,idempotency_key,deterministic_message_id,payload_ciphertext,payload_iv,payload_tag,key_version,send_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
      [matchId, releaseId, contactId, outletId, idempotencyKey, deterministicMessageId, encrypted.ciphertext, encrypted.iv, encrypted.tag, encrypted.keyVersion, sendAt]
    );
    return result.rows[0]?.id;
  }

  async enqueueHumanReview({
    reviewType,
    source,
    sourceEventId,
    matchId,
    contactId,
    outletId,
    reason,
    proposedAction,
    evidence,
    createdBy = "outreach-worker"
  }) {
    const associatedData = humanReviewAssociatedData(source, sourceEventId, reviewType);
    const encrypted = this.cryptoBox.encryptJson(evidence ?? {}, associatedData);
    const inserted = await this.pool.query(
      `INSERT INTO human_review_items
        (review_type,source,source_event_id,match_id,contact_id,outlet_id,reason,proposed_action,
         evidence_ciphertext,evidence_iv,evidence_tag,key_version,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (source,source_event_id,review_type) DO NOTHING
       RETURNING id`,
      [
        reviewType,
        boundedText(source, 80, "unknown"),
        boundedText(sourceEventId, 250, "unknown"),
        matchId ?? null,
        contactId ?? null,
        outletId ?? null,
        boundedText(reason, 250, "human_review_required"),
        proposedAction ? boundedText(proposedAction, 250, "review") : null,
        encrypted.ciphertext,
        encrypted.iv,
        encrypted.tag,
        encrypted.keyVersion,
        boundedText(createdBy, 120, "outreach-worker")
      ]
    );
    if (inserted.rowCount) return inserted.rows[0].id;
    const existing = await this.pool.query(
      `SELECT id FROM human_review_items
       WHERE source=$1 AND source_event_id=$2 AND review_type=$3`,
      [source, sourceEventId, reviewType]
    );
    return existing.rows[0]?.id;
  }

  async readHumanReviewEvidence(id) {
    const result = await this.pool.query("SELECT * FROM human_review_items WHERE id=$1", [id]);
    const row = result.rows[0];
    if (!row) return undefined;
    return this.cryptoBox.decryptJson(
      {
        ciphertext: row.evidence_ciphertext,
        iv: row.evidence_iv,
        tag: row.evidence_tag,
        keyVersion: row.key_version
      },
      humanReviewAssociatedData(row.source, row.source_event_id, row.review_type)
    );
  }

  async decideHumanReview({ id, decision, reason, actor }) {
    if (!new Set(["approved", "rejected"]).has(decision)) {
      throw Object.assign(new Error("A valid human-review decision is required"), {
        code: "HUMAN_REVIEW_DECISION_INVALID",
        retryable: false
      });
    }
    const result = await this.pool.query(
      `UPDATE human_review_items SET status=$2,decision=$2,decision_reason=$3,decided_by=$4,
         decided_at=now(),updated_at=now()
       WHERE id=$1 AND status='pending'
       RETURNING id,status,decision,decided_by,decided_at`,
      [id, decision, boundedText(reason, 1_000, "decision_recorded"), boundedText(actor, 120, "unknown-reviewer")]
    );
    return result.rows[0] ? Object.freeze(result.rows[0]) : undefined;
  }

  async claimResponse(workerId, leaseSeconds = 120) {
    return withTransaction(this.pool, async (client) => {
      const result = await client.query(
        `SELECT * FROM response_queue
         WHERE status IN ('ready','failed') AND send_at <= now()
           AND (locked_until IS NULL OR locked_until < now())
         ORDER BY send_at ASC, created_at ASC
         FOR UPDATE SKIP LOCKED LIMIT 1`
      );
      const row = result.rows[0];
      if (!row) return undefined;
      const updated = await client.query(
        `UPDATE response_queue SET status='sending', attempts=attempts+1, locked_by=$2,
          locked_until=now()+make_interval(secs => $3) WHERE id=$1 RETURNING *`,
        [row.id, workerId, leaseSeconds]
      );
      return Object.freeze(updated.rows[0]);
    });
  }

  async cancelClaimedResponse(id, reason = "response_suppressed") {
    await this.pool.query(
      `UPDATE response_queue SET status='canceled',last_error_code=$2,locked_until=NULL,locked_by=NULL
       WHERE id=$1 AND status='sending'`,
      [id, reason]
    );
  }

  async deferClaimedResponse(queueItem, { code, delaySeconds = 300 }) {
    const result = await this.pool.query(
      `UPDATE response_queue SET status='ready',attempts=GREATEST(attempts-1,0),last_error_code=$2,
         send_at=now()+make_interval(secs => $3),locked_until=NULL,locked_by=NULL
       WHERE id=$1 AND status='sending' AND locked_by=$4`,
      [queueItem.id, code, delaySeconds, queueItem.locked_by]
    );
    return result.rowCount === 1;
  }

  async authorizeClaimedResponse(queueItem, {
    globalDailyLimit,
    contactDailyLimit,
    businessDate,
    businessDayStart,
    businessDayEnd
  }) {
    assertBusinessDayWindow({ businessDate, businessDayStart, businessDayEnd });
    return withTransaction(this.pool, async (client) => {
      await acquireTransactionAdvisoryLock(client, "automatic-response-global", this.databaseLimits);
      const claimed = await client.query(
        `SELECT 1 FROM response_queue
         WHERE id=$1 AND status='sending' AND locked_by=$2 FOR UPDATE`,
        [queueItem.id, queueItem.locked_by]
      );
      if (!claimed.rowCount) return Object.freeze({ allowed: false, reason: "response_claim_lost" });
      const circuit = await client.query("SELECT state FROM safety_state WHERE name='global-send-circuit' FOR UPDATE");
      const circuitState = circuit.rows[0]?.state;
      if (circuitState !== "closed") {
        return Object.freeze({
          allowed: false,
          reason: circuitState === "open" ? "circuit_open" : "circuit_state_unavailable"
        });
      }
      const counts = await client.query(
        `SELECT
           count(*) FILTER (WHERE created_at >= $2 AND created_at < $3 AND status IN ('sending','sent','delivery_unknown'))::int AS global_count,
           count(*) FILTER (WHERE contact_id=$1 AND created_at >= now()-interval '24 hours' AND status IN ('sending','sent','delivery_unknown'))::int AS contact_count
         FROM response_queue`,
        [queueItem.contact_id, businessDayStart, businessDayEnd]
      );
      if (counts.rows[0].global_count > globalDailyLimit) {
        return Object.freeze({ allowed: false, reason: "automatic_response_global_limit" });
      }
      if (counts.rows[0].contact_count > contactDailyLimit) {
        return Object.freeze({ allowed: false, reason: "automatic_response_contact_limit" });
      }
      return Object.freeze({ allowed: true });
    });
  }

  async markResponsePreflightFailure(queueItem, { code, retryable }) {
    const status = retryable && queueItem.attempts < MAX_ATTEMPTS ? "failed" : "dead_letter";
    const delaySeconds = Math.min(3_600, 30 * 2 ** Math.max(0, queueItem.attempts - 1));
    const result = await this.pool.query(
      `UPDATE response_queue SET status=$2,last_error_code=$3,locked_until=NULL,locked_by=NULL,
         send_at=CASE WHEN $2='failed' THEN now()+make_interval(secs => $4) ELSE send_at END
       WHERE id=$1 AND status='sending' AND locked_by=$5`,
      [queueItem.id, status, code, delaySeconds, queueItem.locked_by]
    );
    return result.rowCount === 1;
  }

  async findResponseByMessageId(messageId) {
    if (!messageId) return undefined;
    const result = await this.pool.query(
      "SELECT * FROM response_queue WHERE provider_message_id=$1 OR deterministic_message_id=$1 LIMIT 1",
      [messageId]
    );
    return result.rows[0] ? Object.freeze(result.rows[0]) : undefined;
  }

  readResponsePayload(row) {
    return this.cryptoBox.decryptJson(
      { ciphertext: row.payload_ciphertext, iv: row.payload_iv, tag: row.payload_tag, keyVersion: row.key_version },
      `response:${row.idempotency_key}`
    );
  }

  async beginResponseAttempt(queueItem) {
    const correlationId = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO response_delivery_attempts (response_queue_id,attempt_number,status,correlation_id)
       SELECT $1,$2,'started',$3
       WHERE EXISTS (
         SELECT 1 FROM response_queue
         WHERE id=$1 AND status='sending' AND locked_by=$4
       )
       RETURNING correlation_id`,
      [queueItem.id, queueItem.attempts, correlationId, queueItem.locked_by]
    );
    if (!result.rowCount) {
      throw Object.assign(new Error("The response queue lease was lost before the provider attempt"), {
        code: "RESPONSE_LEASE_LOST",
        retryable: false,
        deliveryUnknown: false
      });
    }
    return correlationId;
  }

  async markResponseAccepted(queueItem, correlationId, providerMessageId) {
    return withTransaction(this.pool, async (client) => {
      const committed = await client.query(
        `UPDATE response_queue SET status='sent',provider_message_id=$2,sent_at=now(),locked_until=NULL,locked_by=NULL
         WHERE id=$1 AND status='sending' AND locked_by=$3
         RETURNING id,sent_at`,
        [queueItem.id, providerMessageId, queueItem.locked_by]
      );
      if (!committed.rowCount) return false;
      await client.query(
        `UPDATE response_delivery_attempts SET status='accepted',provider_message_id=$3,finished_at=now()
         WHERE response_queue_id=$1 AND attempt_number=$2`,
        [queueItem.id, queueItem.attempts, providerMessageId]
      );
      await client.query(
        `INSERT INTO outcome_events (match_id,event_type,provider_event_id,occurred_at)
         VALUES ($1,'automatic_reply_sent',$2,now()) ON CONFLICT (provider_event_id) DO NOTHING`,
        [queueItem.match_id, `response:${providerMessageId}`]
      );
      await client.query(
        `INSERT INTO work_items (kind,entity_type,entity_id,dedupe_key,payload,priority)
         VALUES ('sync_response_to_crm','OutreachMatch',$1,$2,$3::jsonb,20)
         ON CONFLICT (dedupe_key) DO NOTHING`,
        [
          queueItem.match_id,
          `crm-response:${queueItem.id}`,
          JSON.stringify({
            responseQueueId: queueItem.id,
            providerMessageId,
            correlationId,
            acceptedAt: committed.rows[0].sent_at
          })
        ]
      );
      return true;
    });
  }

  async getResponse(id) {
    const result = await this.pool.query("SELECT * FROM response_queue WHERE id=$1", [id]);
    return result.rows[0] ? Object.freeze(result.rows[0]) : undefined;
  }

  async markResponseFailure(queueItem, correlationId, { code, retryable, deliveryUnknown }) {
    const attemptStatus = deliveryUnknown ? "delivery_unknown" : "definite_failure";
    const queueStatus = deliveryUnknown ? "delivery_unknown" : retryable && queueItem.attempts < MAX_ATTEMPTS ? "failed" : "dead_letter";
    const delaySeconds = Math.min(3_600, 60 * 2 ** Math.max(0, queueItem.attempts - 1));
    return withTransaction(this.pool, async (client) => {
      const committed = await client.query(
        `UPDATE response_queue SET status=$2,last_error_code=$3,locked_until=NULL,locked_by=NULL,
          send_at=CASE WHEN $2='failed' THEN now()+make_interval(secs => $4) ELSE send_at END
         WHERE id=$1 AND status='sending' AND locked_by=$5
         RETURNING id`,
        [queueItem.id, queueStatus, code, delaySeconds, queueItem.locked_by]
      );
      if (!committed.rowCount) return false;
      await client.query(
        `UPDATE response_delivery_attempts SET status=$3,error_code=$4,finished_at=now()
         WHERE response_queue_id=$1 AND attempt_number=$2`,
        [queueItem.id, queueItem.attempts, attemptStatus, code]
      );
      return true;
    });
  }

  async isSuppressed({ contactId, outletId, email, domain }) {
    const checks = [
      ["contact", contactId],
      ["outlet", outletId],
      ["email", email],
      ["domain", domain]
    ].filter(([, value]) => value);
    if (!checks.length) return false;
    const clauses = checks.map((_, index) => `(subject_type=$${index * 2 + 1} AND subject_hash=$${index * 2 + 2})`).join(" OR ");
    const values = checks.flatMap(([type, value]) => [type, this.cryptoBox.privacyHash(`${type}:${value}`)]);
    const result = await this.pool.query(`SELECT 1 FROM suppression_cache WHERE active=true AND (${clauses}) LIMIT 1`, values);
    return Boolean(result.rowCount);
  }

  suppressionHash(subjectType, subject) {
    return this.cryptoBox.privacyHash(`${subjectType}:${subject}`);
  }

  async suppress({ subjectType, subject, reason, source }) {
    if (!SUPPRESSION_SUBJECT_TYPES.has(subjectType) || subject === undefined || subject === null || !String(subject).trim()) {
      throw Object.assign(new Error("A valid suppression subject is required"), {
        code: "SUPPRESSION_SUBJECT_INVALID",
        retryable: false
      });
    }
    const hash = this.suppressionHash(subjectType, subject);
    await withTransaction(this.pool, async (client) => {
      await acquireTransactionAdvisoryLock(client, suppressionFenceKey(subjectType, subject), this.databaseLimits);
      await client.query(
        `INSERT INTO suppression_cache (subject_type, subject_hash, reason, source)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (subject_type, subject_hash)
         DO UPDATE SET active=true, reason=EXCLUDED.reason, source=EXCLUDED.source, last_seen_at=now()`,
        [subjectType, hash, boundedText(reason, 120, "unspecified"), boundedText(source, 120, "unspecified")]
      );
    });
    return hash;
  }

  async reserveSendCapacity(queueItem, domain, {
    dailyLimit,
    releaseLimit,
    domainLimit,
    businessDate,
    outletCooldownDays = 14
  }) {
    assertBusinessDate(businessDate);
    const globalHash = this.cryptoBox.privacyHash("global");
    const releaseHash = this.cryptoBox.privacyHash(`release:${queueItem.release_id}`);
    const domainHash = this.cryptoBox.privacyHash(domain);
    return withTransaction(this.pool, async (client) => {
      const claimed = await client.query(
        `SELECT id FROM send_queue
         WHERE id=$1 AND status='sending' AND locked_by=$2
         FOR UPDATE`,
        [queueItem.id, queueItem.locked_by]
      );
      if (!claimed.rowCount) return Object.freeze({ allowed: false, reason: "send_claim_lost" });
      const circuit = await client.query("SELECT * FROM safety_state WHERE name='global-send-circuit' FOR UPDATE");
      const state = circuit.rows[0];
      if (state?.state !== "closed") {
        return Object.freeze({
          allowed: false,
          reason: state?.state === "open" ? "circuit_open" : "circuit_state_unavailable"
        });
      }
      const existing = await client.query(
        `SELECT status FROM send_capacity_reservations
         WHERE send_queue_id=$1 AND counter_date=$2::date FOR UPDATE`,
        [queueItem.id, businessDate]
      );
      if (["reserved", "consumed"].includes(existing.rows[0]?.status)) {
        const outletGuard = await reserveOutletFirstSendGuard(
          client,
          queueItem,
          outletCooldownDays,
          this.cryptoBox,
          this.databaseLimits
        );
        return outletGuard.allowed
          ? Object.freeze({ allowed: true, alreadyReserved: true })
          : outletGuard;
      }

      const global = await incrementCounter(client, businessDate, "global", globalHash, dailyLimit);
      if (!global.allowed) return global;
      const perRelease = await incrementCounter(client, businessDate, "release", releaseHash, releaseLimit);
      if (!perRelease.allowed) {
        await decrementCounter(client, businessDate, "global", globalHash);
        return perRelease;
      }
      const perDomain = await incrementCounter(client, businessDate, "domain", domainHash, domainLimit);
      if (!perDomain.allowed) {
        await decrementCounter(client, businessDate, "release", releaseHash);
        await decrementCounter(client, businessDate, "global", globalHash);
        return perDomain;
      }
      const outletGuard = await reserveOutletFirstSendGuard(
        client,
        queueItem,
        outletCooldownDays,
        this.cryptoBox,
        this.databaseLimits
      );
      if (!outletGuard.allowed) {
        await decrementCounter(client, businessDate, "domain", domainHash);
        await decrementCounter(client, businessDate, "release", releaseHash);
        await decrementCounter(client, businessDate, "global", globalHash);
        return outletGuard;
      }
      await client.query(
        `INSERT INTO send_capacity_reservations
          (send_queue_id,counter_date,global_hash,release_hash,domain_hash,status)
         VALUES ($1,$2::date,$3,$4,$5,'reserved')
         ON CONFLICT (send_queue_id,counter_date) DO UPDATE SET
           global_hash=EXCLUDED.global_hash,release_hash=EXCLUDED.release_hash,
           domain_hash=EXCLUDED.domain_hash,status='reserved',reserved_at=now(),finalized_at=NULL`,
        [queueItem.id, businessDate, globalHash, releaseHash, domainHash]
      );
      await client.query(
        `UPDATE send_queue SET capacity_business_date=$2::date
         WHERE id=$1 AND status='sending' AND locked_by=$3`,
        [queueItem.id, businessDate, queueItem.locked_by]
      );
      return Object.freeze({ allowed: true, globalCount: global.count, releaseCount: perRelease.count, domainCount: perDomain.count });
    });
  }

  async releaseSendCapacity(queueItem) {
    return withTransaction(this.pool, (client) => releaseCapacityReservation(client, queueItem.id));
  }

  async recordOutcome({ matchId, sendQueueId, eventType, providerEventId, occurredAt = new Date() }) {
    await this.pool.query(
      `INSERT INTO outcome_events (match_id, send_queue_id, event_type, provider_event_id, occurred_at)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (provider_event_id) DO NOTHING`,
      [matchId, sendQueueId, eventType, providerEventId, occurredAt]
    );
  }

  async healthWindow(hours = 24) {
    const result = await this.pool.query(
      `SELECT
         count(*) FILTER (WHERE event_type='sent')::int AS sent,
         count(*) FILTER (WHERE event_type IN ('hard_bounce','complained','unsubscribed'))::int AS harmful,
         count(*) FILTER (WHERE event_type IN ('definite_failure','delivery_unknown'))::int AS failed
       FROM outcome_events WHERE occurred_at >= now()-make_interval(hours => $1)`,
      [hours]
    );
    return Object.freeze(result.rows[0]);
  }

  async operationalSnapshot() {
    const result = await this.pool.query(
      `SELECT
         (SELECT count(*)::int FROM work_items WHERE status IN ('pending','failed','processing')) AS work_depth,
         (SELECT count(*)::int FROM send_queue WHERE status IN ('ready','failed','sending')) AS send_depth,
         (SELECT count(*)::int FROM response_queue WHERE status IN ('ready','failed','sending')) AS response_depth,
         (SELECT count(*)::int FROM encrypted_event_inbox WHERE status IN ('pending','failed','processing')) AS event_depth,
         COALESCE((SELECT extract(epoch FROM now()-min(created_at))::bigint FROM work_items WHERE status IN ('pending','failed','processing')),0) AS oldest_work_seconds,
         COALESCE((SELECT extract(epoch FROM now()-min(created_at))::bigint FROM encrypted_event_inbox WHERE status IN ('pending','failed','processing')),0) AS oldest_event_seconds,
         (SELECT count(*)::int FROM work_items WHERE status='dead_letter') AS work_dead_letters,
         (SELECT count(*)::int FROM send_queue WHERE status='dead_letter') AS send_dead_letters,
         (SELECT count(*)::int FROM response_queue WHERE status='dead_letter') AS response_dead_letters,
         (SELECT count(*)::int FROM send_queue WHERE status='delivery_unknown') AS delivery_unknown,
         COALESCE((SELECT extract(epoch FROM now()-max(finished_at))::bigint FROM workflow_runs WHERE workflow_name='outreach-full-reconcile' AND status='succeeded'),-1) AS full_reconcile_age_seconds,
         COALESCE((SELECT extract(epoch FROM now()-max(finished_at))::bigint FROM workflow_runs WHERE workflow_name='outreach-incremental-reconcile' AND status='succeeded'),-1) AS incremental_reconcile_age_seconds`
    );
    return Object.freeze(result.rows[0]);
  }

  async quarantineStaleDeliveryClaims() {
    return withTransaction(this.pool, async (client) => {
      const sends = await client.query(
        `UPDATE send_queue SET status='delivery_unknown',last_error_code='worker_lease_expired',locked_until=NULL,locked_by=NULL
         WHERE status='sending' AND locked_until < now() RETURNING id,match_id`
      );
      for (const row of sends.rows) {
        await client.query(
          `UPDATE delivery_attempts SET status='delivery_unknown',error_code='worker_lease_expired',finished_at=now()
           WHERE send_queue_id=$1 AND status='started'`,
          [row.id]
        );
        await client.query(
          `INSERT INTO outcome_events (match_id,send_queue_id,event_type,provider_event_id,occurred_at)
           VALUES ($1,$2,'delivery_unknown',$3,now()) ON CONFLICT (provider_event_id) DO NOTHING`,
          [row.match_id, row.id, `lease-expired:${row.id}`]
        );
        await client.query(
          `UPDATE send_capacity_reservations SET status='consumed',finalized_at=now()
           WHERE send_queue_id=$1 AND status='reserved'`,
          [row.id]
        );
        await client.query(
          `UPDATE outlet_first_send_guards SET status='consumed',consumed_at=now(),updated_at=now()
           WHERE send_queue_id=$1 AND status='reserved'`,
          [row.id]
        );
      }
      const responses = await client.query(
        `UPDATE response_queue SET status='delivery_unknown',last_error_code='worker_lease_expired',locked_until=NULL,locked_by=NULL
         WHERE status='sending' AND locked_until < now() RETURNING id`
      );
      for (const row of responses.rows) {
        await client.query(
          `UPDATE response_delivery_attempts SET status='delivery_unknown',error_code='worker_lease_expired',finished_at=now()
           WHERE response_queue_id=$1 AND status='started'`,
          [row.id]
        );
      }
      const allocations = await client.query(
        `UPDATE sequence_allocations a SET status='released',released_at=now(),cooldown_until=NULL,
           release_reason='stale_prequeue_allocation',updated_at=now()
         WHERE a.status='active' AND a.acquired_at < now()-interval '1 hour'
           AND NOT EXISTS (SELECT 1 FROM send_queue q WHERE q.match_id=a.match_id)
         RETURNING a.match_id`
      );
      return Object.freeze({ sends: sends.rowCount, responses: responses.rowCount, allocations: allocations.rowCount });
    });
  }

  async relinquishWorkerLeases(workerIds) {
    const owners = [...new Set((Array.isArray(workerIds) ? workerIds : [workerIds]).filter(Boolean))];
    if (!owners.length) return Object.freeze({ work: 0, safeSends: 0, unknownSends: 0, safeResponses: 0, unknownResponses: 0 });
    return withTransaction(this.pool, async (client) => {
      const work = await client.query(
        `UPDATE work_items SET status='failed',attempts=GREATEST(attempts-1,0),available_at=now(),
           last_error_code='worker_shutdown',locked_until=NULL,locked_by=NULL
         WHERE status='processing' AND locked_by=ANY($1::text[])`,
        [owners]
      );
      const safeSends = await client.query(
        `UPDATE send_queue q SET status='ready',attempts=GREATEST(q.attempts-1,0),send_at=now(),
           last_error_code='worker_shutdown',locked_until=NULL,locked_by=NULL
         WHERE q.status='sending' AND q.locked_by=ANY($1::text[])
           AND NOT EXISTS (
             SELECT 1 FROM delivery_attempts a
             WHERE a.send_queue_id=q.id AND a.attempt_number=q.attempts AND a.status='started'
           )
         RETURNING q.id`,
        [owners]
      );
      for (const row of safeSends.rows) await releaseCapacityReservation(client, row.id);
      const unknownSends = await client.query(
        `UPDATE send_queue q SET status='delivery_unknown',last_error_code='worker_shutdown_after_provider_start',
           locked_until=NULL,locked_by=NULL
         WHERE q.status='sending' AND q.locked_by=ANY($1::text[])
           AND EXISTS (
             SELECT 1 FROM delivery_attempts a
             WHERE a.send_queue_id=q.id AND a.attempt_number=q.attempts AND a.status='started'
           )
         RETURNING q.id,q.match_id,q.attempts`,
        [owners]
      );
      for (const row of unknownSends.rows) {
        await client.query(
          `UPDATE delivery_attempts SET status='delivery_unknown',error_code='worker_shutdown',finished_at=now()
           WHERE send_queue_id=$1 AND attempt_number=$2 AND status='started'`,
          [row.id, row.attempts]
        );
        await client.query(
          `INSERT INTO outcome_events (match_id,send_queue_id,event_type,provider_event_id,occurred_at)
           VALUES ($1,$2,'delivery_unknown',$3,now()) ON CONFLICT (provider_event_id) DO NOTHING`,
          [row.match_id, row.id, `shutdown:${row.id}:${row.attempts}`]
        );
        await client.query(
          `UPDATE send_capacity_reservations SET status='consumed',finalized_at=now()
           WHERE send_queue_id=$1 AND status='reserved'`,
          [row.id]
        );
        await client.query(
          `UPDATE outlet_first_send_guards SET status='consumed',consumed_at=now(),updated_at=now()
           WHERE send_queue_id=$1 AND status='reserved'`,
          [row.id]
        );
      }
      const safeResponses = await client.query(
        `UPDATE response_queue q SET status='ready',attempts=GREATEST(q.attempts-1,0),send_at=now(),
           last_error_code='worker_shutdown',locked_until=NULL,locked_by=NULL
         WHERE q.status='sending' AND q.locked_by=ANY($1::text[])
           AND NOT EXISTS (
             SELECT 1 FROM response_delivery_attempts a
             WHERE a.response_queue_id=q.id AND a.attempt_number=q.attempts AND a.status='started'
           )`,
        [owners]
      );
      const unknownResponses = await client.query(
        `UPDATE response_queue q SET status='delivery_unknown',last_error_code='worker_shutdown_after_provider_start',
           locked_until=NULL,locked_by=NULL
         WHERE q.status='sending' AND q.locked_by=ANY($1::text[])
           AND EXISTS (
             SELECT 1 FROM response_delivery_attempts a
             WHERE a.response_queue_id=q.id AND a.attempt_number=q.attempts AND a.status='started'
           )
         RETURNING q.id,q.attempts`,
        [owners]
      );
      for (const row of unknownResponses.rows) {
        await client.query(
          `UPDATE response_delivery_attempts SET status='delivery_unknown',error_code='worker_shutdown',finished_at=now()
           WHERE response_queue_id=$1 AND attempt_number=$2 AND status='started'`,
          [row.id, row.attempts]
        );
      }
      return Object.freeze({
        work: work.rowCount,
        safeSends: safeSends.rowCount,
        unknownSends: unknownSends.rowCount,
        safeResponses: safeResponses.rowCount,
        unknownResponses: unknownResponses.rowCount
      });
    });
  }

  async setCircuit({ open, reason, pauseMinutes = 60 }) {
    await this.pool.query(
      `UPDATE safety_state SET state=$2, reason=$3,
         opened_at=CASE WHEN $2='open' THEN now() ELSE NULL END,
         paused_until=CASE WHEN $2='open' THEN now()+make_interval(mins => $4) ELSE NULL END,
         updated_at=now() WHERE name=$1`,
      ["global-send-circuit", open ? "open" : "closed", reason, pauseMinutes]
    );
  }

  async getCircuit() {
    const result = await this.pool.query("SELECT * FROM safety_state WHERE name=$1", ["global-send-circuit"]);
    return result.rows[0] ? Object.freeze(result.rows[0]) : undefined;
  }

  async getWatermark(name, fallback) {
    const result = await this.pool.query("SELECT value FROM watermarks WHERE name=$1", [name]);
    return result.rows[0]?.value ?? fallback;
  }

  async setWatermark(name, value) {
    await this.pool.query(
      `INSERT INTO watermarks (name,value) VALUES ($1,$2)
       ON CONFLICT (name) DO UPDATE SET value=EXCLUDED.value, updated_at=now()`,
      [name, value]
    );
  }

  async acquireReconcileWorkflow({
    leaseName,
    ownerId,
    workflowName,
    scopeKind,
    watermarkFrom,
    watermarkTo,
    leaseSeconds = 120
  }) {
    return withTransaction(this.pool, async (client) => {
      await client.query(
        `INSERT INTO workflow_leases (lease_name)
         VALUES ($1) ON CONFLICT (lease_name) DO NOTHING`,
        [leaseName]
      );
      const selected = await client.query(
        "SELECT *, locked_until > now() AS lease_active FROM workflow_leases WHERE lease_name=$1 FOR UPDATE",
        [leaseName]
      );
      const current = selected.rows[0];
      if (current.owner_id && current.lease_active) {
        return Object.freeze({ acquired: false, reason: "lease_held" });
      }

      const resumable = ["running", "failed"].includes(current.checkpoint_status)
        && current.scope_kind === scopeKind;
      const effectiveFrom = resumable ? current.watermark_from : watermarkFrom;
      const effectiveTo = resumable ? current.watermark_to : watermarkTo;
      const routeIndex = resumable ? current.route_index : 0;
      const cursor = resumable && current.cursor_modified_at
        ? Object.freeze({ modifiedAt: toIsoString(current.cursor_modified_at), id: current.cursor_id ?? "" })
        : undefined;
      const counters = resumable ? current.counters : {};

      if (current.run_id) {
        await client.query(
          `UPDATE workflow_runs SET status='failed',error_code='RECONCILE_LEASE_EXPIRED',finished_at=now()
           WHERE id=$1 AND status='running'`,
          [current.run_id]
        );
      }
      const run = await client.query(
        `INSERT INTO workflow_runs (workflow_name,correlation_id,status,watermark_from,watermark_to,counters)
         VALUES ($1,$2,'running',$3,$4,$5::jsonb) RETURNING id`,
        [workflowName, ownerId, effectiveFrom, effectiveTo, JSON.stringify(counters)]
      );
      const acquired = await client.query(
        `UPDATE workflow_leases
         SET owner_id=$2,
             fence_token=fence_token+1,
             locked_until=now()+make_interval(secs => $3),
             workflow_name=$4,
             run_id=$5,
             scope_kind=$6,
             watermark_from=$7,
             watermark_to=$8,
             route_index=$9,
             cursor_modified_at=$10,
             cursor_id=$11,
             counters=$12::jsonb,
             checkpoint_status='running',
             last_error_code=NULL,
             acquired_at=now(),
             updated_at=now(),
             completed_at=NULL
         WHERE lease_name=$1
         RETURNING fence_token,locked_until,checkpoint_version`,
        [
          leaseName,
          ownerId,
          leaseSeconds,
          workflowName,
          run.rows[0].id,
          scopeKind,
          effectiveFrom,
          effectiveTo,
          routeIndex,
          cursor?.modifiedAt ?? null,
          cursor?.id ?? null,
          JSON.stringify(counters)
        ]
      );
      const row = acquired.rows[0];
      return Object.freeze({
        acquired: true,
        leaseName,
        ownerId,
        fenceToken: Number(row.fence_token),
        runId: run.rows[0].id,
        workflowName,
        scopeKind,
        watermarkFrom: new Date(effectiveFrom),
        watermarkTo: new Date(effectiveTo),
        routeIndex,
        cursor,
        counters: Object.freeze({ ...counters }),
        checkpointVersion: Number(row.checkpoint_version),
        resumed: resumable
      });
    });
  }

  async renewReconcileWorkflow(lease, leaseSeconds = 120) {
    const result = await this.pool.query(
      `UPDATE workflow_leases
       SET locked_until=now()+make_interval(secs => $5),updated_at=now()
       WHERE lease_name=$1 AND owner_id=$2 AND fence_token=$3 AND run_id=$4
         AND checkpoint_status='running'`,
      [lease.leaseName, lease.ownerId, lease.fenceToken, lease.runId, leaseSeconds]
    );
    return result.rowCount === 1;
  }

  async checkpointReconcileWorkflow(lease, { routeIndex, cursor, counters, leaseSeconds = 120 }) {
    const result = await this.pool.query(
      `UPDATE workflow_leases
       SET route_index=$5,
           cursor_modified_at=$6,
           cursor_id=$7,
           counters=$8::jsonb,
           checkpoint_version=checkpoint_version+1,
           locked_until=now()+make_interval(secs => $9),
           updated_at=now()
       WHERE lease_name=$1 AND owner_id=$2 AND fence_token=$3 AND run_id=$4
         AND checkpoint_status='running'
       RETURNING checkpoint_version`,
      [
        lease.leaseName,
        lease.ownerId,
        lease.fenceToken,
        lease.runId,
        routeIndex,
        cursor?.modifiedAt ?? null,
        cursor?.id ?? null,
        JSON.stringify(counters),
        leaseSeconds
      ]
    );
    if (!result.rowCount) throw reconcileLeaseLost();
    return Number(result.rows[0].checkpoint_version);
  }

  async completeReconcileWorkflow(lease, { routeIndex, counters, watermarkName, watermarkValue }) {
    return withTransaction(this.pool, async (client) => {
      const released = await client.query(
        `UPDATE workflow_leases
         SET owner_id=NULL,locked_until=NULL,route_index=$5,cursor_modified_at=NULL,cursor_id=NULL,
             counters=$6::jsonb,checkpoint_status='succeeded',checkpoint_version=checkpoint_version+1,
             last_error_code=NULL,updated_at=now(),completed_at=now()
         WHERE lease_name=$1 AND owner_id=$2 AND fence_token=$3 AND run_id=$4
           AND checkpoint_status='running'
         RETURNING checkpoint_version`,
        [lease.leaseName, lease.ownerId, lease.fenceToken, lease.runId, routeIndex, JSON.stringify(counters)]
      );
      if (!released.rowCount) throw reconcileLeaseLost();
      await client.query(
        `INSERT INTO watermarks (name,value) VALUES ($1,$2)
         ON CONFLICT (name) DO UPDATE SET value=EXCLUDED.value,updated_at=now()`,
        [watermarkName, watermarkValue]
      );
      await client.query(
        `UPDATE workflow_runs SET status='succeeded',counters=$2::jsonb,error_code=NULL,finished_at=now()
         WHERE id=$1 AND status='running'`,
        [lease.runId, JSON.stringify(counters)]
      );
      return Number(released.rows[0].checkpoint_version);
    });
  }

  async failReconcileWorkflow(lease, { counters, errorCode }) {
    return withTransaction(this.pool, async (client) => {
      const released = await client.query(
        `UPDATE workflow_leases
         SET owner_id=NULL,locked_until=NULL,counters=$5::jsonb,checkpoint_status='failed',
             checkpoint_version=checkpoint_version+1,last_error_code=$6,updated_at=now()
         WHERE lease_name=$1 AND owner_id=$2 AND fence_token=$3 AND run_id=$4
           AND checkpoint_status='running'`,
        [lease.leaseName, lease.ownerId, lease.fenceToken, lease.runId, JSON.stringify(counters), errorCode]
      );
      if (!released.rowCount) return false;
      await client.query(
        `UPDATE workflow_runs SET status='failed',counters=$2::jsonb,error_code=$3,finished_at=now()
         WHERE id=$1 AND status='running'`,
        [lease.runId, JSON.stringify(counters), errorCode]
      );
      return true;
    });
  }

  async startWorkflow(name, correlationId, watermarkFrom, watermarkTo) {
    const result = await this.pool.query(
      `INSERT INTO workflow_runs (workflow_name, correlation_id, status, watermark_from, watermark_to)
       VALUES ($1,$2,'running',$3,$4) RETURNING id`,
      [name, correlationId, watermarkFrom, watermarkTo]
    );
    return result.rows[0].id;
  }

  async finishWorkflow(id, { succeeded, counters = {}, errorCode }) {
    await this.pool.query(
      `UPDATE workflow_runs SET status=$2, counters=$3::jsonb, error_code=$4, finished_at=now() WHERE id=$1`,
      [id, succeeded ? "succeeded" : "failed", JSON.stringify(counters), errorCode]
    );
  }

  async beginLegacyMigrationRun({ runId, migrationVersion, sourceDigest, scopeLimit }) {
    const normalizedScopeLimit = Number.isFinite(scopeLimit) ? scopeLimit : null;
    return withTransaction(this.pool, async (client) => {
      await client.query(
        `INSERT INTO legacy_migration_runs (run_id,migration_version,source_digest,scope_limit,status)
         VALUES ($1,$2,$3,$4,'running') ON CONFLICT (run_id) DO NOTHING`,
        [runId, migrationVersion, sourceDigest, normalizedScopeLimit]
      );
      const result = await client.query("SELECT * FROM legacy_migration_runs WHERE run_id=$1 FOR UPDATE", [runId]);
      const row = result.rows[0];
      if (!row || row.migration_version !== migrationVersion || row.source_digest !== sourceDigest || row.scope_limit !== normalizedScopeLimit) {
        throw Object.assign(new Error("Legacy migration checkpoint contract mismatch"), { code: "LEGACY_MIGRATION_CHECKPOINT_MISMATCH", retryable: false });
      }
      if (row.status !== "succeeded") {
        await client.query("UPDATE legacy_migration_runs SET status='running',last_error_code=NULL,updated_at=now() WHERE run_id=$1", [runId]);
      }
      return Object.freeze({ status: row.status, nextOffset: row.next_contact_offset, counters: row.counters });
    });
  }

  async checkpointLegacyMigration(runId, nextOffset, counters) {
    const result = await this.pool.query(
      `UPDATE legacy_migration_runs
       SET next_contact_offset=GREATEST(next_contact_offset,$2),
           counters=CASE WHEN $2 >= next_contact_offset THEN $3::jsonb ELSE counters END,
           updated_at=now()
       WHERE run_id=$1 AND status='running'
       RETURNING next_contact_offset`,
      [runId, nextOffset, JSON.stringify(counters)]
    );
    if (result.rowCount !== 1) {
      throw Object.assign(new Error("Legacy migration checkpoint is not running"), { code: "LEGACY_MIGRATION_CHECKPOINT_MISMATCH", retryable: false });
    }
  }

  async finishLegacyMigrationRun(runId, { succeeded, counters, errorCode }) {
    const result = await this.pool.query(
      `UPDATE legacy_migration_runs SET status=$2,counters=$3::jsonb,last_error_code=$4,
         updated_at=now(),finished_at=CASE WHEN $2='succeeded' THEN now() ELSE finished_at END
       WHERE run_id=$1 AND status='running'
       RETURNING run_id`,
      [runId, succeeded ? "succeeded" : "failed", JSON.stringify(counters ?? {}), errorCode]
    );
    if (result.rowCount !== 1) {
      throw Object.assign(new Error("Legacy migration run cannot be finalized from its current state"), { code: "LEGACY_MIGRATION_CHECKPOINT_MISMATCH", retryable: false });
    }
  }

  async summaryForDate({ businessDate, start, end }) {
    assertBusinessDayWindow({ businessDate, businessDayStart: start, businessDayEnd: end });
    const result = await this.pool.query(
      `SELECT
         count(*) FILTER (WHERE oe.event_type='sent' AND sq.sequence_step=0)::int AS initial_emails_sent,
         count(*) FILTER (WHERE oe.event_type='sent' AND sq.sequence_step>0)::int AS follow_ups_sent,
         count(*) FILTER (WHERE oe.event_type='replied')::int AS replies_received,
         count(*) FILTER (WHERE oe.event_type='positive_reply')::int AS positive_replies,
         count(*) FILTER (WHERE oe.event_type='hard_bounce')::int AS hard_bounces,
         count(*) FILTER (WHERE oe.event_type='soft_bounce')::int AS soft_bounces,
         count(*) FILTER (WHERE oe.event_type='unsubscribed')::int AS opt_outs,
         count(*) FILTER (WHERE oe.event_type='placement_confirmed')::int AS placements
       FROM outcome_events oe
       LEFT JOIN send_queue sq ON sq.id=oe.send_queue_id
       WHERE oe.occurred_at >= $1 AND oe.occurred_at < $2`,
      [start, end]
    );
    return Object.freeze(result.rows[0]);
  }

  async jobSummaryForDate({ businessDate, start, end }) {
    assertBusinessDayWindow({ businessDate, businessDayStart: start, businessDayEnd: end });
    const result = await this.pool.query(
      `SELECT
         count(*) FILTER (WHERE status='completed')::int AS completed_jobs,
         count(*) FILTER (WHERE status='dead_letter')::int AS failed_jobs
       FROM work_items WHERE created_at >= $1 AND created_at < $2`,
      [start, end]
    );
    return Object.freeze(result.rows[0]);
  }
}

async function reconcileCampaignOutletLedger(client, cryptoBox, { releaseId, outletId, releaseHash, outletHash }) {
  const durableCounter = await client.query(
    `SELECT allocated_count
       FROM campaign_outlet_allocation_counters
      WHERE release_hash=$1 AND outlet_hash=$2`,
    [releaseHash, outletHash]
  );
  // A saturated counter is the permanent deny-wins safety fact. In particular,
  // privacy retention deliberately saturates this aggregate before destroying
  // person-linkable ledger hashes. Rebuilding those hashes from older queue
  // history would undo the tombstone without creating any usable capacity.
  if (Number(durableCounter.rows[0]?.allocated_count ?? 0) >= CAMPAIGN_OUTLET_LIFETIME_CAP) return;
  const historical = await client.query(
    `WITH allocation_evidence AS (
       SELECT match_id,contact_id,recipient_hash,acquired_at AS allocated_at
         FROM sequence_allocations
        WHERE release_id=$1 AND outlet_id=$2
       UNION ALL
       SELECT match_id,contact_id,recipient_hash,created_at AS allocated_at
         FROM send_queue
        WHERE release_id=$1 AND outlet_id=$2
     )
     SELECT DISTINCT ON (contact_id)
       match_id,contact_id,recipient_hash,allocated_at
       FROM allocation_evidence
      ORDER BY contact_id,allocated_at,match_id`,
    [releaseId, outletId]
  );
  if (historical.rowCount > CAMPAIGN_OUTLET_LIFETIME_CAP) {
    throw Object.assign(new Error("Historical campaign/outlet allocations already exceed the compiled lifetime cap"), {
      code: "CAMPAIGN_OUTLET_HISTORICAL_CAP_EXCEEDED",
      retryable: false
    });
  }
  for (const row of historical.rows) {
    await client.query(
      `INSERT INTO campaign_outlet_allocation_ledger
         (allocation_hash,release_hash,outlet_hash,contact_hash,outlet_subject_hash,recipient_hash,allocated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT DO NOTHING`,
      [
        cryptoBox.privacyHash(`campaign-outlet-match:${row.match_id}`),
        releaseHash,
        outletHash,
        cryptoBox.subjectHash(`contact:${row.contact_id}`),
        cryptoBox.subjectHash(`outlet:${outletId}`),
        row.recipient_hash,
        row.allocated_at
      ]
    );
  }
  const count = await client.query(
    `SELECT LEAST($3,count(*))::smallint AS allocated_count
       FROM campaign_outlet_allocation_ledger
      WHERE release_hash=$1 AND outlet_hash=$2`,
    [releaseHash, outletHash, CAMPAIGN_OUTLET_LIFETIME_CAP]
  );
  await client.query(
    `INSERT INTO campaign_outlet_allocation_counters
       (release_hash,outlet_hash,allocated_count)
     VALUES ($1,$2,$3)
     ON CONFLICT (release_hash,outlet_hash) DO UPDATE SET
       allocated_count=GREATEST(
         campaign_outlet_allocation_counters.allocated_count,
         EXCLUDED.allocated_count
       ),
       updated_at=CASE
         WHEN campaign_outlet_allocation_counters.allocated_count < EXCLUDED.allocated_count
         THEN now() ELSE campaign_outlet_allocation_counters.updated_at END`,
    [releaseHash, outletHash, count.rows[0].allocated_count]
  );
}

async function incrementCounter(client, businessDate, type, subjectHash, limit) {
  const result = await client.query(
    `INSERT INTO send_counters (counter_date, counter_type, subject_hash, sent_count)
     VALUES ($1::date,$2,$3,1)
     ON CONFLICT (counter_date,counter_type,subject_hash)
     DO UPDATE SET sent_count=send_counters.sent_count+1, updated_at=now()
       WHERE send_counters.sent_count < $4
     RETURNING sent_count`,
    [businessDate, type, subjectHash, limit]
  );
  if (!result.rowCount) return Object.freeze({ allowed: false, reason: `${type}_send_limit_reached`, count: limit });
  const count = result.rows[0].sent_count;
  return Object.freeze({ allowed: true, count });
}

async function decrementCounter(client, businessDate, type, subjectHash) {
  await client.query(
    `UPDATE send_counters SET sent_count=GREATEST(sent_count-1,0),updated_at=now()
     WHERE counter_date=$1::date AND counter_type=$2 AND subject_hash=$3`,
    [businessDate, type, subjectHash]
  );
}

async function reserveOutletFirstSendGuard(client, queueItem, cooldownDays, cryptoBox, limits) {
  if (Number(queueItem.sequence_step) !== 0) return Object.freeze({ allowed: true, applies: false });
  if (!queueItem.outlet_id) {
    return Object.freeze({ allowed: false, reason: "outlet_first_send_identity_missing" });
  }
  const approvedCooldownDays = Number.isInteger(cooldownDays) && cooldownDays > 0 ? cooldownDays : 14;
  const outletHash = cryptoBox.privacyHash(`outlet:${queueItem.outlet_id}`);
  await acquireTransactionAdvisoryLock(client, `outlet-first-send:${outletHash}`, limits);
  const result = await client.query(
    `INSERT INTO outlet_first_send_guards
      (outlet_hash,match_id,send_queue_id,status,cooldown_until)
     VALUES ($1,$2,$3,'reserved',now()+make_interval(days => $4))
     ON CONFLICT (outlet_hash) DO UPDATE SET
       match_id=EXCLUDED.match_id,
       send_queue_id=EXCLUDED.send_queue_id,
       status='reserved',
       reserved_at=CASE
         WHEN outlet_first_send_guards.status='reserved'
          AND outlet_first_send_guards.send_queue_id=EXCLUDED.send_queue_id
         THEN outlet_first_send_guards.reserved_at ELSE now() END,
       consumed_at=NULL,
       released_at=NULL,
       cooldown_until=EXCLUDED.cooldown_until,
       updated_at=now()
     WHERE (outlet_first_send_guards.status='reserved'
            AND outlet_first_send_guards.send_queue_id=EXCLUDED.send_queue_id
            AND outlet_first_send_guards.match_id=EXCLUDED.match_id)
        OR outlet_first_send_guards.status='released'
        OR outlet_first_send_guards.cooldown_until <= now()
     RETURNING outlet_hash`,
    [outletHash, queueItem.match_id, queueItem.id, approvedCooldownDays]
  );
  return result.rowCount
    ? Object.freeze({ allowed: true, applies: true })
    : Object.freeze({ allowed: false, reason: "outlet_first_send_cooldown_active" });
}

async function releaseCapacityReservation(client, sendQueueId) {
  const reservation = await client.query(
    `SELECT * FROM send_capacity_reservations
     WHERE send_queue_id=$1 AND status='reserved' FOR UPDATE`,
    [sendQueueId]
  );
  const row = reservation.rows[0];
  if (!row || row.status !== "reserved") return false;
  await decrementCounter(client, row.counter_date, "global", row.global_hash);
  await decrementCounter(client, row.counter_date, "release", row.release_hash);
  await decrementCounter(client, row.counter_date, "domain", row.domain_hash);
  await client.query(
    `UPDATE send_capacity_reservations SET status='released',finalized_at=now()
     WHERE send_queue_id=$1 AND counter_date=$2::date AND status='reserved'`,
    [sendQueueId, row.counter_date]
  );
  await client.query(
    `UPDATE outlet_first_send_guards SET status='released',released_at=now(),updated_at=now()
     WHERE send_queue_id=$1 AND status='reserved'`,
    [sendQueueId]
  );
  return true;
}

async function openSafetyCircuit(client, reason) {
  await client.query(
    `INSERT INTO safety_state (name,state,reason,opened_at,paused_until,updated_at)
     VALUES ('global-send-circuit','open',$1,now(),now()+interval '60 minutes',now())
     ON CONFLICT (name) DO UPDATE SET
       state='open',reason=EXCLUDED.reason,opened_at=now(),
       paused_until=now()+interval '60 minutes',updated_at=now()`,
    [boundedText(reason, 250, "safety_event")]
  );
}

function suppressionFenceKey(subjectType, subject) {
  return `outreach-send-authorization:${subjectType}:${String(subject).trim().toLowerCase()}`;
}

function humanReviewAssociatedData(source, sourceEventId, reviewType) {
  return `human-review:${source}:${sourceEventId}:${reviewType}`;
}

function assertBusinessDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw Object.assign(new Error("An explicit Europe/Amsterdam business date is required"), {
      code: "BUSINESS_DATE_REQUIRED",
      retryable: false
    });
  }
  const instant = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(instant.getTime()) || instant.toISOString().slice(0, 10) !== value) {
    throw Object.assign(new Error("The outreach business date is invalid"), {
      code: "BUSINESS_DATE_INVALID",
      retryable: false
    });
  }
}

function assertDailyReportSlot({ reportDate, scheduleSlot, slotRank, dedupeKey }) {
  assertBusinessDate(reportDate);
  const expectedRanks = Object.freeze({
    "preliminary-2330-v1": 1,
    "final-next-day-v1": 2
  });
  if (expectedRanks[scheduleSlot] !== slotRank) {
    throw Object.assign(new Error("The daily report schedule slot is invalid"), {
      code: "DAILY_REPORT_SLOT_INVALID",
      retryable: false
    });
  }
  if (dedupeKey !== `daily-report:${reportDate}:${scheduleSlot}`) {
    throw Object.assign(new Error("The daily report durable identity is invalid"), {
      code: "DAILY_REPORT_DEDUPE_INVALID",
      retryable: false
    });
  }
}

function assertBusinessDayWindow({ businessDate, businessDayStart, businessDayEnd }) {
  assertBusinessDate(businessDate);
  const start = new Date(businessDayStart);
  const end = new Date(businessDayEnd);
  const durationHours = (end.getTime() - start.getTime()) / 3_600_000;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || durationHours < 23 || durationHours > 25) {
    throw Object.assign(new Error("A bounded Europe/Amsterdam business-day window is required"), {
      code: "BUSINESS_DAY_WINDOW_INVALID",
      retryable: false
    });
  }
}

function boundedText(value, maxLength, fallback) {
  const normalized = String(value ?? "").trim();
  return (normalized || fallback).slice(0, maxLength);
}

function normalizeGenreDenials(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values
    .map((value) => String(value ?? "").trim().toLowerCase())
    .filter((value) => value && value.length <= 80))]
    .sort();
}

function toIsoString(value) {
  return new Date(value).toISOString();
}

function reconcileLeaseLost() {
  return Object.assign(new Error("Reconciliation workflow lease was lost"), {
    code: "RECONCILE_LEASE_LOST",
    retryable: true
  });
}
