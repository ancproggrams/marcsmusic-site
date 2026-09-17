import { withTransaction } from "./postgres.mjs";

const WORKFLOW_NAME = "provider-outcome-reconcile";
const WATERMARK_NAME = "provider-outcome-events";

export class OutcomeReconcileRepository {
  constructor({ pool }) {
    this.pool = pool;
  }

  async acquire({ ownerId, watermarkFrom, watermarkTo, leaseSeconds = 120 }) {
    return withTransaction(this.pool, async (client) => {
      await client.query(
        `INSERT INTO outcome_reconcile_state (workflow_name)
         VALUES ($1) ON CONFLICT (workflow_name) DO NOTHING`,
        [WORKFLOW_NAME]
      );
      const selected = await client.query(
        `SELECT *,locked_until > now() AS lease_active
         FROM outcome_reconcile_state WHERE workflow_name=$1 FOR UPDATE`,
        [WORKFLOW_NAME]
      );
      const current = selected.rows[0];
      if (current.owner_id && current.lease_active) {
        return Object.freeze({ acquired: false, reason: "lease_held" });
      }

      const resumable = Boolean(["running", "failed"].includes(current.checkpoint_status)
        && current.watermark_from
        && current.watermark_to);
      const effectiveFrom = resumable ? current.watermark_from : watermarkFrom;
      const effectiveTo = resumable ? current.watermark_to : watermarkTo;
      const routeIndex = resumable ? Number(current.route_index) : 0;
      const cursor = resumable && current.cursor_timestamp
        ? Object.freeze({ timestamp: toIso(current.cursor_timestamp), id: current.cursor_id ?? "" })
        : undefined;
      const pageToken = resumable ? current.provider_page_token ?? undefined : undefined;
      const counters = resumable && isObject(current.counters) ? current.counters : {};

      if (current.run_id) {
        await client.query(
          `UPDATE workflow_runs
           SET status='failed',error_code='OUTCOME_RECONCILE_LEASE_EXPIRED',finished_at=now()
           WHERE id=$1 AND status='running'`,
          [current.run_id]
        );
      }
      const run = await client.query(
        `INSERT INTO workflow_runs
          (workflow_name,correlation_id,status,watermark_from,watermark_to,counters)
         VALUES ($1,$2,'running',$3,$4,$5::jsonb) RETURNING id`,
        [WORKFLOW_NAME, ownerId, effectiveFrom, effectiveTo, JSON.stringify(counters)]
      );
      const acquired = await client.query(
        `UPDATE outcome_reconcile_state
         SET owner_id=$2,
             fence_token=fence_token+1,
             locked_until=now()+make_interval(secs => $3),
             run_id=$4,
             watermark_from=$5,
             watermark_to=$6,
             route_index=$7,
             cursor_timestamp=$8,
             cursor_id=$9,
             provider_page_token=$10,
             counters=$11::jsonb,
             checkpoint_status='running',
             checkpoint_version=checkpoint_version+1,
             resume_count=CASE WHEN $12 THEN resume_count+1 ELSE 0 END,
             last_error_code=NULL,
             acquired_at=now(),updated_at=now(),completed_at=NULL
         WHERE workflow_name=$1
         RETURNING fence_token,checkpoint_version,resume_count`,
        [
          WORKFLOW_NAME,
          ownerId,
          leaseSeconds,
          run.rows[0].id,
          effectiveFrom,
          effectiveTo,
          routeIndex,
          cursor?.timestamp ?? null,
          cursor?.id ?? null,
          pageToken ?? null,
          JSON.stringify(counters),
          resumable
        ]
      );
      const state = acquired.rows[0];
      return Object.freeze({
        acquired: true,
        workflowName: WORKFLOW_NAME,
        ownerId,
        fenceToken: Number(state.fence_token),
        checkpointVersion: Number(state.checkpoint_version),
        runId: run.rows[0].id,
        watermarkFrom: new Date(effectiveFrom),
        watermarkTo: new Date(effectiveTo),
        routeIndex,
        cursor,
        pageToken,
        counters: Object.freeze({ ...counters }),
        resumed: resumable,
        resumeCount: Number(state.resume_count)
      });
    });
  }

  async getWatermark(fallback) {
    const result = await this.pool.query("SELECT value FROM watermarks WHERE name=$1", [WATERMARK_NAME]);
    return result.rows[0]?.value ?? fallback;
  }

