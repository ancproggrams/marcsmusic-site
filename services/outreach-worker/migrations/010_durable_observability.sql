-- PII-free, finite-cardinality operational evidence. This is deliberately a
-- PostgreSQL durability core, not a Prometheus/OTel backend or paging router.
CREATE TABLE IF NOT EXISTS operational_metric_snapshots (
  snapshot_digest char(64) PRIMARY KEY CHECK (snapshot_digest ~ '^[0-9a-f]{64}$'),
  policy_digest char(64) NOT NULL CHECK (policy_digest ~ '^[0-9a-f]{64}$'),
  policy_version varchar(128) NOT NULL CHECK (policy_version ~ '^[a-zA-Z0-9][a-zA-Z0-9._:/-]{2,127}$'),
  observed_at timestamptz NOT NULL,
  rollup_bucket_at timestamptz NOT NULL,
  metric_count smallint NOT NULL CHECK (metric_count BETWEEN 1 AND 18),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (policy_digest, observed_at),
  CHECK (rollup_bucket_at <= observed_at)
);

CREATE INDEX IF NOT EXISTS operational_metric_snapshots_retention_idx
  ON operational_metric_snapshots (policy_digest, observed_at, snapshot_digest);

CREATE TABLE IF NOT EXISTS operational_metric_samples (
  snapshot_digest char(64) NOT NULL REFERENCES operational_metric_snapshots(snapshot_digest) ON DELETE CASCADE,
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
  metric_value double precision NOT NULL CHECK (metric_value BETWEEN -1 AND 9007199254740991),
  PRIMARY KEY (snapshot_digest, metric_key)
);

CREATE INDEX IF NOT EXISTS operational_metric_samples_metric_idx
  ON operational_metric_samples (metric_key, snapshot_digest);

CREATE TABLE IF NOT EXISTS operational_metric_rollups (
  policy_digest char(64) NOT NULL CHECK (policy_digest ~ '^[0-9a-f]{64}$'),
  policy_version varchar(128) NOT NULL CHECK (policy_version ~ '^[a-zA-Z0-9][a-zA-Z0-9._:/-]{2,127}$'),
  bucket_at timestamptz NOT NULL,
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
  sample_count integer NOT NULL CHECK (sample_count > 0),
  value_sum double precision NOT NULL,
  value_min double precision NOT NULL,
  value_max double precision NOT NULL,
  value_last double precision NOT NULL,
  first_observed_at timestamptz NOT NULL,
  last_observed_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (policy_digest, bucket_at, metric_key),
  CHECK (first_observed_at <= last_observed_at),
  CHECK (value_min <= value_max)
);

CREATE INDEX IF NOT EXISTS operational_metric_rollups_retention_idx
  ON operational_metric_rollups (policy_digest, metric_key, bucket_at);
CREATE INDEX IF NOT EXISTS operational_metric_rollups_policy_retention_idx
  ON operational_metric_rollups (policy_digest, bucket_at, metric_key);

CREATE TABLE IF NOT EXISTS operational_alert_evaluations (
  evaluation_key char(64) PRIMARY KEY CHECK (evaluation_key ~ '^[0-9a-f]{64}$'),
  policy_digest char(64) NOT NULL CHECK (policy_digest ~ '^[0-9a-f]{64}$'),
  policy_version varchar(128) NOT NULL CHECK (policy_version ~ '^[a-zA-Z0-9][a-zA-Z0-9._:/-]{2,127}$'),
  rule_id varchar(64) NOT NULL CHECK (rule_id ~ '^[a-z][a-z0-9_-]{2,63}$'),
  snapshot_digest char(64) NOT NULL CHECK (snapshot_digest ~ '^[0-9a-f]{64}$'),
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
  breached boolean NOT NULL,
  decision varchar(16) NOT NULL CHECK (decision IN (
    'opened', 'reminder', 'resolved', 'deduplicated', 'healthy', 'stale'
  )),
  incident_key char(64) CHECK (incident_key IS NULL OR incident_key ~ '^[0-9a-f]{64}$'),
  event_key char(64) UNIQUE CHECK (event_key IS NULL OR event_key ~ '^[0-9a-f]{64}$'),
  next_notification_at timestamptz,
  observed_at timestamptz NOT NULL,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (policy_digest, rule_id, snapshot_digest),
  CHECK ((decision IN ('opened','reminder','resolved') AND event_key IS NOT NULL)
      OR (decision IN ('deduplicated','healthy','stale') AND event_key IS NULL)),
  CHECK ((decision IN ('opened','reminder','deduplicated') AND breached)
      OR (decision IN ('resolved','healthy') AND NOT breached)
      OR decision = 'stale')
);

