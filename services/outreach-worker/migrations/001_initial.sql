CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS encrypted_event_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  external_id text NOT NULL,
  event_type text NOT NULL,
  entity_type text,
  entity_id text,
  payload_ciphertext bytea NOT NULL,
  payload_iv bytea NOT NULL,
  payload_tag bytea NOT NULL,
  key_version text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'dead_letter')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  locked_by text,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (source, external_id)
);

CREATE INDEX IF NOT EXISTS encrypted_event_inbox_claim_idx
  ON encrypted_event_inbox (status, available_at, created_at)
  WHERE status IN ('pending', 'failed');

CREATE TABLE IF NOT EXISTS work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  dedupe_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter')),
  priority smallint NOT NULL DEFAULT 100,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  locked_by text,
  lease_version bigint NOT NULL DEFAULT 0 CHECK (lease_version >= 0),
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS work_items_claim_idx
  ON work_items (status, available_at, priority, created_at)
  WHERE status IN ('pending', 'failed');

CREATE TABLE IF NOT EXISTS copy_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id text NOT NULL,
  sequence_step smallint NOT NULL CHECK (sequence_step BETWEEN 0 AND 2),
  template_version text NOT NULL,
  prompt_version text,
  content_sha256 text NOT NULL,
  content_ciphertext bytea NOT NULL,
  content_iv bytea NOT NULL,
  content_tag bytea NOT NULL,
  key_version text NOT NULL,
  validation_status text NOT NULL CHECK (validation_status IN ('valid', 'fallback')),
  confidence numeric(5,4),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, sequence_step, content_sha256)
);

CREATE TABLE IF NOT EXISTS sequence_allocations (
  recipient_hash text PRIMARY KEY,
  match_id text NOT NULL UNIQUE,
  release_id text NOT NULL,
  contact_id text NOT NULL,
  outlet_id text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'released')),
  acquired_at timestamptz NOT NULL DEFAULT now(),
  initial_sent_at timestamptz,
  released_at timestamptz,
  cooldown_until timestamptz,
  release_reason text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sequence_allocations_match_idx
  ON sequence_allocations (match_id, status);
CREATE INDEX IF NOT EXISTS sequence_allocations_cooldown_idx
  ON sequence_allocations (status, cooldown_until)
  WHERE status = 'released';

CREATE TABLE IF NOT EXISTS send_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id text NOT NULL,
  release_id text NOT NULL,
  contact_id text NOT NULL,
  recipient_hash text NOT NULL,
  outlet_id text,
  sequence_step smallint NOT NULL CHECK (sequence_step BETWEEN 0 AND 2),
  idempotency_key text NOT NULL UNIQUE,
  deterministic_message_id text NOT NULL UNIQUE,
  copy_artifact_id uuid NOT NULL REFERENCES copy_artifacts(id),
  send_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'sending', 'sent', 'failed', 'delivery_unknown', 'canceled', 'dead_letter')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  locked_until timestamptz,
  locked_by text,
  provider_message_id text,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  canceled_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS send_queue_release_recipient_step_idx
  ON send_queue (release_id, recipient_hash, sequence_step);
CREATE INDEX IF NOT EXISTS send_queue_claim_idx
  ON send_queue (status, send_at, created_at)
  WHERE status IN ('ready', 'failed');
CREATE INDEX IF NOT EXISTS send_queue_contact_active_idx
  ON send_queue (contact_id, status);
CREATE INDEX IF NOT EXISTS send_queue_outlet_active_idx
  ON send_queue (outlet_id, sent_at DESC);

CREATE TABLE IF NOT EXISTS response_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id text NOT NULL,
  release_id text,
  contact_id text NOT NULL,
  outlet_id text,
  idempotency_key text NOT NULL UNIQUE,
  deterministic_message_id text NOT NULL UNIQUE,
  payload_ciphertext bytea NOT NULL,
  payload_iv bytea NOT NULL,
  payload_tag bytea NOT NULL,
  key_version text NOT NULL,
  send_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'sending', 'sent', 'failed', 'delivery_unknown', 'canceled', 'dead_letter')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  locked_until timestamptz,
  locked_by text,
  provider_message_id text,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS response_queue_claim_idx
  ON response_queue (status, send_at, created_at)
  WHERE status IN ('ready', 'failed');