  async renew(lease, leaseSeconds = 120) {
    const result = await this.pool.query(
      `UPDATE outcome_reconcile_state
       SET locked_until=now()+make_interval(secs => $5),updated_at=now()
       WHERE workflow_name=$1 AND owner_id=$2 AND fence_token=$3 AND run_id=$4
         AND checkpoint_status='running'`,
      [lease.workflowName, lease.ownerId, lease.fenceToken, lease.runId, leaseSeconds]
    );
    return result.rowCount === 1;
  }

  async checkpoint(lease, {
    routeIndex,
    cursor,
    pageToken,
    counters,
    leaseSeconds = 120
  }) {
    const result = await this.pool.query(
      `UPDATE outcome_reconcile_state
       SET route_index=$5,cursor_timestamp=$6,cursor_id=$7,provider_page_token=$8,
           counters=$9::jsonb,checkpoint_version=checkpoint_version+1,
           locked_until=now()+make_interval(secs => $10),updated_at=now()
       WHERE workflow_name=$1 AND owner_id=$2 AND fence_token=$3 AND run_id=$4
         AND checkpoint_status='running'
       RETURNING checkpoint_version`,
      [
        lease.workflowName,
        lease.ownerId,
        lease.fenceToken,
        lease.runId,
        routeIndex,
        cursor?.timestamp ?? null,
        cursor?.id ?? null,
        pageToken ?? null,
        JSON.stringify(counters),
        leaseSeconds
      ]
    );
    if (!result.rowCount) throw leaseLost();
    return Number(result.rows[0].checkpoint_version);
  }

  async complete(lease, { routeIndex, counters }) {
    return withTransaction(this.pool, async (client) => {
      const completed = await client.query(
        `UPDATE outcome_reconcile_state
         SET owner_id=NULL,locked_until=NULL,route_index=$5,cursor_timestamp=NULL,cursor_id=NULL,
             provider_page_token=NULL,counters=$6::jsonb,checkpoint_status='succeeded',
             checkpoint_version=checkpoint_version+1,last_error_code=NULL,
             updated_at=now(),completed_at=now()
         WHERE workflow_name=$1 AND owner_id=$2 AND fence_token=$3 AND run_id=$4
           AND checkpoint_status='running'
         RETURNING checkpoint_version`,
        [lease.workflowName, lease.ownerId, lease.fenceToken, lease.runId, routeIndex, JSON.stringify(counters)]
      );
      if (!completed.rowCount) throw leaseLost();
      await client.query(
        `INSERT INTO watermarks (name,value) VALUES ($1,$2)
         ON CONFLICT (name) DO UPDATE SET value=EXCLUDED.value,updated_at=now()`,
        [WATERMARK_NAME, lease.watermarkTo]
      );
      await client.query(
        `UPDATE workflow_runs SET status='succeeded',counters=$2::jsonb,error_code=NULL,finished_at=now()
         WHERE id=$1 AND status='running'`,
        [lease.runId, JSON.stringify(counters)]
      );
      return Number(completed.rows[0].checkpoint_version);
    });
  }

  async fail(lease, { counters, errorCode }) {
    return withTransaction(this.pool, async (client) => {
      const failed = await client.query(
        `UPDATE outcome_reconcile_state
         SET owner_id=NULL,locked_until=NULL,counters=$5::jsonb,checkpoint_status='failed',
             checkpoint_version=checkpoint_version+1,last_error_code=$6,updated_at=now()
         WHERE workflow_name=$1 AND owner_id=$2 AND fence_token=$3 AND run_id=$4
           AND checkpoint_status='running'`,
        [lease.workflowName, lease.ownerId, lease.fenceToken, lease.runId, JSON.stringify(counters), boundedCode(errorCode)]
      );
      if (!failed.rowCount) return false;
      await client.query(
        `UPDATE workflow_runs SET status='failed',counters=$2::jsonb,error_code=$3,finished_at=now()
         WHERE id=$1 AND status='running'`,
        [lease.runId, JSON.stringify(counters), boundedCode(errorCode)]
      );
      return true;
    });
  }

