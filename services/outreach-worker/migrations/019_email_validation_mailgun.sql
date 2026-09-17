ALTER TABLE email_validation_cache
  DROP CONSTRAINT IF EXISTS email_validation_cache_type_check;

ALTER TABLE email_validation_cache
  ADD CONSTRAINT email_validation_cache_type_check
  CHECK (validator_type IN ('http', 'smtp', 'mailgun'));