CREATE INDEX IF NOT EXISTS operational_alert_evaluations_rule_idx
  ON operational_alert_evaluations (policy_digest, rule_id, observed_at DESC, evaluation_key DESC);

CREATE TABLE IF NOT EXISTS operational_alert_events (
  sequence_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_key char(64) NOT NULL UNIQUE CHECK (event_key ~ '^[0-9a-f]{64}$'),
  evaluation_key char(64) NOT NULL UNIQUE CHECK (evaluation_key ~ '^[0-9a-f]{64}$'),
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
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((transition IN ('opened','reminder') AND state_after='open')
      OR (transition='resolved' AND state_after='resolved')),
  CHECK (occurred_at = observed_at)
);

CREATE INDEX IF NOT EXISTS operational_alert_events_state_idx
  ON operational_alert_events (policy_digest, rule_id, occurred_at DESC, sequence_id DESC);

CREATE INDEX IF NOT EXISTS operational_alert_events_incident_idx
  ON operational_alert_events (incident_key, sequence_id);

-- Small exact quota projections make the capture/evaluation hot path O(1)
-- instead of counting or ranking retained evidence on every write.
CREATE TABLE IF NOT EXISTS operational_observability_policy_usage (
  policy_digest char(64) PRIMARY KEY CHECK (policy_digest ~ '^[0-9a-f]{64}$'),
  snapshot_count bigint NOT NULL DEFAULT 0 CHECK (snapshot_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS operational_observability_metric_usage (
  policy_digest char(64) NOT NULL CHECK (policy_digest ~ '^[0-9a-f]{64}$'),
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
  rollup_bucket_count bigint NOT NULL DEFAULT 0 CHECK (rollup_bucket_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (policy_digest,metric_key)
);

CREATE TABLE IF NOT EXISTS operational_observability_alert_usage (
  policy_digest char(64) NOT NULL CHECK (policy_digest ~ '^[0-9a-f]{64}$'),
  rule_id varchar(64) NOT NULL CHECK (rule_id ~ '^[a-z][a-z0-9_-]{2,63}$'),
  evaluation_count bigint NOT NULL DEFAULT 0 CHECK (evaluation_count >= 0),
  event_count bigint NOT NULL DEFAULT 0 CHECK (event_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (policy_digest,rule_id)
);

CREATE OR REPLACE FUNCTION track_operational_snapshot_usage()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO operational_observability_policy_usage (policy_digest,snapshot_count)
    VALUES (NEW.policy_digest,1)
    ON CONFLICT (policy_digest) DO UPDATE SET
      snapshot_count=operational_observability_policy_usage.snapshot_count+1,
      updated_at=now();
    RETURN NEW;
  END IF;
  UPDATE operational_observability_policy_usage
     SET snapshot_count=greatest(snapshot_count-1,0),updated_at=now()
   WHERE policy_digest=OLD.policy_digest;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION track_operational_rollup_usage()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO operational_observability_metric_usage (policy_digest,metric_key,rollup_bucket_count)
    VALUES (NEW.policy_digest,NEW.metric_key,1)
    ON CONFLICT (policy_digest,metric_key) DO UPDATE SET
      rollup_bucket_count=operational_observability_metric_usage.rollup_bucket_count+1,
      updated_at=now();
    RETURN NEW;
  END IF;
  UPDATE operational_observability_metric_usage
     SET rollup_bucket_count=greatest(rollup_bucket_count-1,0),updated_at=now()
   WHERE policy_digest=OLD.policy_digest AND metric_key=OLD.metric_key;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION track_operational_alert_usage()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  counter_column text;
BEGIN
  counter_column := CASE TG_TABLE_NAME
    WHEN 'operational_alert_evaluations' THEN 'evaluation_count'
    ELSE 'event_count'
  END;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO operational_observability_alert_usage
      (policy_digest,rule_id,evaluation_count,event_count)
    VALUES (
      NEW.policy_digest,
      NEW.rule_id,
      CASE WHEN counter_column='evaluation_count' THEN 1 ELSE 0 END,
      CASE WHEN counter_column='event_count' THEN 1 ELSE 0 END
    )
    ON CONFLICT (policy_digest,rule_id) DO UPDATE SET
      evaluation_count=operational_observability_alert_usage.evaluation_count
        + CASE WHEN counter_column='evaluation_count' THEN 1 ELSE 0 END,
      event_count=operational_observability_alert_usage.event_count
        + CASE WHEN counter_column='event_count' THEN 1 ELSE 0 END,
      updated_at=now();
    RETURN NEW;
  END IF;
  UPDATE operational_observability_alert_usage
     SET evaluation_count=greatest(evaluation_count
           - CASE WHEN counter_column='evaluation_count' THEN 1 ELSE 0 END,0),
         event_count=greatest(event_count
           - CASE WHEN counter_column='event_count' THEN 1 ELSE 0 END,0),
         updated_at=now()
   WHERE policy_digest=OLD.policy_digest AND rule_id=OLD.rule_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS operational_metric_snapshots_usage ON operational_metric_snapshots;
CREATE TRIGGER operational_metric_snapshots_usage
AFTER INSERT OR DELETE ON operational_metric_snapshots
FOR EACH ROW EXECUTE FUNCTION track_operational_snapshot_usage();

DROP TRIGGER IF EXISTS operational_metric_rollups_usage ON operational_metric_rollups;
CREATE TRIGGER operational_metric_rollups_usage
AFTER INSERT OR DELETE ON operational_metric_rollups
FOR EACH ROW EXECUTE FUNCTION track_operational_rollup_usage();

DROP TRIGGER IF EXISTS operational_alert_evaluations_usage ON operational_alert_evaluations;
CREATE TRIGGER operational_alert_evaluations_usage
AFTER INSERT OR DELETE ON operational_alert_evaluations
FOR EACH ROW EXECUTE FUNCTION track_operational_alert_usage();

DROP TRIGGER IF EXISTS operational_alert_events_usage ON operational_alert_events;
CREATE TRIGGER operational_alert_events_usage
AFTER INSERT OR DELETE ON operational_alert_events
FOR EACH ROW EXECUTE FUNCTION track_operational_alert_usage();

-- Snapshots, samples and alert evidence are immutable after append. Retention
-- may delete whole records; rollups are the sole intentionally mutable table.
CREATE OR REPLACE FUNCTION reject_operational_observability_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'operational observability evidence is append-only'
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS operational_metric_snapshots_no_update ON operational_metric_snapshots;
CREATE TRIGGER operational_metric_snapshots_no_update
BEFORE UPDATE ON operational_metric_snapshots
FOR EACH ROW EXECUTE FUNCTION reject_operational_observability_update();

DROP TRIGGER IF EXISTS operational_metric_samples_no_update ON operational_metric_samples;
CREATE TRIGGER operational_metric_samples_no_update
BEFORE UPDATE ON operational_metric_samples
FOR EACH ROW EXECUTE FUNCTION reject_operational_observability_update();

DROP TRIGGER IF EXISTS operational_alert_evaluations_no_update ON operational_alert_evaluations;
CREATE TRIGGER operational_alert_evaluations_no_update
BEFORE UPDATE ON operational_alert_evaluations
FOR EACH ROW EXECUTE FUNCTION reject_operational_observability_update();

DROP TRIGGER IF EXISTS operational_alert_events_no_update ON operational_alert_events;
CREATE TRIGGER operational_alert_events_no_update
BEFORE UPDATE ON operational_alert_events
FOR EACH ROW EXECUTE FUNCTION reject_operational_observability_update();

COMMENT ON TABLE operational_metric_snapshots IS
  'One digest-bound, finite-registry operational metric snapshot per configured collection bucket; contains no labels or business identifiers.';
COMMENT ON TABLE operational_metric_rollups IS
  'Bounded PostgreSQL operational rollups for incident investigation; not a Prometheus or OpenTelemetry substitute.';
COMMENT ON TABLE operational_alert_evaluations IS
  'Append-only deterministic rule decisions, including replay, cooldown deduplication and stale-snapshot evidence.';
COMMENT ON TABLE operational_alert_events IS
  'Append-only alert state transitions and PII-free evidence; external routing/delivery is deliberately not represented as complete.';
