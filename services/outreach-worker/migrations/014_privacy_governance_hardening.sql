-- Privacy governance hardening. Existing migrations 008/009 remain immutable;
-- this migration only adds versioned contracts and online-backfillable columns.

CREATE TABLE privacy_record_subject_keys (
  data_class text NOT NULL,
  table_name text NOT NULL,
  record_key text NOT NULL,
  key_type text NOT NULL CHECK (key_type IN ('canonical','email_validation','source_identity')),
  subject_hash char(64) NOT NULL CHECK (subject_hash ~ '^[0-9a-f]{64}$'),
  linked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (data_class,table_name,record_key,key_type,subject_hash)
);

CREATE INDEX privacy_record_subject_lookup_idx
  ON privacy_record_subject_keys (key_type,subject_hash,data_class,table_name,record_key);

CREATE TABLE privacy_record_subject_state (
  data_class text NOT NULL,
  table_name text NOT NULL,
  record_key text NOT NULL,
  linkage_digest char(64) NOT NULL CHECK (linkage_digest ~ '^[0-9a-f]{64}$'),
  integrity_version text NOT NULL CHECK (integrity_version='hmac-sha256-exact-v1'),
  linked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (data_class,table_name,record_key)
);

COMMENT ON TABLE privacy_record_subject_keys IS
  'Durable data-subject linkage retained after source rows are tombstoned; legal-hold and DSAR fences use this graph.';

CREATE TABLE privacy_dsar_subject_keys (
  request_id uuid NOT NULL REFERENCES privacy_dsar_requests(id) ON DELETE RESTRICT,
  key_type text NOT NULL CHECK (key_type IN ('canonical','email_validation','source_identity')),
  subject_hash char(64) NOT NULL CHECK (subject_hash ~ '^[0-9a-f]{64}$'),
  relation_type text NOT NULL CHECK (relation_type IN ('request_subject','derived_record')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id,key_type,subject_hash)
);

CREATE INDEX privacy_dsar_subject_lookup_idx
  ON privacy_dsar_subject_keys (key_type,subject_hash,request_id);

CREATE TABLE privacy_dsar_subject_entities (
  request_id uuid NOT NULL REFERENCES privacy_dsar_requests(id) ON DELETE RESTRICT,
  entity_type text NOT NULL CHECK (entity_type IN ('MediaContact','Email')),
  entity_id_hash char(64) NOT NULL CHECK (entity_id_hash ~ '^[0-9a-f]{64}$'),
  relation_type text NOT NULL CHECK (relation_type IN ('direct_subject','delivery_evidence')),
  evidence_table text NOT NULL,
  evidence_record_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id,entity_type,entity_id_hash)
);

CREATE INDEX privacy_dsar_subject_entity_lookup_idx
  ON privacy_dsar_subject_entities (entity_type,entity_id_hash,request_id);

ALTER TABLE privacy_legal_holds ADD COLUMN integrity_version text;
ALTER TABLE privacy_dsar_requests ADD COLUMN integrity_version text;
ALTER TABLE privacy_dsar_artifacts ADD COLUMN integrity_version text;
ALTER TABLE privacy_espo_mutation_plans
  ADD COLUMN integrity_version text,
  ADD COLUMN subject_graph_digest char(64);
ALTER TABLE privacy_governance_plans
  ADD COLUMN target_contract_digest char(64),
  ADD COLUMN target_contract_version text;
ALTER TABLE privacy_governance_plan_items
  ADD COLUMN observed_digest_version text;

ALTER TABLE privacy_legal_holds
  ADD COLUMN privacy_tombstoned_at timestamptz,
  ADD COLUMN privacy_plan_id uuid;
ALTER TABLE privacy_dsar_requests
  ADD COLUMN privacy_tombstoned_at timestamptz,
  ADD COLUMN privacy_plan_id uuid,
  ADD COLUMN closed_by text,
  ADD COLUMN closure_reference text;
