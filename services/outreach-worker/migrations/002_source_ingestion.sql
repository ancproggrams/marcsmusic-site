CREATE TABLE source_ingestion_receipts (
  source_id text NOT NULL,
  artifact_id text NOT NULL,
  content_digest char(64) NOT NULL,
  generated_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'processing',
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error_code text,
  attempts integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_id, artifact_id),
  CONSTRAINT source_ingestion_receipts_status_check CHECK (status IN ('processing', 'completed', 'failed')),
  CONSTRAINT source_ingestion_receipts_digest_check CHECK (content_digest ~ '^[0-9a-f]{64}$')
);

CREATE INDEX source_ingestion_receipts_status_updated_idx
  ON source_ingestion_receipts (status, updated_at);

CREATE TABLE source_ingestion_nonces (
  source_id text NOT NULL,
  nonce text NOT NULL,
  request_timestamp timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_id, nonce)
);

CREATE INDEX source_ingestion_nonces_expiry_idx ON source_ingestion_nonces (expires_at);

CREATE TABLE source_ingestion_record_links (
  source_id text NOT NULL,
  external_id text NOT NULL,
  entity_type text NOT NULL,
  crm_entity_id varchar(24) NOT NULL,
  artifact_id text NOT NULL,
  evidence_digest char(64) NOT NULL,
  evidence_captured_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_id, external_id, entity_type),
  FOREIGN KEY (source_id, artifact_id)
    REFERENCES source_ingestion_receipts (source_id, artifact_id) ON DELETE RESTRICT,
  CONSTRAINT source_ingestion_record_links_entity_check
    CHECK (entity_type IN ('MediaOutlet', 'MediaContact', 'MusicRelease')),
  CONSTRAINT source_ingestion_record_links_digest_check CHECK (evidence_digest ~ '^[0-9a-f]{64}$')
);

CREATE INDEX source_ingestion_record_links_crm_idx
  ON source_ingestion_record_links (entity_type, crm_entity_id);

CREATE TABLE email_validation_cache (
  recipient_hash char(64) PRIMARY KEY,
  status text NOT NULL,
  checked_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  provider_reference varchar(180),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_validation_cache_status_check CHECK (status IN ('Valid', 'Invalid', 'Risky', 'Unknown')),
  CONSTRAINT email_validation_cache_hash_check CHECK (recipient_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX email_validation_cache_expiry_idx ON email_validation_cache (expires_at);
