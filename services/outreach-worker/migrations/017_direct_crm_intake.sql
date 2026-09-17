ALTER TABLE source_identity_bindings
  DROP CONSTRAINT source_identity_bindings_type_check;
ALTER TABLE source_identity_bindings
  ADD CONSTRAINT source_identity_bindings_type_check
  CHECK (identity_type IN (
    'email', 'fingerprint', 'instagram', 'linkedin', 'soundcloud',
    'name_outlet', 'show_outlet', 'outlet_domain'
  ));

ALTER TABLE source_identity_claim_items
  DROP CONSTRAINT source_identity_claim_items_type_check;
ALTER TABLE source_identity_claim_items
  ADD CONSTRAINT source_identity_claim_items_type_check
  CHECK (identity_type IN (
    'email', 'fingerprint', 'instagram', 'linkedin', 'soundcloud',
    'name_outlet', 'show_outlet', 'outlet_domain'
  ));

CREATE TABLE crm_intake_receipts (
  entity_type text NOT NULL,
  entity_id varchar(24) NOT NULL,
  revision_digest char(64) NOT NULL,
  status text NOT NULL DEFAULT 'processing',
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts integer NOT NULL DEFAULT 1,
  last_error_code varchar(120),
  lease_owner varchar(64),
  lease_version bigint NOT NULL DEFAULT 1,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY (entity_type, entity_id, revision_digest),
  CONSTRAINT crm_intake_receipts_entity_type_check
    CHECK (entity_type IN ('MediaOutlet', 'MediaContact')),
  CONSTRAINT crm_intake_receipts_entity_id_check
    CHECK (length(entity_id) BETWEEN 1 AND 24),
  CONSTRAINT crm_intake_receipts_revision_check
    CHECK (revision_digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT crm_intake_receipts_status_check
    CHECK (status IN ('processing', 'completed', 'failed')),
  CONSTRAINT crm_intake_receipts_attempts_check CHECK (attempts > 0),
  CONSTRAINT crm_intake_receipts_lease_check CHECK (
    (status = 'processing' AND lease_owner IS NOT NULL AND locked_until IS NOT NULL)
    OR (status <> 'processing' AND lease_owner IS NULL AND locked_until IS NULL)
  )
);

CREATE INDEX crm_intake_receipts_claim_idx
  ON crm_intake_receipts (status, locked_until, updated_at)
  WHERE status IN ('processing', 'failed');
CREATE INDEX crm_intake_receipts_entity_completed_idx
  ON crm_intake_receipts (entity_type, entity_id, completed_at DESC)
  WHERE status = 'completed';

CREATE TABLE purpose_bound_evidence_attestations (
  entity_type text NOT NULL,
  entity_id varchar(24) NOT NULL,
  entity_version integer NOT NULL,
  digest_version varchar(64) NOT NULL,
  evidence_digest char(64) NOT NULL,
  evidence_captured_at timestamptz NOT NULL,
  purpose varchar(80) NOT NULL,
  basis varchar(80) NOT NULL,
  source_kind text NOT NULL,
  origin_revision_digest char(64) NOT NULL,
  origin_entity_id varchar(24),
  origin_source_id varchar(64),
  origin_artifact_id varchar(180),
  status text NOT NULL DEFAULT 'active',
  revocation_reason varchar(120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_type, entity_id),
  CONSTRAINT purpose_bound_evidence_entity_type_check
    CHECK (entity_type IN ('MediaOutlet', 'MediaContact')),
  CONSTRAINT purpose_bound_evidence_entity_id_check
    CHECK (length(entity_id) BETWEEN 1 AND 24),
  CONSTRAINT purpose_bound_evidence_version_check CHECK (entity_version >= 0),
  CONSTRAINT purpose_bound_evidence_digest_check
    CHECK (evidence_digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT purpose_bound_evidence_origin_digest_check
    CHECK (origin_revision_digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT purpose_bound_evidence_source_kind_check
    CHECK (source_kind IN ('direct_crm', 'signed_source')),
  CONSTRAINT purpose_bound_evidence_status_check
    CHECK (status IN ('active', 'invalid', 'revoked')),
  CONSTRAINT purpose_bound_evidence_origin_check CHECK (
    (source_kind = 'direct_crm' AND origin_entity_id IS NOT NULL AND origin_source_id IS NULL AND origin_artifact_id IS NULL)
    OR
    (source_kind = 'signed_source' AND origin_entity_id IS NULL AND origin_source_id IS NOT NULL AND origin_artifact_id IS NOT NULL)
  ),
  CONSTRAINT purpose_bound_evidence_revocation_check CHECK (
    (status = 'active' AND revocation_reason IS NULL)
    OR (status IN ('invalid', 'revoked') AND revocation_reason IS NOT NULL)
  )
);

CREATE INDEX purpose_bound_evidence_origin_idx
  ON purpose_bound_evidence_attestations
  (source_kind, origin_source_id, origin_artifact_id, origin_revision_digest);

COMMENT ON TABLE crm_intake_receipts IS
  'Raw-PII-free, fenced replay receipts for direct EspoCRM contact and outlet validation.';
COMMENT ON TABLE purpose_bound_evidence_attestations IS
  'Purpose-bound evidence digests. An attestation is usable only when its durable origin receipt completed.';