  async backlog({ maximum }) {
    const limit = Math.max(1, Number(maximum) + 1);
    const result = await this.pool.query(
      `SELECT
        (SELECT count(*)::int FROM (
          SELECT 1 FROM encrypted_event_inbox
          WHERE status IN ('pending','processing','failed') LIMIT $1
        ) event_rows) AS event_count,
        (SELECT count(*)::int FROM (
          SELECT 1 FROM work_items
          WHERE status IN ('pending','processing','failed') LIMIT $1
        ) work_rows) AS work_count`,
      [limit]
    );
    return Object.freeze({
      events: Number(result.rows[0].event_count),
      work: Number(result.rows[0].work_count)
    });
  }

  async findOutboundIdentity(messageIds) {
    const identities = [...new Set((messageIds ?? []).map(normalizeMessageId).filter(Boolean))].slice(0, 4);
    if (!identities.length) return undefined;
    const result = await this.pool.query(
      `SELECT 'send' AS queue_type,id,match_id,status,provider_message_id,deterministic_message_id
       FROM send_queue
       WHERE provider_message_id=ANY($1::text[]) OR deterministic_message_id=ANY($1::text[])
       UNION ALL
       SELECT 'response' AS queue_type,id,match_id,status,provider_message_id,deterministic_message_id
       FROM response_queue
       WHERE provider_message_id=ANY($1::text[]) OR deterministic_message_id=ANY($1::text[])
       LIMIT 2`,
      [identities]
    );
    if (result.rowCount !== 1) return undefined;
    return Object.freeze(result.rows[0]);
  }

  async recoverDueSequenceStep({ matchId, sequenceStep }) {
    if (!matchId || !Number.isInteger(sequenceStep) || sequenceStep < 1 || sequenceStep > 2) {
      throw invalidInput("OUTCOME_RECONCILE_DUE_MATCH_INVALID");
    }
    const dedupeKey = `schedule-step:${matchId}:${sequenceStep}`;
    return withTransaction(this.pool, async (client) => {
      const send = await client.query(
        `SELECT 1 FROM send_queue WHERE match_id=$1 AND sequence_step=$2 LIMIT 1`,
        [matchId, sequenceStep]
      );
      if (send.rowCount) return Object.freeze({ queued: false, reason: "send_exists" });
      const result = await client.query(
        `INSERT INTO work_items
          (kind,entity_type,entity_id,dedupe_key,payload,priority)
         VALUES ('schedule_sequence_step','OutreachMatch',$1,$2,$3::jsonb,30)
         ON CONFLICT (dedupe_key) DO UPDATE
         SET status='pending',attempts=0,available_at=now(),locked_until=NULL,locked_by=NULL,
             lease_version=work_items.lease_version+1,last_error_code='outcome_reconcile_recovered',
             completed_at=NULL,payload=EXCLUDED.payload
         WHERE work_items.status IN ('completed','failed')
           AND NOT EXISTS (
             SELECT 1 FROM send_queue WHERE match_id=$1 AND sequence_step=$4
           )
         RETURNING id,(xmax <> 0) AS recovered`,
        [matchId, dedupeKey, JSON.stringify({ sequenceStep }), sequenceStep]
      );
      if (!result.rowCount) return Object.freeze({ queued: false, reason: "already_active_or_dead_letter" });
      return Object.freeze({ queued: true, recovered: result.rows[0].recovered === true });
    });
  }