ALTER TABLE privacy_dsar_requests ADD CONSTRAINT privacy_dsar_closure_contract
  CHECK ((status='closed' AND closed_at IS NOT NULL AND closed_by IS NOT NULL AND closure_reference IS NOT NULL)
      OR (status<>'closed' AND closed_at IS NULL AND closed_by IS NULL AND closure_reference IS NULL)) NOT VALID;
ALTER TABLE privacy_dsar_artifacts
  ADD COLUMN privacy_tombstoned_at timestamptz,
  ADD COLUMN privacy_plan_id uuid;
ALTER TABLE privacy_espo_mutation_plans
  ADD COLUMN privacy_tombstoned_at timestamptz,
  ADD COLUMN privacy_plan_id uuid;

UPDATE privacy_legal_holds SET integrity_version='normalized-hmac-v0' WHERE integrity_version IS NULL;
UPDATE privacy_dsar_requests SET integrity_version='normalized-hmac-v0' WHERE integrity_version IS NULL;
UPDATE privacy_dsar_artifacts SET integrity_version='normalized-hmac-v0' WHERE integrity_version IS NULL;
UPDATE privacy_espo_mutation_plans SET integrity_version='normalized-hmac-v0' WHERE integrity_version IS NULL;

ALTER TABLE privacy_legal_holds
  ALTER COLUMN integrity_version SET DEFAULT 'hmac-sha256-exact-v1',
  ALTER COLUMN integrity_version SET NOT NULL;
ALTER TABLE privacy_dsar_requests
  ALTER COLUMN integrity_version SET DEFAULT 'hmac-sha256-exact-v1',
  ALTER COLUMN integrity_version SET NOT NULL;
ALTER TABLE privacy_dsar_artifacts
  ALTER COLUMN integrity_version SET DEFAULT 'hmac-sha256-exact-v1',
  ALTER COLUMN integrity_version SET NOT NULL;
ALTER TABLE privacy_espo_mutation_plans
  ALTER COLUMN integrity_version SET DEFAULT 'hmac-sha256-exact-v1',
  ALTER COLUMN integrity_version SET NOT NULL;

ALTER TABLE privacy_espo_mutation_plans
  ADD CONSTRAINT privacy_espo_subject_graph_digest_check
  CHECK (subject_graph_digest IS NULL OR subject_graph_digest ~ '^[0-9a-f]{64}$') NOT VALID;
ALTER TABLE privacy_governance_plans
  ADD CONSTRAINT privacy_target_contract_digest_check
  CHECK (target_contract_digest IS NULL OR target_contract_digest ~ '^[0-9a-f]{64}$') NOT VALID;

-- Previously omitted operational records join the plan-bound lifecycle. UUID
-- defaults are installed only after bounded backfill by privacy:index, avoiding
-- a volatile-default rewrite of existing production tables.
ALTER TABLE send_counters
  ADD COLUMN privacy_record_id uuid,
  ADD COLUMN privacy_tombstoned_at timestamptz,
  ADD COLUMN privacy_plan_id uuid;
ALTER TABLE send_capacity_reservations
  ADD COLUMN privacy_record_id uuid,
  ADD COLUMN privacy_tombstoned_at timestamptz,
  ADD COLUMN privacy_plan_id uuid;
ALTER TABLE outlet_first_send_guards
  ADD COLUMN privacy_record_id uuid,
  ADD COLUMN privacy_tombstoned_at timestamptz,
  ADD COLUMN privacy_plan_id uuid;
ALTER TABLE source_ingestion_receipts
  ADD COLUMN privacy_record_id uuid,
  ADD COLUMN privacy_tombstoned_at timestamptz,
  ADD COLUMN privacy_plan_id uuid;
ALTER TABLE contact_genre_denials
  ADD COLUMN privacy_record_id uuid,
  ADD COLUMN contact_hash char(64),
  ADD COLUMN source_event_hash char(64),
  ADD COLUMN match_hash char(64),
  ADD COLUMN release_hash char(64);

