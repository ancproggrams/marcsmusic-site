import { ApplicationError } from "../errors.mjs";
import { withTransaction } from "./postgres.mjs";

const PROJECTOR_KEY = "external-alert-router-v1";
const DELIVERY_COLUMNS = Object.freeze([
  "sequence_id", "event_key", "evaluation_key", "incident_key", "evidence_digest",
  "policy_digest", "policy_version", "rule_id", "transition", "state_after", "severity",
  "metric_key", "comparator", "threshold", "observed_value", "snapshot_digest",
  "observed_at", "occurred_at"
]);
const WORKER_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/u;
const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/u;

export class OperationalAlertDeliveryRepository {
  constructor({ pool }) {
    if (!pool?.query || !pool?.connect) throw new TypeError("A PostgreSQL pool is required");
    this.pool = pool;
  }

  async projectBatch({ limit, maximumBacklog }) {
    assertInteger(limit, 1, 500, "limit");
    assertInteger(maximumBacklog, 2, 500_000, "maximumBacklog");
    return withTransaction(this.pool, async (client) => {
      const stateResult = await client.query(
        `SELECT last_sequence_id,outstanding_count,dead_letter_count,delivered_count
           FROM operational_alert_delivery_projection
          WHERE projector_key=$1
          FOR UPDATE SKIP LOCKED`,
        [PROJECTOR_KEY]
      );
      if (!stateResult.rowCount) return projectionResult({ contended: true });
      const state = stateResult.rows[0];
      const outstanding = Number(state.outstanding_count);
      const capacity = Math.max(0, maximumBacklog - outstanding);
      if (capacity === 0) {
        return projectionResult({
          cursor: Number(state.last_sequence_id),
          backlog: outstanding,
          deadLetters: Number(state.dead_letter_count),
          delivered: Number(state.delivered_count),
          backpressured: true,
          hasMore: true
        });
      }

      const effectiveLimit = Math.min(limit, capacity);
      const events = await client.query(
        `SELECT ${DELIVERY_COLUMNS.join(",")}
           FROM operational_alert_events
          WHERE sequence_id>$1
          ORDER BY sequence_id
          LIMIT $2`,
        [state.last_sequence_id, effectiveLimit]
      );
      if (!events.rowCount) {
        return projectionResult({
          cursor: Number(state.last_sequence_id),
          backlog: outstanding,
          deadLetters: Number(state.dead_letter_count),
          delivered: Number(state.delivered_count)
        });
      }

      let projected = 0;
      for (const event of events.rows) {
        const inserted = await client.query(
          `INSERT INTO operational_alert_delivery_outbox
            (delivery_key,sequence_id,event_key,evaluation_key,incident_key,evidence_digest,
             policy_digest,policy_version,rule_id,transition,state_after,severity,metric_key,
             comparator,threshold,observed_value,snapshot_digest,observed_at,occurred_at)
           VALUES ($1,$2,$1,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
           ON CONFLICT (delivery_key) DO NOTHING
           RETURNING delivery_key`,
          [
            event.event_key,
            event.sequence_id,
            event.evaluation_key,
            event.incident_key,
            event.evidence_digest,
            event.policy_digest,
            event.policy_version,
            event.rule_id,
            event.transition,
            event.state_after,
            event.severity,
            event.metric_key,
            event.comparator,
            event.threshold,
            event.observed_value,
            event.snapshot_digest,
            event.observed_at,
            event.occurred_at
          ]
        );
        if (!inserted.rowCount) {
          const existing = await client.query(
            `SELECT sequence_id,event_key,evidence_digest
               FROM operational_alert_delivery_outbox
              WHERE delivery_key=$1`,
            [event.event_key]
          );
          if (!existing.rowCount
            || Number(existing.rows[0].sequence_id) !== Number(event.sequence_id)
            || existing.rows[0].event_key !== event.event_key
            || existing.rows[0].evidence_digest !== event.evidence_digest) {
            throw deliveryError(
              "ALERT_DELIVERY_PROJECTION_COLLISION",
              "Delivery idempotency key is bound to different alert evidence"
            );
          }
          continue;
        }
        await client.query(
          "INSERT INTO operational_alert_delivery_status (delivery_key,sequence_id) VALUES ($1,$2)",
          [event.event_key, event.sequence_id]
        );
        projected += 1;
      }
      const cursor = Number(events.rows.at(-1).sequence_id);
      const updated = await client.query(
        `UPDATE operational_alert_delivery_projection
            SET last_sequence_id=$2,
                outstanding_count=outstanding_count+$3,
                last_projected_at=now(),
                updated_at=now()
          WHERE projector_key=$1
          RETURNING outstanding_count,dead_letter_count,delivered_count`,
        [PROJECTOR_KEY, cursor, projected]
      );
      const more = await client.query(
        "SELECT EXISTS (SELECT 1 FROM operational_alert_events WHERE sequence_id>$1) AS has_more",
        [cursor]
      );
      const current = updated.rows[0];
      return projectionResult({
        scanned: events.rowCount,
        projected,
        cursor,
        backlog: Number(current.outstanding_count),
        deadLetters: Number(current.dead_letter_count),
        delivered: Number(current.delivered_count),
        hasMore: more.rows[0]?.has_more === true,
        backpressured: Number(current.outstanding_count) >= maximumBacklog
      });
    });
  }