  async confirmDeliveryUnknownAccepted({ messageIds, providerMessageId, providerEventId, occurredAt }) {
    const identities = [...new Set((messageIds ?? []).map(normalizeMessageId).filter(Boolean))].slice(0, 4);
    const normalizedProviderId = normalizeMessageId(providerMessageId);
    if (!identities.length || !normalizedProviderId || !providerEventId) return Object.freeze({ recovered: false, reason: "identity_missing" });
    return withTransaction(this.pool, async (client) => {
      const selected = await client.query(
        `SELECT q.*,a.attempt_number,a.correlation_id
         FROM send_queue q
         JOIN LATERAL (
           SELECT attempt_number,correlation_id
           FROM delivery_attempts
           WHERE send_queue_id=q.id AND status='delivery_unknown'
           ORDER BY attempt_number DESC LIMIT 1
         ) a ON true
         WHERE q.status='delivery_unknown'
           AND (q.provider_message_id=ANY($1::text[]) OR q.deterministic_message_id=ANY($1::text[]))
         FOR UPDATE OF q`,
        [identities]
      );
      if (selected.rowCount !== 1) return Object.freeze({ recovered: false, reason: "not_uniquely_bound" });
      const queue = selected.rows[0];
      const acceptedAt = validDate(occurredAt);
      if (!acceptedAt) return Object.freeze({ recovered: false, reason: "timestamp_invalid" });
      const updated = await client.query(
        `UPDATE send_queue
         SET status='sent',provider_message_id=$2,sent_at=$3,locked_until=NULL,locked_by=NULL,last_error_code=NULL
         WHERE id=$1 AND status='delivery_unknown' RETURNING id`,
        [queue.id, normalizedProviderId, acceptedAt]
      );
      if (!updated.rowCount) return Object.freeze({ recovered: false, reason: "state_changed" });
      await client.query(
        `UPDATE delivery_attempts
         SET status='accepted',provider_message_id=$3,error_code=NULL,finished_at=$4
         WHERE send_queue_id=$1 AND attempt_number=$2 AND status='delivery_unknown'`,
        [queue.id, queue.attempt_number, normalizedProviderId, acceptedAt]
      );
      await client.query(
        `INSERT INTO outcome_events (match_id,send_queue_id,event_type,provider_event_id,occurred_at)
         VALUES ($1,$2,'sent',$3,$4) ON CONFLICT (provider_event_id) DO NOTHING`,
        [queue.match_id, queue.id, `recovered-accepted:${boundedId(providerEventId)}`, acceptedAt]
      );
      await client.query(
        `UPDATE send_capacity_reservations SET status='consumed',finalized_at=$2
         WHERE send_queue_id=$1 AND status='reserved'`,
        [queue.id, acceptedAt]
      );
      await client.query(
        `UPDATE outlet_first_send_guards SET status='consumed',consumed_at=$2,updated_at=now()
         WHERE send_queue_id=$1 AND status='reserved'`,
        [queue.id, acceptedAt]
      );
      if (Number(queue.sequence_step) === 0) {
        await client.query(
          `UPDATE sequence_allocations
           SET initial_sent_at=COALESCE(initial_sent_at,$2),updated_at=now()
           WHERE match_id=$1 AND status='active'`,
          [queue.match_id, acceptedAt]
        );
      }
      await client.query(
        `INSERT INTO crm_delivery_projections
          (send_queue_id,match_id,release_id,contact_id,outlet_id,provider_message_id,
           deterministic_message_id,correlation_id,accepted_at,campaign_projection_key,
           email_projection_key,event_projection_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (send_queue_id) DO NOTHING`,
        [
          queue.id,
          queue.match_id,
          queue.release_id,
          queue.contact_id,
          queue.outlet_id ?? null,
          normalizedProviderId,
          queue.deterministic_message_id,
          queue.correlation_id,
          acceptedAt,
          `music-release:${queue.release_id}`,
          `send:${queue.id}`,
          `sent:${queue.id}`
        ]
      );
      await client.query(
        `INSERT INTO work_items (kind,entity_type,entity_id,dedupe_key,payload,priority)
         VALUES ('sync_delivery_to_crm','OutreachMatch',$1,$2,$3::jsonb,20)
         ON CONFLICT (dedupe_key) DO NOTHING`,
        [
          queue.match_id,
          `crm-delivery:${queue.id}`,
          JSON.stringify({
            sendQueueId: queue.id,
            providerMessageId: normalizedProviderId,
            sequenceStep: queue.sequence_step,
            correlationId: queue.correlation_id,
            acceptedAt: acceptedAt.toISOString()
          })
        ]
      );
      return Object.freeze({ recovered: true, sendQueueId: queue.id });
    });
  }
}

function normalizeMessageId(value) {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const normalized = String(value).trim();
  return normalized && normalized.length <= 500 ? normalized : undefined;
}

function boundedCode(value) {
  return String(value ?? "OUTCOME_RECONCILE_FAILED").slice(0, 120);
}

function boundedId(value) {
  return String(value).slice(0, 500);
}

function validDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

function toIso(value) {
  const date = validDate(value);
  if (!date) throw invalidInput("OUTCOME_RECONCILE_CURSOR_INVALID");
  return date.toISOString();
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function invalidInput(code) {
  return Object.assign(new Error(code), { code, retryable: false });
}

function leaseLost() {
  return Object.assign(new Error("Outcome reconciliation lease was fenced by another owner"), {
    code: "OUTCOME_RECONCILE_LEASE_LOST",
    retryable: true
  });
}

export const OUTCOME_RECONCILE_WORKFLOW = WORKFLOW_NAME;
