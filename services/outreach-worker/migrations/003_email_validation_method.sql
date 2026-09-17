ALTER TABLE email_validation_cache
  ADD COLUMN IF NOT EXISTS validator_type text;

UPDATE email_validation_cache
   SET validator_type = CASE
     WHEN provider_reference LIKE 'smtp:%' THEN 'smtp'
     ELSE 'http'
   END
 WHERE validator_type IS NULL;

ALTER TABLE email_validation_cache
  ALTER COLUMN validator_type SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'email_validation_cache_type_check'
       AND conrelid = 'email_validation_cache'::regclass
  ) THEN
    ALTER TABLE email_validation_cache
      ADD CONSTRAINT email_validation_cache_type_check
      CHECK (validator_type IN ('http', 'smtp'));
  END IF;
END
$$;
