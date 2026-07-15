ALTER TABLE source_ingestion_receipts
  ADD COLUMN IF NOT EXISTS lease_owner varchar(64),
  ADD COLUMN IF NOT EXISTS lease_version bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz;

UPDATE source_ingestion_receipts
   SET lease_owner = 'migration-expired',
       lease_version = GREATEST(lease_version, 1),
       locked_until = now() - interval '1 second'
 WHERE status = 'processing'
   AND (lease_owner IS NULL OR locked_until IS NULL);

UPDATE source_ingestion_receipts
   SET lease_owner = NULL,
       locked_until = NULL
 WHERE status <> 'processing';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'source_ingestion_receipts_lease_state_check'
       AND conrelid = 'source_ingestion_receipts'::regclass
  ) THEN
    ALTER TABLE source_ingestion_receipts
      ADD CONSTRAINT source_ingestion_receipts_lease_state_check CHECK (
        (status = 'processing' AND lease_owner IS NOT NULL AND locked_until IS NOT NULL AND lease_version > 0)
        OR
        (status <> 'processing' AND lease_owner IS NULL AND locked_until IS NULL)
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS source_ingestion_receipts_lease_expiry_idx
  ON source_ingestion_receipts (status, locked_until)
  WHERE status = 'processing';
