CREATE TABLE source_identity_bindings (
  entity_type text NOT NULL,
  identity_type text NOT NULL,
  identity_hash char(64) NOT NULL,
  crm_entity_id varchar(24) NOT NULL,
  evidence_captured_at timestamptz NOT NULL,
  evidence_verified boolean NOT NULL DEFAULT false,
  source_id text NOT NULL,
  external_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_type, identity_type, identity_hash),
  CONSTRAINT source_identity_bindings_entity_check
    CHECK (entity_type IN ('MediaOutlet', 'MediaContact')),
  CONSTRAINT source_identity_bindings_type_check
    CHECK (identity_type IN ('email', 'fingerprint', 'instagram', 'name_outlet', 'show_outlet', 'outlet_domain')),
  CONSTRAINT source_identity_bindings_hash_check
    CHECK (identity_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT source_identity_bindings_crm_id_check CHECK (length(crm_entity_id) BETWEEN 1 AND 24),
  CONSTRAINT source_identity_bindings_source_check CHECK (length(source_id) BETWEEN 1 AND 64),
  CONSTRAINT source_identity_bindings_external_check CHECK (length(external_id) BETWEEN 1 AND 180)
);

CREATE INDEX source_identity_bindings_crm_idx
  ON source_identity_bindings (entity_type, crm_entity_id);

CREATE TABLE source_identity_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_owner varchar(64) NOT NULL,
  entity_type text NOT NULL,
  locked_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT source_identity_claims_id_entity_unique UNIQUE (id, entity_type),
  CONSTRAINT source_identity_claims_entity_check
    CHECK (entity_type IN ('MediaOutlet', 'MediaContact')),
  CONSTRAINT source_identity_claims_owner_check CHECK (length(claim_owner) BETWEEN 1 AND 64)
);

CREATE INDEX source_identity_claims_expiry_idx
  ON source_identity_claims (locked_until);

CREATE TABLE source_identity_claim_items (
  claim_id uuid NOT NULL,
  entity_type text NOT NULL,
  identity_type text NOT NULL,
  identity_hash char(64) NOT NULL,
  PRIMARY KEY (claim_id, entity_type, identity_type, identity_hash),
  UNIQUE (entity_type, identity_type, identity_hash),
  CONSTRAINT source_identity_claim_items_entity_check
    CHECK (entity_type IN ('MediaOutlet', 'MediaContact')),
  CONSTRAINT source_identity_claim_items_type_check
    CHECK (identity_type IN ('email', 'fingerprint', 'instagram', 'name_outlet', 'show_outlet', 'outlet_domain')),
  CONSTRAINT source_identity_claim_items_hash_check
    CHECK (identity_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT source_identity_claim_items_claim_fk
    FOREIGN KEY (claim_id, entity_type)
    REFERENCES source_identity_claims(id, entity_type) ON DELETE CASCADE
);

COMMENT ON TABLE source_identity_bindings IS
  'Privacy-hashed, cross-source aliases bound to one EspoCRM identity; raw email, names and social handles are not stored.';
COMMENT ON TABLE source_identity_claims IS
  'Finite claims serialize overlapping cross-source identity sets while CRM resolution is in flight.';