DO $$
DECLARE definition record;
BEGIN
  FOR definition IN SELECT * FROM (VALUES
    ('send_counters','send_counters_privacy_plan_fk'),
    ('send_capacity_reservations','send_capacity_reservations_privacy_plan_fk'),
    ('outlet_first_send_guards','outlet_first_send_guards_privacy_plan_fk'),
    ('source_ingestion_receipts','source_ingestion_receipts_privacy_plan_fk'),
    ('privacy_legal_holds','privacy_legal_holds_privacy_plan_fk'),
    ('privacy_dsar_requests','privacy_dsar_requests_privacy_plan_fk'),
    ('privacy_dsar_artifacts','privacy_dsar_artifacts_privacy_plan_fk'),
    ('privacy_espo_mutation_plans','privacy_espo_mutation_plans_privacy_plan_fk')
  ) AS definitions(table_name,constraint_name)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname=definition.constraint_name) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (privacy_plan_id) REFERENCES privacy_governance_plans(id) ON DELETE RESTRICT NOT VALID',
        definition.table_name,definition.constraint_name
      );
    END IF;
  END LOOP;
END;
$$;

ALTER TABLE contact_genre_denials
  ADD CONSTRAINT contact_genre_denials_contact_hash_check
  CHECK (contact_hash IS NULL OR contact_hash ~ '^[0-9a-f]{64}$') NOT VALID,
  ADD CONSTRAINT contact_genre_denials_source_event_hash_check
  CHECK (source_event_hash IS NULL OR source_event_hash ~ '^[0-9a-f]{64}$') NOT VALID,
  ADD CONSTRAINT contact_genre_denials_match_hash_check
  CHECK (match_hash IS NULL OR match_hash ~ '^[0-9a-f]{64}$') NOT VALID,
  ADD CONSTRAINT contact_genre_denials_release_hash_check
  CHECK (release_hash IS NULL OR release_hash ~ '^[0-9a-f]{64}$') NOT VALID;

CREATE UNIQUE INDEX contact_genre_denials_contact_hash_genre_idx
  ON contact_genre_denials (contact_hash,genre) WHERE contact_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION reject_privacy_immutable_row()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is immutable',TG_TABLE_NAME USING ERRCODE='55000';
END;
$$;

