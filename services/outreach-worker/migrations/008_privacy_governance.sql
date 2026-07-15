CREATE TABLE IF NOT EXISTS privacy_legal_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type text NOT NULL CHECK (subject_type IN ('global','contact','email','outlet','domain')),
  subject_hash char(64) NOT NULL CHECK (subject_hash ~ '^[0-9a-f]{64}$'),
  scope_data_class text NOT NULL CHECK (scope_data_class IN (
    '*',
    'inbound_event_evidence',
    'generated_copy_evidence',
    'automatic_response_evidence',
    'human_review_evidence',
    'queue_routing_metadata',
    'delivery_attempt_metadata',
    'outcome_metadata',
    'source_traceability_metadata',
    'email_validation_metadata'
  )),
  case_reference text NOT NULL CHECK (case_reference ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{7,119}$'),
  evidence_digest char(64) NOT NULL CHECK (evidence_digest ~ '^[0-9a-f]{64}$'),
  evidence_ciphertext bytea NOT NULL,
  evidence_iv bytea NOT NULL,
  evidence_tag bytea NOT NULL,
  key_version text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','released')),
  created_by text NOT NULL CHECK (length(created_by) BETWEEN 8 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  released_by text,
  released_at timestamptz,
  release_reference text,
  CHECK (
    (status='active' AND released_by IS NULL AND released_at IS NULL AND release_reference IS NULL)
    OR
    (status='released' AND released_by IS NOT NULL AND released_at IS NOT NULL AND release_reference IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS privacy_legal_holds_active_unique_idx
  ON privacy_legal_holds (subject_type,subject_hash,scope_data_class,case_reference)
  WHERE status='active';
CREATE INDEX IF NOT EXISTS privacy_legal_holds_active_scope_idx
  ON privacy_legal_holds (scope_data_class,subject_hash)
  WHERE status='active';

CREATE TABLE IF NOT EXISTS privacy_legal_hold_subject_keys (
  hold_id uuid NOT NULL REFERENCES privacy_legal_holds(id) ON DELETE RESTRICT,
  key_type text NOT NULL CHECK (key_type IN ('canonical','email_validation','source_identity')),
  subject_hash char(64) NOT NULL CHECK (subject_hash ~ '^[0-9a-f]{64}$'),
  PRIMARY KEY (hold_id,key_type,subject_hash)
);

CREATE INDEX IF NOT EXISTS privacy_legal_hold_subject_lookup_idx
  ON privacy_legal_hold_subject_keys (key_type,subject_hash,hold_id);

CREATE TABLE IF NOT EXISTS privacy_dsar_requests (
  id uuid PRIMARY KEY,
  request_type text NOT NULL CHECK (request_type IN ('lookup','export','correction','erasure')),
  subject_type text NOT NULL CHECK (subject_type IN ('contact','email')),
  subject_hash char(64) NOT NULL CHECK (subject_hash ~ '^[0-9a-f]{64}$'),
  request_reference text NOT NULL UNIQUE CHECK (request_reference ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{7,119}$'),
  request_digest char(64) NOT NULL CHECK (request_digest ~ '^[0-9a-f]{64}$'),
  payload_ciphertext bytea NOT NULL,
  payload_iv bytea NOT NULL,
  payload_tag bytea NOT NULL,
  key_version text NOT NULL,
  requested_by text NOT NULL CHECK (length(requested_by) BETWEEN 8 AND 120),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','planned','blocked','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE INDEX IF NOT EXISTS privacy_dsar_requests_subject_idx
  ON privacy_dsar_requests (subject_type,subject_hash,created_at DESC);

CREATE TABLE IF NOT EXISTS privacy_dsar_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES privacy_dsar_requests(id) ON DELETE RESTRICT,
  artifact_type text NOT NULL CHECK (artifact_type IN ('lookup','export','correction_plan','erasure_plan')),
  artifact_digest char(64) NOT NULL CHECK (artifact_digest ~ '^[0-9a-f]{64}$'),
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload_ciphertext bytea NOT NULL,
  payload_iv bytea NOT NULL,
  payload_tag bytea NOT NULL,
  key_version text NOT NULL,
  created_by text NOT NULL CHECK (length(created_by) BETWEEN 8 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id,artifact_type,artifact_digest)
);

CREATE TABLE IF NOT EXISTS privacy_espo_mutation_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES privacy_dsar_requests(id) ON DELETE RESTRICT,
  entity_type text NOT NULL CHECK (entity_type IN ('MediaContact','MediaOutlet','MusicRelease','OutreachMatch','Email')),
  entity_id_hash char(64) NOT NULL CHECK (entity_id_hash ~ '^[0-9a-f]{64}$'),
  expected_version bigint NOT NULL CHECK (expected_version >= 0),
  mutation_type text NOT NULL CHECK (mutation_type IN ('correction','erasure_anonymization')),
  plan_digest char(64) NOT NULL CHECK (plan_digest ~ '^[0-9a-f]{64}$'),
  payload_ciphertext bytea NOT NULL,
  payload_iv bytea NOT NULL,
  payload_tag bytea NOT NULL,
  key_version text NOT NULL,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id,entity_type,entity_id_hash,mutation_type,plan_digest)
);

COMMENT ON TABLE privacy_espo_mutation_plans IS
  'Encrypted, version-conditional plans only. This service deliberately has no executor for EspoCRM DSAR mutations.';

CREATE TABLE IF NOT EXISTS privacy_governance_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_type text NOT NULL CHECK (plan_type IN ('retention')),
  policy_schema_version integer NOT NULL CHECK (policy_schema_version = 1),
  policy_version text NOT NULL,
  policy_digest char(64) NOT NULL CHECK (policy_digest ~ '^[0-9a-f]{64}$'),
  approved_policy_reference text NOT NULL,
  snapshot_at timestamptz NOT NULL,
  canonical_digest char(64) NOT NULL UNIQUE CHECK (canonical_digest ~ '^[0-9a-f]{64}$'),
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','running','blocked','failed','completed')),
  approval_id text,
  change_id text,
  recovery_id text,
  execution_binding_digest char(64),
  created_by text NOT NULL CHECK (length(created_by) BETWEEN 8 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  last_error_code text,
  CHECK (
    (execution_binding_digest IS NULL AND approval_id IS NULL AND change_id IS NULL AND recovery_id IS NULL)
    OR
    (execution_binding_digest IS NOT NULL AND approval_id IS NOT NULL AND change_id IS NOT NULL AND recovery_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS privacy_governance_plan_items (
  plan_id uuid NOT NULL REFERENCES privacy_governance_plans(id) ON DELETE RESTRICT,
  ordinal bigint NOT NULL CHECK (ordinal >= 0),
  data_class text NOT NULL CHECK (data_class IN (
    'inbound_event_evidence',
    'generated_copy_evidence',
    'automatic_response_evidence',
    'human_review_evidence',
    'queue_routing_metadata',
    'delivery_attempt_metadata',
    'outcome_metadata',
    'source_traceability_metadata',
    'email_validation_metadata'
  )),
  table_name text NOT NULL,
  record_key text NOT NULL,
  observed_digest char(64) NOT NULL CHECK (observed_digest ~ '^[0-9a-f]{64}$'),
  cutoff_at timestamptz NOT NULL,
  action text NOT NULL CHECK (action IN (
    'crypto_tombstone','metadata_anonymize','legal_hold_preserved','safety_deny_wins_preserved'
  )),
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','held','completed')),
  completed_at timestamptz,
  PRIMARY KEY (plan_id,ordinal),
  UNIQUE (plan_id,table_name,record_key),
  CHECK ((status='completed' AND completed_at IS NOT NULL) OR (status<>'completed' AND completed_at IS NULL))
);

CREATE INDEX IF NOT EXISTS privacy_governance_items_resume_idx
  ON privacy_governance_plan_items (plan_id,status,ordinal);

CREATE TABLE IF NOT EXISTS privacy_execution_leases (
  lease_name text PRIMARY KEY,
  owner_id text,
  fence_token bigint NOT NULL DEFAULT 0 CHECK (fence_token >= 0),
  plan_id uuid REFERENCES privacy_governance_plans(id) ON DELETE SET NULL,
  locked_until timestamptz,
  acquired_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS privacy_audit_events (
  sequence_id bigserial PRIMARY KEY,
  event_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  actor_id text NOT NULL CHECK (length(actor_id) BETWEEN 8 AND 120),
  plan_digest char(64),
  approval_id text,
  change_id text,
  recovery_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous_hash char(64) NOT NULL CHECK (previous_hash ~ '^[0-9a-f]{64}$'),
  event_hash char(64) NOT NULL UNIQUE CHECK (event_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION reject_privacy_audit_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'privacy_audit_events is append-only' USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS privacy_audit_append_only ON privacy_audit_events;
CREATE TRIGGER privacy_audit_append_only
  BEFORE UPDATE OR DELETE ON privacy_audit_events
  FOR EACH ROW EXECUTE FUNCTION reject_privacy_audit_mutation();

ALTER TABLE encrypted_event_inbox
  ADD COLUMN IF NOT EXISTS privacy_tombstoned_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_plan_id uuid;
ALTER TABLE copy_artifacts
  ADD COLUMN IF NOT EXISTS privacy_tombstoned_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_plan_id uuid;
ALTER TABLE response_queue
  ADD COLUMN IF NOT EXISTS privacy_tombstoned_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_plan_id uuid;
ALTER TABLE human_review_items
  ADD COLUMN IF NOT EXISTS privacy_tombstoned_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_plan_id uuid;
ALTER TABLE work_items
  ADD COLUMN IF NOT EXISTS privacy_tombstoned_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_plan_id uuid;
ALTER TABLE send_queue
  ADD COLUMN IF NOT EXISTS privacy_tombstoned_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_plan_id uuid;
ALTER TABLE sequence_allocations
  ADD COLUMN IF NOT EXISTS privacy_record_id uuid,
  ADD COLUMN IF NOT EXISTS privacy_tombstoned_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_plan_id uuid;
ALTER TABLE delivery_attempts
  ADD COLUMN IF NOT EXISTS privacy_tombstoned_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_plan_id uuid;
ALTER TABLE response_delivery_attempts
  ADD COLUMN IF NOT EXISTS privacy_tombstoned_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_plan_id uuid;
ALTER TABLE outcome_events
  ADD COLUMN IF NOT EXISTS privacy_tombstoned_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_plan_id uuid;
ALTER TABLE source_ingestion_record_links
  ADD COLUMN IF NOT EXISTS privacy_record_id uuid,
  ADD COLUMN IF NOT EXISTS privacy_tombstoned_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_plan_id uuid;
ALTER TABLE email_validation_cache
  ADD COLUMN IF NOT EXISTS privacy_record_id uuid,
  ADD COLUMN IF NOT EXISTS privacy_tombstoned_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_plan_id uuid;
ALTER TABLE source_identity_bindings
  ADD COLUMN IF NOT EXISTS privacy_record_id uuid,
  ADD COLUMN IF NOT EXISTS privacy_tombstoned_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_plan_id uuid;
ALTER TABLE source_identity_claims
  ADD COLUMN IF NOT EXISTS privacy_tombstoned_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_plan_id uuid;
ALTER TABLE source_identity_claim_items
  ADD COLUMN IF NOT EXISTS privacy_record_id uuid,
  ADD COLUMN IF NOT EXISTS privacy_tombstoned_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_plan_id uuid;

DO $$
DECLARE
  relation_name text;
  constraint_name text;
BEGIN
  FOR relation_name,constraint_name IN
    SELECT * FROM (VALUES
      ('encrypted_event_inbox','encrypted_event_inbox_privacy_plan_fk'),
      ('copy_artifacts','copy_artifacts_privacy_plan_fk'),
      ('response_queue','response_queue_privacy_plan_fk'),
      ('human_review_items','human_review_items_privacy_plan_fk'),
      ('work_items','work_items_privacy_plan_fk'),
      ('send_queue','send_queue_privacy_plan_fk'),
      ('sequence_allocations','sequence_allocations_privacy_plan_fk'),
      ('delivery_attempts','delivery_attempts_privacy_plan_fk'),
      ('response_delivery_attempts','response_delivery_attempts_privacy_plan_fk'),
      ('outcome_events','outcome_events_privacy_plan_fk'),
      ('source_ingestion_record_links','source_ingestion_record_links_privacy_plan_fk'),
      ('email_validation_cache','email_validation_cache_privacy_plan_fk'),
      ('source_identity_bindings','source_identity_bindings_privacy_plan_fk'),
      ('source_identity_claims','source_identity_claims_privacy_plan_fk'),
      ('source_identity_claim_items','source_identity_claim_items_privacy_plan_fk')
    ) AS constraints(relation_name,constraint_name)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname=constraint_name AND conrelid=relation_name::regclass
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (privacy_plan_id) REFERENCES privacy_governance_plans(id) ON DELETE RESTRICT NOT VALID',
        relation_name,
        constraint_name
      );
    END IF;
  END LOOP;
END;
$$;
COMMENT ON TABLE privacy_governance_plans IS
  'Digest-bound dry-run plans. Durations originate only from the externally approved versioned policy JSON.';
COMMENT ON TABLE privacy_audit_events IS
  'Append-only hash-chain evidence; details must contain identifiers and aggregate counts, never raw subjects or payloads.';
COMMENT ON TABLE suppression_cache IS
  'Deny-wins keyed hashes are intentionally excluded from privacy tombstoning so a prior opt-out remains enforceable.';
COMMENT ON COLUMN sequence_allocations.privacy_record_id IS
  'Nullable online-migration key. Built by the bounded privacy:index job only after its partial unique index is valid.';
