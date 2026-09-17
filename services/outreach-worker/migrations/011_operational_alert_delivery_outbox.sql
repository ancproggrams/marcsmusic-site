-- Durable, PII-free hand-off boundary for an independently approved alert
-- router. This migration does not configure or claim external delivery.
CREATE INDEX IF NOT EXISTS operational_metric_rollups_policy_retention_idx
  ON operational_metric_rollups (policy_digest, bucket_at, metric_key);

CREATE TABLE IF NOT EXISTS operational_alert_delivery_projection (
  projector_key varchar(64) PRIMARY KEY
    CHECK (projector_key = 'external-alert-router-v1'),
  last_sequence_id bigint NOT NULL DEFAULT 0 CHECK (last_sequence_id >= 0),
  outstanding_count bigint NOT NULL DEFAULT 0 CHECK (outstanding_count >= 0),
  dead_letter_count bigint NOT NULL DEFAULT 0 CHECK (dead_letter_count >= 0),
  delivered_count bigint NOT NULL DEFAULT 0 CHECK (delivered_count >= 0),
  last_projected_at timestamptz,
  last_delivered_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (dead_letter_count <= outstanding_count)
);

INSERT INTO operational_alert_delivery_projection (projector_key)
VALUES ('external-alert-router-v1')
ON CONFLICT (projector_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS operational_alert_delivery_outbox (
  delivery_key char(64) PRIMARY KEY CHECK (delivery_key ~ '^[0-9a-f]{64}$'),
  delivery_contract_version smallint NOT NULL DEFAULT 1 CHECK (delivery_contract_version = 1),
  sequence_id bigint NOT NULL UNIQUE CHECK (sequence_id > 0),
  event_key char(64) NOT NULL UNIQUE CHECK (event_key ~ '^[0-9a-f]{64}$'),
  evaluation_key char(64) NOT NULL CHECK (evaluation_key ~ '^[0-9a-f]{64}$'),
  incident_key char(64) NOT NULL CHECK (incident_key ~ '^[0-9a-f]{64}$'),
  evidence_digest char(64) NOT NULL CHECK (evidence_digest ~ '^[0-9a-f]{64}$'),
  policy_digest char(64) NOT NULL CHECK (policy_digest ~ '^[0-9a-f]{64}$'),
  policy_version varchar(128) NOT NULL CHECK (policy_version ~ '^[a-zA-Z0-9][a-zA-Z0-9._:/-]{2,127}$'),
  rule_id varchar(64) NOT NULL CHECK (rule_id ~ '^[a-z][a-z0-9_-]{2,63}$'),
  transition varchar(16) NOT NULL CHECK (transition IN ('opened', 'reminder', 'resolved')),
  state_after varchar(16) NOT NULL CHECK (state_after IN ('open', 'resolved')),
  severity varchar(8) NOT NULL CHECK (severity IN ('sev1', 'sev2', 'sev3')),
  metric_key varchar(64) NOT NULL CHECK (metric_key IN (
    'outreach_health_sent_24h',
    'outreach_health_harmful_rate',
    'outreach_health_failure_rate',
    'outreach_work_queue_depth',
    'outreach_send_queue_depth',
    'outreach_response_queue_depth',
    'outreach_event_inbox_depth',
    'outreach_oldest_work_seconds',
    'outreach_oldest_event_seconds',
    'outreach_work_dead_letters',
    'outreach_send_dead_letters',
    'outreach_response_dead_letters',
    'outreach_delivery_unknown',
    'outreach_full_reconcile_age_seconds',
    'outreach_incremental_reconcile_age_seconds',
    'outreach_send_circuit_open',
    'outreach_technical_state_ready',
    'outreach_crm_projection_backlog'
  )),
  comparator varchar(32) NOT NULL CHECK (comparator IN (
    'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal', 'equal'
  )),
  threshold double precision NOT NULL CHECK (threshold BETWEEN -1 AND 9007199254740991),
  observed_value double precision NOT NULL CHECK (observed_value BETWEEN -1 AND 9007199254740991),
  snapshot_digest char(64) NOT NULL CHECK (snapshot_digest ~ '^[0-9a-f]{64}$'),
  observed_at timestamptz NOT NULL,
  occurred_at timestamptz NOT NULL,
  projected_at timestamptz NOT NULL DEFAULT now(),
  CHECK (delivery_key = event_key),
  CHECK (occurred_at = observed_at),
  CHECK ((transition IN ('opened','reminder') AND state_after='open')
      OR (transition='resolved' AND state_after='resolved'))
);

CREATE TABLE IF NOT EXISTS operational_alert_delivery_status (
  delivery_key char(64) PRIMARY KEY
    REFERENCES operational_alert_delivery_outbox(delivery_key) ON DELETE CASCADE,
  sequence_id bigint NOT NULL UNIQUE CHECK (sequence_id > 0),
  status varchar(16) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'leased', 'retry', 'dead_letter')),
  attempt_count smallint NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 1000),
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_owner varchar(128) CHECK (
    lease_owner IS NULL OR lease_owner ~ '^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$'
  ),
  lease_expires_at timestamptz,
  last_error_code varchar(64) CHECK (
    last_error_code IS NULL OR last_error_code ~ '^[A-Z][A-Z0-9_]{2,63}$'
  ),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status='leased' AND lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL)
      OR (status<>'leased' AND lease_owner IS NULL AND lease_expires_at IS NULL)),
  CHECK (status<>'dead_letter' OR last_error_code IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS operational_alert_delivery_claim_idx
  ON operational_alert_delivery_status (status, available_at, sequence_id);
CREATE INDEX IF NOT EXISTS operational_alert_delivery_expired_lease_idx
  ON operational_alert_delivery_status (lease_expires_at, sequence_id)
  WHERE status='leased';
CREATE INDEX IF NOT EXISTS operational_alert_delivery_sequence_idx
  ON operational_alert_delivery_outbox (sequence_id, delivery_key);

CREATE OR REPLACE FUNCTION reject_operational_alert_delivery_payload_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'operational alert delivery payload is immutable'
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS operational_alert_delivery_payload_update_blocker
  ON operational_alert_delivery_outbox;
CREATE TRIGGER operational_alert_delivery_payload_update_blocker
BEFORE UPDATE ON operational_alert_delivery_outbox
FOR EACH ROW EXECUTE FUNCTION reject_operational_alert_delivery_payload_update();