  async status() {
    const result = await this.pool.query(
      `SELECT last_sequence_id,outstanding_count,dead_letter_count,delivered_count,
              last_projected_at,last_delivered_at,updated_at
         FROM operational_alert_delivery_projection
        WHERE projector_key=$1`,
      [PROJECTOR_KEY]
    );
    if (!result.rowCount) throw deliveryError("ALERT_DELIVERY_STATE_MISSING", "Alert delivery projection state is missing");
    return freezeRow(result.rows[0]);
  }

  async claimDelivery({ workerId, now = new Date(), leaseSeconds = 60 }) {
    const owner = validWorkerId(workerId);
    const referenceTime = validDate(now, "now");
    assertInteger(leaseSeconds, 10, 900, "leaseSeconds");
    return withTransaction(this.pool, async (client) => {
      const candidate = await client.query(
        `SELECT status.delivery_key
           FROM operational_alert_delivery_status status
          WHERE ((status.status IN ('pending','retry') AND status.available_at<=$1)
             OR (status.status='leased' AND status.lease_expires_at<=$1))
          ORDER BY status.sequence_id
          FOR UPDATE OF status SKIP LOCKED
          LIMIT 1`,
        [referenceTime]
      );
      if (!candidate.rowCount) return undefined;
      const leaseExpiresAt = new Date(referenceTime.getTime() + leaseSeconds * 1_000);
      const claimed = await client.query(
        `UPDATE operational_alert_delivery_status
            SET status='leased',attempt_count=attempt_count+1,lease_owner=$2,
                lease_expires_at=$3,last_error_code=NULL,updated_at=$4
          WHERE delivery_key=$1
          RETURNING status,attempt_count,lease_owner,lease_expires_at`,
        [candidate.rows[0].delivery_key, owner, leaseExpiresAt, referenceTime]
      );
      const payload = await client.query(
        `SELECT ${DELIVERY_COLUMNS.join(",")},delivery_key,delivery_contract_version,projected_at
           FROM operational_alert_delivery_outbox
          WHERE delivery_key=$1`,
        [candidate.rows[0].delivery_key]
      );
      return Object.freeze({ ...freezeRow(payload.rows[0]), ...freezeRow(claimed.rows[0]) });
    });
  }

  async recordDeliveryFailure({ deliveryKey, workerId, errorCode, now = new Date(), retryAt, maximumAttempts }) {
    const key = validDigest(deliveryKey, "deliveryKey");
    const owner = validWorkerId(workerId);
    const code = validErrorCode(errorCode);
    const referenceTime = validDate(now, "now");
    const nextAttempt = validDate(retryAt, "retryAt");
    assertInteger(maximumAttempts, 1, 1_000, "maximumAttempts");
    if (nextAttempt < referenceTime || nextAttempt.getTime() - referenceTime.getTime() > 86_400_000) {
      throw deliveryError("ALERT_DELIVERY_RETRY_INVALID", "retryAt must be within the next 24 hours");
    }
    return withTransaction(this.pool, async (client) => {
      const projection = await lockProjection(client);
      const current = await lockDelivery(client, key);
      assertLeaseOwner(current, owner);
      const deadLetter = Number(current.attempt_count) >= maximumAttempts;
      const updated = await client.query(
        `UPDATE operational_alert_delivery_status
            SET status=$2,available_at=$3,lease_owner=NULL,lease_expires_at=NULL,
                last_error_code=$4,updated_at=$5
          WHERE delivery_key=$1
          RETURNING status,attempt_count,available_at,last_error_code`,
        [key, deadLetter ? "dead_letter" : "retry", nextAttempt, code, referenceTime]
      );
      if (deadLetter) {
        await client.query(
          `UPDATE operational_alert_delivery_projection
              SET dead_letter_count=dead_letter_count+1,updated_at=$2
            WHERE projector_key=$1`,
          [PROJECTOR_KEY, referenceTime]
        );
      }
      return Object.freeze({ ...freezeRow(updated.rows[0]), deadLetter, backlog: Number(projection.outstanding_count) });
    });
  }

