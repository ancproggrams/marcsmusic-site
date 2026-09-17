ALTER TABLE copy_artifacts
  ADD COLUMN IF NOT EXISTS authorization_snapshot_digest char(64),
  ADD COLUMN IF NOT EXISTS authorization_snapshot_version smallint;

ALTER TABLE copy_artifacts
  DROP CONSTRAINT IF EXISTS copy_artifacts_authorization_snapshot_contract;
ALTER TABLE copy_artifacts
  ADD CONSTRAINT copy_artifacts_authorization_snapshot_contract CHECK (
    (authorization_snapshot_digest IS NULL AND authorization_snapshot_version IS NULL)
    OR (
      authorization_snapshot_digest ~ '^[0-9a-f]{64}$'
      AND authorization_snapshot_version = 1
    )
  ) NOT VALID;
ALTER TABLE copy_artifacts
  VALIDATE CONSTRAINT copy_artifacts_authorization_snapshot_contract;

CREATE TABLE IF NOT EXISTS campaign_outlet_allocation_counters (
  release_hash char(64) NOT NULL CHECK (release_hash ~ '^[0-9a-f]{64}$'),
  outlet_hash char(64) NOT NULL CHECK (outlet_hash ~ '^[0-9a-f]{64}$'),
  allocated_count smallint NOT NULL CHECK (allocated_count BETWEEN 0 AND 2),
  privacy_record_id uuid NOT NULL DEFAULT gen_random_uuid(),
  privacy_tombstoned_at timestamptz,
  privacy_plan_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (release_hash,outlet_hash),
  CONSTRAINT campaign_outlet_counters_privacy_plan_fk
    FOREIGN KEY (privacy_plan_id) REFERENCES privacy_governance_plans(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS campaign_outlet_allocation_ledger (
  allocation_hash char(64) PRIMARY KEY CHECK (allocation_hash ~ '^[0-9a-f]{64}$'),
  release_hash char(64) NOT NULL CHECK (release_hash ~ '^[0-9a-f]{64}$'),
  outlet_hash char(64) NOT NULL CHECK (outlet_hash ~ '^[0-9a-f]{64}$'),
  contact_hash char(64) NOT NULL CHECK (contact_hash ~ '^[0-9a-f]{64}$'),
  outlet_subject_hash char(64) NOT NULL CHECK (outlet_subject_hash ~ '^[0-9a-f]{64}$'),
  recipient_hash char(64) NOT NULL CHECK (recipient_hash ~ '^[0-9a-f]{64}$'),
  privacy_record_id uuid NOT NULL DEFAULT gen_random_uuid(),
  privacy_tombstoned_at timestamptz,
  privacy_plan_id uuid,
  allocated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (release_hash,outlet_hash,contact_hash),
  CONSTRAINT campaign_outlet_ledger_privacy_plan_fk
    FOREIGN KEY (privacy_plan_id) REFERENCES privacy_governance_plans(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS campaign_outlet_allocation_ledger_pair_idx
  ON campaign_outlet_allocation_ledger (release_hash,outlet_hash,allocated_at);
CREATE UNIQUE INDEX IF NOT EXISTS campaign_outlet_counters_privacy_record_idx
  ON campaign_outlet_allocation_counters (privacy_record_id);
CREATE INDEX IF NOT EXISTS campaign_outlet_counters_privacy_candidate_idx
  ON campaign_outlet_allocation_counters (updated_at,privacy_record_id)
  WHERE privacy_tombstoned_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS campaign_outlet_ledger_privacy_record_idx
  ON campaign_outlet_allocation_ledger (privacy_record_id);
CREATE INDEX IF NOT EXISTS campaign_outlet_ledger_privacy_candidate_idx
  ON campaign_outlet_allocation_ledger (allocated_at,privacy_record_id)
  WHERE privacy_tombstoned_at IS NULL;
CREATE INDEX IF NOT EXISTS campaign_outlet_ledger_privacy_contact_idx
  ON campaign_outlet_allocation_ledger (contact_hash,allocated_at,privacy_record_id)
  WHERE privacy_tombstoned_at IS NULL;
CREATE INDEX IF NOT EXISTS campaign_outlet_ledger_privacy_recipient_idx
  ON campaign_outlet_allocation_ledger (recipient_hash,allocated_at,privacy_record_id)
  WHERE privacy_tombstoned_at IS NULL;
