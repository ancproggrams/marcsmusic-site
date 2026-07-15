-- Enforce encrypted writes immediately while allowing existing plaintext rows
-- to be migrated online before the bounded validation step.
ALTER TABLE "SoundCloudToken"
ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "SoundCloudToken"
ADD CONSTRAINT "SoundCloudToken_encrypted_envelope_check"
CHECK (
  "accessToken" LIKE 'scg1.%'
  AND "refreshToken" LIKE 'scg1.%'
) NOT VALID;