  async acknowledgeDelivery({ deliveryKey, workerId, now = new Date() }) {
    const key = validDigest(deliveryKey, "deliveryKey");
    const owner = validWorkerId(workerId);
    const deliveredAt = validDate(now, "now");
    return withTransaction(this.pool, async (client) => {
      await lockProjection(client);
      const current = await lockDelivery(client, key, { optional: true });
      if (!current) return Object.freeze({ acknowledged: false, reason: "not_found" });
      assertLeaseOwner(current, owner);
      await client.query("DELETE FROM operational_alert_delivery_outbox WHERE delivery_key=$1", [key]);
      const state = await client.query(
        `UPDATE operational_alert_delivery_projection
            SET outstanding_count=outstanding_count-1,delivered_count=delivered_count+1,
                last_delivered_at=$2,updated_at=$2
          WHERE projector_key=$1
          RETURNING outstanding_count,dead_letter_count,delivered_count`,
        [PROJECTOR_KEY, deliveredAt]
      );
      return Object.freeze({ acknowledged: true, ...freezeRow(state.rows[0]) });
    });
  }

  async requeueDeadLetter({ deliveryKey, availableAt = new Date() }) {
    const key = validDigest(deliveryKey, "deliveryKey");
    const nextAttempt = validDate(availableAt, "availableAt");
    return withTransaction(this.pool, async (client) => {
      await lockProjection(client);
      const current = await lockDelivery(client, key);
      if (current.status !== "dead_letter") {
        throw deliveryError("ALERT_DELIVERY_NOT_DEAD_LETTER", "Only dead-letter delivery can be requeued");
      }
      await client.query(
        `UPDATE operational_alert_delivery_status
            SET status='retry',available_at=$2,last_error_code=NULL,updated_at=now()
          WHERE delivery_key=$1`,
        [key, nextAttempt]
      );
      const state = await client.query(
        `UPDATE operational_alert_delivery_projection
            SET dead_letter_count=dead_letter_count-1,updated_at=now()
          WHERE projector_key=$1
          RETURNING outstanding_count,dead_letter_count`,
        [PROJECTOR_KEY]
      );
      return Object.freeze({ requeued: true, ...freezeRow(state.rows[0]) });
    });
  }
}

async function lockProjection(client) {
  const result = await client.query(
    `SELECT outstanding_count,dead_letter_count,delivered_count
       FROM operational_alert_delivery_projection
      WHERE projector_key=$1
      FOR UPDATE`,
    [PROJECTOR_KEY]
  );
  if (!result.rowCount) throw deliveryError("ALERT_DELIVERY_STATE_MISSING", "Alert delivery projection state is missing");
  return result.rows[0];
}

async function lockDelivery(client, deliveryKey, { optional = false } = {}) {
  const result = await client.query(
    `SELECT status,attempt_count,lease_owner,lease_expires_at
       FROM operational_alert_delivery_status
      WHERE delivery_key=$1
      FOR UPDATE`,
    [deliveryKey]
  );
  if (!result.rowCount && !optional) throw deliveryError("ALERT_DELIVERY_NOT_FOUND", "Alert delivery does not exist");
  return result.rows[0];
}

function assertLeaseOwner(delivery, workerId) {
  if (delivery.status !== "leased" || delivery.lease_owner !== workerId) {
    throw deliveryError("ALERT_DELIVERY_LEASE_LOST", "Alert delivery lease is not owned by this worker", true);
  }
}

function projectionResult(overrides = {}) {
  return Object.freeze({
    scanned: 0,
    projected: 0,
    cursor: 0,
    backlog: 0,
    deadLetters: 0,
    delivered: 0,
    hasMore: false,
    backpressured: false,
    contended: false,
    ...overrides
  });
}

function freezeRow(row) {
  return Object.freeze({ ...row });
}

function validWorkerId(value) {
  if (typeof value !== "string" || !WORKER_PATTERN.test(value)) {
    throw deliveryError("ALERT_DELIVERY_ARGUMENT_INVALID", "workerId is invalid");
  }
  return value;
}

function validErrorCode(value) {
  if (typeof value !== "string" || !ERROR_CODE_PATTERN.test(value)) {
    throw deliveryError("ALERT_DELIVERY_ARGUMENT_INVALID", "errorCode is invalid");
  }
  return value;
}

function validDigest(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/u.test(value)) {
    throw deliveryError("ALERT_DELIVERY_ARGUMENT_INVALID", `${label} is invalid`);
  }
  return value;
}

function validDate(value, label) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) throw deliveryError("ALERT_DELIVERY_ARGUMENT_INVALID", `${label} is invalid`);
  return date;
}

function assertInteger(value, minimum, maximum, label) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw deliveryError("ALERT_DELIVERY_ARGUMENT_INVALID", `${label} must be between ${minimum} and ${maximum}`);
  }
}

function deliveryError(code, message, retryable = false) {
  return new ApplicationError(message, { code, statusCode: 503, retryable });
}