CREATE OR REPLACE FUNCTION enforce_privacy_plan_immutability()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(OLD.id,OLD.plan_type,OLD.policy_schema_version,OLD.policy_version,OLD.policy_digest,
         OLD.approved_policy_reference,OLD.snapshot_at,OLD.canonical_digest,OLD.counts,OLD.created_by,
         OLD.created_at,OLD.target_contract_digest,OLD.target_contract_version)
     IS DISTINCT FROM
     ROW(NEW.id,NEW.plan_type,NEW.policy_schema_version,NEW.policy_version,NEW.policy_digest,
         NEW.approved_policy_reference,NEW.snapshot_at,NEW.canonical_digest,NEW.counts,NEW.created_by,
         NEW.created_at,NEW.target_contract_digest,NEW.target_contract_version) THEN
    RAISE EXCEPTION 'privacy governance plan approval facts are immutable' USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_privacy_plan_item_immutability()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(OLD.plan_id,OLD.ordinal,OLD.data_class,OLD.table_name,OLD.record_key,OLD.observed_digest,
         OLD.observed_digest_version,OLD.cutoff_at,OLD.action)
     IS DISTINCT FROM
     ROW(NEW.plan_id,NEW.ordinal,NEW.data_class,NEW.table_name,NEW.record_key,NEW.observed_digest,
         NEW.observed_digest_version,NEW.cutoff_at,NEW.action) THEN
    RAISE EXCEPTION 'privacy governance plan item target facts are immutable' USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_privacy_legal_hold_immutability()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(OLD.id,OLD.subject_type,OLD.subject_hash,OLD.scope_data_class,OLD.case_reference,
         OLD.evidence_digest,OLD.integrity_version,OLD.created_by,OLD.created_at)
     IS DISTINCT FROM
     ROW(NEW.id,NEW.subject_type,NEW.subject_hash,NEW.scope_data_class,NEW.case_reference,
         NEW.evidence_digest,NEW.integrity_version,NEW.created_by,NEW.created_at) THEN
    RAISE EXCEPTION 'privacy legal-hold evidence is immutable' USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_privacy_dsar_request_immutability()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(OLD.id,OLD.request_type,OLD.subject_type,OLD.subject_hash,OLD.request_reference,OLD.request_digest,
         OLD.integrity_version,OLD.requested_by,OLD.created_at)
     IS DISTINCT FROM
     ROW(NEW.id,NEW.request_type,NEW.subject_type,NEW.subject_hash,NEW.request_reference,NEW.request_digest,
         NEW.integrity_version,NEW.requested_by,NEW.created_at) THEN
    RAISE EXCEPTION 'privacy DSAR request facts are immutable' USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_privacy_espo_plan_immutability()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(OLD.id,OLD.request_id,OLD.entity_type,OLD.entity_id_hash,OLD.expected_version,OLD.mutation_type,
         OLD.plan_digest,OLD.integrity_version,OLD.subject_graph_digest,OLD.created_at)
     IS DISTINCT FROM
     ROW(NEW.id,NEW.request_id,NEW.entity_type,NEW.entity_id_hash,NEW.expected_version,NEW.mutation_type,
         NEW.plan_digest,NEW.integrity_version,NEW.subject_graph_digest,NEW.created_at) THEN
    RAISE EXCEPTION 'privacy Espo mutation plan facts are immutable' USING ERRCODE='55000';
  END IF;
  IF OLD.status='cancelled' AND NEW.status<>'cancelled' THEN
    RAISE EXCEPTION 'cancelled privacy Espo mutation plan cannot be reopened' USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_privacy_dsar_artifact_immutability()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(OLD.id,OLD.request_id,OLD.artifact_type,OLD.artifact_digest,OLD.counts,OLD.integrity_version,
         OLD.created_by,OLD.created_at)
     IS DISTINCT FROM
     ROW(NEW.id,NEW.request_id,NEW.artifact_type,NEW.artifact_digest,NEW.counts,NEW.integrity_version,
         NEW.created_by,NEW.created_at) THEN
    RAISE EXCEPTION 'privacy DSAR artifact facts are immutable' USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER privacy_plan_immutable_update
  BEFORE UPDATE ON privacy_governance_plans FOR EACH ROW EXECUTE FUNCTION enforce_privacy_plan_immutability();
CREATE TRIGGER privacy_plan_immutable_delete
  BEFORE DELETE ON privacy_governance_plans FOR EACH ROW EXECUTE FUNCTION reject_privacy_immutable_row();
CREATE TRIGGER privacy_plan_item_immutable_update
  BEFORE UPDATE ON privacy_governance_plan_items FOR EACH ROW EXECUTE FUNCTION enforce_privacy_plan_item_immutability();
CREATE TRIGGER privacy_plan_item_immutable_delete
  BEFORE DELETE ON privacy_governance_plan_items FOR EACH ROW EXECUTE FUNCTION reject_privacy_immutable_row();
CREATE TRIGGER privacy_legal_hold_immutable_update
  BEFORE UPDATE ON privacy_legal_holds FOR EACH ROW EXECUTE FUNCTION enforce_privacy_legal_hold_immutability();
CREATE TRIGGER privacy_legal_hold_immutable_delete
  BEFORE DELETE ON privacy_legal_holds FOR EACH ROW EXECUTE FUNCTION reject_privacy_immutable_row();
CREATE TRIGGER privacy_dsar_request_immutable_update
  BEFORE UPDATE ON privacy_dsar_requests FOR EACH ROW EXECUTE FUNCTION enforce_privacy_dsar_request_immutability();
CREATE TRIGGER privacy_dsar_request_immutable_delete
  BEFORE DELETE ON privacy_dsar_requests FOR EACH ROW EXECUTE FUNCTION reject_privacy_immutable_row();
CREATE TRIGGER privacy_dsar_artifact_immutable_update
  BEFORE UPDATE ON privacy_dsar_artifacts FOR EACH ROW EXECUTE FUNCTION enforce_privacy_dsar_artifact_immutability();
CREATE TRIGGER privacy_dsar_artifact_immutable_delete
  BEFORE DELETE ON privacy_dsar_artifacts FOR EACH ROW EXECUTE FUNCTION reject_privacy_immutable_row();
