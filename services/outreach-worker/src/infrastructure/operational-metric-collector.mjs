import { OPERATIONAL_METRIC_KEYS } from "../domain/operational-observability-policy.mjs";
import { ApplicationError } from "../errors.mjs";

export class OperationalMetricCollector {
  constructor({ pool }) {
    if (!pool?.query) throw new TypeError("A PostgreSQL pool is required");
    this.pool = pool;
  }

  async collect({ observedAt = new Date() } = {}) {
    const snapshotTime = validDate(observedAt, "observedAt");
    const result = await this.pool.query({
      text: `WITH outcomes AS (
               SELECT
                 count(*) FILTER (WHERE event_type='sent')::bigint AS sent,
                 count(*) FILTER (WHERE event_type IN ('hard_bounce','complained','unsubscribed'))::bigint AS harmful,
                 count(*) FILTER (WHERE event_type IN ('definite_failure','delivery_unknown'))::bigint AS failed
               FROM outcome_events
               WHERE occurred_at >= $1::timestamptz-interval '24 hours'
             ), required_relations(relation_name) AS (
               VALUES
                 ('encrypted_event_inbox'),('work_items'),('send_queue'),('response_queue'),
                 ('workflow_runs'),('safety_state'),('crm_delivery_projections'),
                 ('operational_metric_snapshots'),('operational_alert_events')
             )
             SELECT
               outcomes.sent,
               CASE WHEN outcomes.sent>0
                    THEN least(1::double precision,outcomes.harmful::double precision/outcomes.sent) ELSE 0 END AS harmful_rate,
               CASE WHEN outcomes.sent+outcomes.failed>0
                    THEN outcomes.failed::double precision/(outcomes.sent+outcomes.failed) ELSE 0 END AS failure_rate,
               (SELECT count(*)::bigint FROM work_items WHERE status IN ('pending','failed','processing')) AS work_depth,
               (SELECT count(*)::bigint FROM send_queue WHERE status IN ('ready','failed','sending')) AS send_depth,
               (SELECT count(*)::bigint FROM response_queue WHERE status IN ('ready','failed','sending')) AS response_depth,
               (SELECT count(*)::bigint FROM encrypted_event_inbox WHERE status IN ('pending','failed','processing')) AS event_depth,
               COALESCE((SELECT greatest(0,extract(epoch FROM $1::timestamptz-min(created_at)))
                           FROM work_items WHERE status IN ('pending','failed','processing')),0) AS oldest_work_seconds,
               COALESCE((SELECT greatest(0,extract(epoch FROM $1::timestamptz-min(created_at)))
                           FROM encrypted_event_inbox WHERE status IN ('pending','failed','processing')),0) AS oldest_event_seconds,
               (SELECT count(*)::bigint FROM work_items WHERE status='dead_letter') AS work_dead_letters,
               (SELECT count(*)::bigint FROM send_queue WHERE status='dead_letter') AS send_dead_letters,
               (SELECT count(*)::bigint FROM response_queue WHERE status='dead_letter') AS response_dead_letters,
               (SELECT count(*)::bigint FROM send_queue WHERE status='delivery_unknown') AS delivery_unknown,
               COALESCE((SELECT greatest(0,extract(epoch FROM $1::timestamptz-max(finished_at)))
                           FROM workflow_runs WHERE workflow_name='outreach-full-reconcile' AND status='succeeded'
                          HAVING max(finished_at) IS NOT NULL),-1)
                 AS full_reconcile_age_seconds,
               COALESCE((SELECT greatest(0,extract(epoch FROM $1::timestamptz-max(finished_at)))
                           FROM workflow_runs WHERE workflow_name='outreach-incremental-reconcile' AND status='succeeded'
                          HAVING max(finished_at) IS NOT NULL),-1)
                 AS incremental_reconcile_age_seconds,
               CASE WHEN COALESCE((SELECT state FROM safety_state WHERE name='global-send-circuit'),'unavailable')='closed'
                    THEN 0 ELSE 1 END AS send_circuit_open,
               CASE WHEN NOT EXISTS (
                      SELECT 1 FROM required_relations
                       WHERE to_regclass('public.'||relation_name) IS NULL
                    ) AND EXISTS (SELECT 1 FROM safety_state WHERE name='global-send-circuit')
                    THEN 1 ELSE 0 END AS technical_state_ready,
               (SELECT count(*)::bigint FROM crm_delivery_projections
                 WHERE status IN ('pending','processing','failed')) AS crm_projection_backlog
             FROM outcomes`,
      values: [snapshotTime],
      query_timeout: 10_000
    });
    const row = result.rows[0];
    if (!row) throw collectorError("OBSERVABILITY_COLLECTION_EMPTY", "Operational metric collection returned no row");
    const metrics = Object.freeze({
      outreach_health_sent_24h: integer(row.sent),
      outreach_health_harmful_rate: number(row.harmful_rate),
      outreach_health_failure_rate: number(row.failure_rate),
      outreach_work_queue_depth: integer(row.work_depth),
      outreach_send_queue_depth: integer(row.send_depth),
      outreach_response_queue_depth: integer(row.response_depth),
      outreach_event_inbox_depth: integer(row.event_depth),
      outreach_oldest_work_seconds: number(row.oldest_work_seconds),
      outreach_oldest_event_seconds: number(row.oldest_event_seconds),
      outreach_work_dead_letters: integer(row.work_dead_letters),
      outreach_send_dead_letters: integer(row.send_dead_letters),
      outreach_response_dead_letters: integer(row.response_dead_letters),
      outreach_delivery_unknown: integer(row.delivery_unknown),
      outreach_full_reconcile_age_seconds: number(row.full_reconcile_age_seconds),
      outreach_incremental_reconcile_age_seconds: number(row.incremental_reconcile_age_seconds),
      outreach_send_circuit_open: integer(row.send_circuit_open),
      outreach_technical_state_ready: integer(row.technical_state_ready),
      outreach_crm_projection_backlog: integer(row.crm_projection_backlog)
    });
    if (Object.keys(metrics).sort().join("\n") !== OPERATIONAL_METRIC_KEYS.join("\n")) {
      throw collectorError("OBSERVABILITY_COLLECTION_CONTRACT_MISMATCH", "Collector does not cover the finite metric registry exactly");
    }
    return metrics;
  }
}

function integer(value) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw collectorError("OBSERVABILITY_COLLECTION_VALUE_INVALID", "Collected count is not a safe integer");
  return parsed;
}

function number(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw collectorError("OBSERVABILITY_COLLECTION_VALUE_INVALID", "Collected value is not finite");
  return parsed;
}

function validDate(value, label) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) throw collectorError("OBSERVABILITY_TIMESTAMP_INVALID", `${label} must be a valid timestamp`);
  return date;
}

function collectorError(code, message) {
  return new ApplicationError(message, { code, statusCode: 503, retryable: false });
}
