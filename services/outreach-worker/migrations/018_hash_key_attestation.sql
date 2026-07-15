CREATE TABLE IF NOT EXISTS outreach_hash_key_attestations (
  singleton_id smallint PRIMARY KEY DEFAULT 1 CHECK (singleton_id = 1),
  hash_epoch varchar(32) NOT NULL CHECK (hash_epoch ~ '^[A-Za-z0-9._-]{1,32}$'),
  subject_hash_version text NOT NULL CHECK (subject_hash_version = 'hmac-sha256-subject-v1'),
  integrity_hash_version text NOT NULL CHECK (integrity_hash_version = 'hmac-sha256-exact-v1'),
  key_fingerprint char(64) NOT NULL CHECK (key_fingerprint ~ '^[0-9a-f]{64}$'),
  attestation_mac char(64) NOT NULL CHECK (attestation_mac ~ '^[0-9a-f]{64}$'),
  bootstrap_reference varchar(128) NOT NULL CHECK (length(bootstrap_reference) BETWEEN 12 AND 128),
  attested_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE outreach_hash_key_attestations IS
  'Immutable keyed attestation for the singleton OUTREACH_HASH_KEY namespace. A mismatch is a hard startup failure; rotation requires a separately implemented bounded rehash migration.';

CREATE OR REPLACE FUNCTION reject_hash_key_attestation_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'outreach hash-key attestation is immutable'
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS outreach_hash_key_attestation_immutable_row
  ON outreach_hash_key_attestations;
CREATE TRIGGER outreach_hash_key_attestation_immutable_row
BEFORE UPDATE OR DELETE ON outreach_hash_key_attestations
FOR EACH ROW EXECUTE FUNCTION reject_hash_key_attestation_mutation();

DROP TRIGGER IF EXISTS outreach_hash_key_attestation_immutable_truncate
  ON outreach_hash_key_attestations;
CREATE TRIGGER outreach_hash_key_attestation_immutable_truncate
BEFORE TRUNCATE ON outreach_hash_key_attestations
FOR EACH STATEMENT EXECUTE FUNCTION reject_hash_key_attestation_mutation();

ALTER TABLE crm_intake_receipts
  ADD COLUMN IF NOT EXISTS privacy_record_id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS privacy_tombstoned_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_plan_id uuid;
ALTER TABLE crm_intake_receipts
  ADD CONSTRAINT crm_intake_receipts_privacy_plan_fk
  FOREIGN KEY (privacy_plan_id) REFERENCES privacy_governance_plans(id) ON DELETE RESTRICT NOT VALID;

ALTER TABLE purpose_bound_evidence_attestations
  ADD COLUMN IF NOT EXISTS privacy_record_id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS privacy_tombstoned_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_plan_id uuid;
ALTER TABLE purpose_bound_evidence_attestations
  ADD CONSTRAINT purpose_bound_evidence_privacy_plan_fk
  FOREIGN KEY (privacy_plan_id) REFERENCES privacy_governance_plans(id) ON DELETE RESTRICT NOT VALID;

CREATE UNIQUE INDEX crm_intake_receipts_privacy_record_idx
  ON crm_intake_receipts (privacy_record_id) WHERE privacy_record_id IS NOT NULL;
CREATE INDEX crm_intake_receipts_privacy_null_idx
  ON crm_intake_receipts (entity_type,entity_id,revision_digest) WHERE privacy_record_id IS NULL;
CREATE INDEX crm_intake_receipts_privacy_candidate_idx
  ON crm_intake_receipts (updated_at,privacy_record_id) WHERE privacy_tombstoned_at IS NULL;
CREATE INDEX crm_intake_receipts_privacy_entity_idx
  ON crm_intake_receipts (entity_type,entity_id,updated_at,privacy_record_id)
  WHERE privacy_tombstoned_at IS NULL;

CREATE UNIQUE INDEX purpose_bound_evidence_privacy_record_idx
  ON purpose_bound_evidence_attestations (privacy_record_id) WHERE privacy_record_id IS NOT NULL;
CREATE INDEX purpose_bound_evidence_privacy_null_idx
  ON purpose_bound_evidence_attestations (entity_type,entity_id) WHERE privacy_record_id IS NULL;
CREATE INDEX purpose_bound_evidence_privacy_candidate_idx
  ON purpose_bound_evidence_attestations (updated_at,privacy_record_id)
  WHERE privacy_tombstoned_at IS NULL;
CREATE INDEX purpose_bound_evidence_privacy_entity_idx
  ON purpose_bound_evidence_attestations (entity_type,entity_id,updated_at,privacy_record_id)
  WHERE privacy_tombstoned_at IS NULL;