CREATE TRIGGER privacy_espo_plan_immutable_update
  BEFORE UPDATE ON privacy_espo_mutation_plans FOR EACH ROW EXECUTE FUNCTION enforce_privacy_espo_plan_immutability();
CREATE TRIGGER privacy_espo_plan_immutable_delete
  BEFORE DELETE ON privacy_espo_mutation_plans FOR EACH ROW EXECUTE FUNCTION reject_privacy_immutable_row();
CREATE TRIGGER privacy_record_subject_keys_immutable
  BEFORE UPDATE OR DELETE ON privacy_record_subject_keys FOR EACH ROW EXECUTE FUNCTION reject_privacy_immutable_row();
CREATE TRIGGER privacy_record_subject_state_no_delete
  BEFORE DELETE ON privacy_record_subject_state FOR EACH ROW EXECUTE FUNCTION reject_privacy_immutable_row();
CREATE TRIGGER privacy_dsar_subject_keys_immutable
  BEFORE UPDATE OR DELETE ON privacy_dsar_subject_keys FOR EACH ROW EXECUTE FUNCTION reject_privacy_immutable_row();
CREATE TRIGGER privacy_dsar_subject_entities_immutable
  BEFORE UPDATE OR DELETE ON privacy_dsar_subject_entities FOR EACH ROW EXECUTE FUNCTION reject_privacy_immutable_row();

CREATE OR REPLACE FUNCTION reject_privacy_truncate()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% cannot be truncated',TG_TABLE_NAME USING ERRCODE='55000';
END;
$$;

CREATE TRIGGER privacy_audit_no_truncate BEFORE TRUNCATE ON privacy_audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION reject_privacy_truncate();
CREATE TRIGGER privacy_plan_no_truncate BEFORE TRUNCATE ON privacy_governance_plans
  FOR EACH STATEMENT EXECUTE FUNCTION reject_privacy_truncate();
CREATE TRIGGER privacy_plan_item_no_truncate BEFORE TRUNCATE ON privacy_governance_plan_items
  FOR EACH STATEMENT EXECUTE FUNCTION reject_privacy_truncate();
CREATE TRIGGER privacy_legal_hold_no_truncate BEFORE TRUNCATE ON privacy_legal_holds
  FOR EACH STATEMENT EXECUTE FUNCTION reject_privacy_truncate();
CREATE TRIGGER privacy_dsar_request_no_truncate BEFORE TRUNCATE ON privacy_dsar_requests
  FOR EACH STATEMENT EXECUTE FUNCTION reject_privacy_truncate();
CREATE TRIGGER privacy_dsar_artifact_no_truncate BEFORE TRUNCATE ON privacy_dsar_artifacts
  FOR EACH STATEMENT EXECUTE FUNCTION reject_privacy_truncate();
CREATE TRIGGER privacy_espo_plan_no_truncate BEFORE TRUNCATE ON privacy_espo_mutation_plans
  FOR EACH STATEMENT EXECUTE FUNCTION reject_privacy_truncate();
CREATE TRIGGER privacy_record_subject_keys_no_truncate BEFORE TRUNCATE ON privacy_record_subject_keys
  FOR EACH STATEMENT EXECUTE FUNCTION reject_privacy_truncate();
CREATE TRIGGER privacy_record_subject_state_no_truncate BEFORE TRUNCATE ON privacy_record_subject_state
  FOR EACH STATEMENT EXECUTE FUNCTION reject_privacy_truncate();
CREATE TRIGGER privacy_dsar_subject_keys_no_truncate BEFORE TRUNCATE ON privacy_dsar_subject_keys
  FOR EACH STATEMENT EXECUTE FUNCTION reject_privacy_truncate();
CREATE TRIGGER privacy_dsar_subject_entities_no_truncate BEFORE TRUNCATE ON privacy_dsar_subject_entities
  FOR EACH STATEMENT EXECUTE FUNCTION reject_privacy_truncate();