CREATE INDEX IF NOT EXISTS response_queue_contact_window_idx
  ON response_queue (contact_id, created_at DESC, status);
CREATE INDEX IF NOT EXISTS response_queue_global_window_idx
  ON response_queue (created_at DESC, status);

CREATE TABLE IF NOT EXISTS delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  send_queue_id uuid NOT NULL REFERENCES send_queue(id),
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  status text NOT NULL CHECK (status IN ('started', 'accepted', 'definite_failure', 'delivery_unknown')),
  provider_message_id text,
  error_code text,
  correlation_id text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE (send_queue_id, attempt_number)
);

CREATE TABLE IF NOT EXISTS response_delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_queue_id uuid NOT NULL REFERENCES response_queue(id),
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  status text NOT NULL CHECK (status IN ('started', 'accepted', 'definite_failure', 'delivery_unknown')),
  provider_message_id text,
  error_code text,
  correlation_id text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE (response_queue_id, attempt_number)
);

CREATE TABLE IF NOT EXISTS suppression_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type text NOT NULL CHECK (subject_type IN ('email', 'domain', 'contact', 'outlet')),
  subject_hash text NOT NULL,
  reason text NOT NULL,
  source text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_type, subject_hash)
);

CREATE INDEX IF NOT EXISTS suppression_cache_active_idx
  ON suppression_cache (subject_type, subject_hash)
  WHERE active = true;

CREATE TABLE IF NOT EXISTS send_counters (
  counter_date date NOT NULL,
  counter_type text NOT NULL CHECK (counter_type IN ('global', 'domain', 'release')),
  subject_hash text NOT NULL,
  sent_count integer NOT NULL DEFAULT 0 CHECK (sent_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (counter_date, counter_type, subject_hash)
);

CREATE TABLE IF NOT EXISTS send_capacity_reservations (
  send_queue_id uuid NOT NULL REFERENCES send_queue(id),
  counter_date date NOT NULL DEFAULT CURRENT_DATE,
  global_hash text NOT NULL,
  release_hash text NOT NULL,
  domain_hash text NOT NULL,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'consumed', 'released')),
  reserved_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz,
  PRIMARY KEY (send_queue_id, counter_date)
);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_name text NOT NULL,
  correlation_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  watermark_from timestamptz,
  watermark_to timestamptz,
  counters jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS workflow_runs_lookup_idx
  ON workflow_runs (workflow_name, started_at DESC);

CREATE TABLE IF NOT EXISTS legacy_migration_runs (
  run_id text PRIMARY KEY,
  migration_version text NOT NULL,
  source_digest text NOT NULL,
  scope_limit integer,
  status text NOT NULL CHECK (status IN ('running', 'failed', 'succeeded')),
  next_contact_offset integer NOT NULL DEFAULT 0 CHECK (next_contact_offset >= 0),
  counters jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error_code text,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE TABLE IF NOT EXISTS watermarks (
  name text PRIMARY KEY,
  value timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS safety_state (
  name text PRIMARY KEY,
  state text NOT NULL CHECK (state IN ('closed', 'open')),
  reason text,
  opened_at timestamptz,
  paused_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO safety_state (name, state)
VALUES ('global-send-circuit', 'closed')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS outcome_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id text,
  send_queue_id uuid REFERENCES send_queue(id),
  event_type text NOT NULL,
  provider_event_id text,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_event_id)
);

CREATE INDEX IF NOT EXISTS outcome_events_health_idx
  ON outcome_events (event_type, occurred_at DESC);

COMMENT ON TABLE encrypted_event_inbox IS 'Encrypted webhook payloads. Clear columns contain routing metadata only.';
COMMENT ON TABLE suppression_cache IS 'Deny-wins hashes only; raw email addresses stay in EspoCRM.';
COMMENT ON TABLE response_queue IS 'Encrypted, allow-listed automatic replies; never free-form agent output.';