-- The database, not application-supplied hashes, owns audit-chain linkage.
-- Runtime deployments must use a non-owner role; direct DML is revoked and the
-- SECURITY DEFINER append function is the sole supported insert boundary.
CREATE OR REPLACE FUNCTION append_privacy_audit_event(
  p_event_type text,p_aggregate_type text,p_aggregate_id text,p_actor_id text,
  p_plan_digest char(64),p_approval_id text,p_change_id text,p_recovery_id text,p_details jsonb
) RETURNS TABLE(sequence_id bigint,event_hash char(64))
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  v_previous_hash char(64);
  v_created_at timestamptz := clock_timestamp();
  v_event_hash char(64);
BEGIN
  IF p_event_type NOT IN (
    'retention_plan_created','retention_execution_started','retention_batch_completed',
    'retention_execution_completed','retention_execution_blocked','retention_execution_failed',
    'legal_hold_created','legal_hold_released','dsar_request_created','dsar_plan_created',
    'dsar_plan_blocked','dsar_artifact_exported','dsar_request_closed','espo_mutation_plan_exported',
    'privacy_schema_prepared','privacy_record_index_batch_completed','privacy_record_id_contracts_finalized'
  ) OR p_aggregate_type NOT IN ('privacy_plan','legal_hold','dsar_request','espo_mutation_plan','privacy_record_index')
     OR p_actor_id !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{7,119}$'
     OR length(p_aggregate_id) NOT BETWEEN 1 AND 160
     OR octet_length(COALESCE(p_details,'{}'::jsonb)::text)>262144
     OR (p_plan_digest IS NOT NULL AND p_plan_digest !~ '^[0-9a-f]{64}$') THEN
    RAISE EXCEPTION 'privacy audit event violates the compiled append contract' USING ERRCODE='22023';
  END IF;
  p_details := COALESCE(p_details,'{}'::jsonb) || jsonb_build_object('_databasePrincipal',session_user);
  PERFORM pg_advisory_xact_lock(hashtext('privacy-governance-audit-chain'));
  SELECT audit.event_hash INTO v_previous_hash FROM privacy_audit_events audit ORDER BY audit.sequence_id DESC LIMIT 1;
  v_previous_hash := COALESCE(v_previous_hash,repeat('0',64));
  v_event_hash := encode(digest(convert_to(jsonb_build_object(
    'previousHash',v_previous_hash,'eventType',p_event_type,'aggregateType',p_aggregate_type,
    'aggregateId',p_aggregate_id,'actorId',p_actor_id,'planDigest',p_plan_digest,
    'approvalId',p_approval_id,'changeId',p_change_id,'recoveryId',p_recovery_id,
    'details',COALESCE(p_details,'{}'::jsonb),'createdAt',v_created_at
  )::text,'UTF8'),'sha256'),'hex');
  RETURN QUERY
    INSERT INTO privacy_audit_events
      (event_type,aggregate_type,aggregate_id,actor_id,plan_digest,approval_id,change_id,recovery_id,
       details,previous_hash,event_hash,created_at)
    VALUES (p_event_type,p_aggregate_type,p_aggregate_id,p_actor_id,p_plan_digest,p_approval_id,p_change_id,
            p_recovery_id,COALESCE(p_details,'{}'::jsonb),v_previous_hash,v_event_hash,v_created_at)
    RETURNING privacy_audit_events.sequence_id,privacy_audit_events.event_hash;
END;
$$;

REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON privacy_audit_events FROM PUBLIC;
REVOKE ALL ON FUNCTION append_privacy_audit_event(text,text,text,text,char,text,text,text,jsonb) FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='outreach_privacy_runtime') THEN
    GRANT EXECUTE ON FUNCTION append_privacy_audit_event(text,text,text,text,char,text,text,text,jsonb)
      TO outreach_privacy_runtime;
    GRANT SELECT ON privacy_audit_events TO outreach_privacy_runtime;
    REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON privacy_audit_events FROM outreach_privacy_runtime;
  END IF;
END;
$$;

COMMENT ON FUNCTION append_privacy_audit_event(text,text,text,text,char,text,text,text,jsonb) IS
  'Serialized database-owned append boundary for tamper-evident privacy audit events.';
