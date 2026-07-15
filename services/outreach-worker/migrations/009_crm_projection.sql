-- Durable, replay-safe CRM projection state. Provider acceptance and creation
-- of its projection work item are committed in the same PostgreSQL transaction.
CREATE TABLE IF NOT EXISTS crm_delivery_projections (
  send_queue_id uuid PRIMARY KEY REFERENCES send_queue(id) ON DELETE RESTRICT,
  match_id text NOT NULL,
  release_id text NOT NULL,
  contact_id text NOT NULL,
  outlet_id text,
  provider_message_id text NOT NULL,
  deterministic_message_id text NOT NULL,
  correlation_id text NOT NULL,
  accepted_at timestamptz NOT NULL,
  campaign_projection_key text NOT NULL,
  email_projection_key text NOT NULL UNIQUE,
  event_projection_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  target_list_status text NOT NULL DEFAULT 'review_required'
    CHECK (target_list_status IN ('review_required')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error_code text,
  last_failure_retryable boolean,
  campaign_id text,
  email_id text,
  event_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_delivery_projections_provider_message_idx
  ON crm_delivery_projections (provider_message_id);

CREATE INDEX IF NOT EXISTS crm_delivery_projections_retry_idx
  ON crm_delivery_projections (status, updated_at)
  WHERE status IN ('pending', 'failed', 'processing');

COMMENT ON TABLE crm_delivery_projections IS
  'Durable receipt for standard Espo Campaign/Email and append-only OutreachEvent projection after confirmed provider acceptance.';

-- Safety cache closes the cross-store window between an inbound Not Suitable
-- reply and the optimistic-concurrency update of MediaContact.rejectedGenres.
CREATE TABLE IF NOT EXISTS contact_genre_denials (
  contact_id text NOT NULL,
  genre text NOT NULL,
  source_event_id text NOT NULL,
  match_id text NOT NULL,
  release_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (contact_id, genre)
);

CREATE INDEX IF NOT EXISTS contact_genre_denials_release_idx
  ON contact_genre_denials (release_id, contact_id);

COMMENT ON TABLE contact_genre_denials IS
  'Deny-wins, append-only genre safety cache. Automated workflows may add but never remove rows.';

-- Projection receipts and genre decisions contain attributable identifiers and
-- therefore participate in the same plan-bound privacy lifecycle as the
-- pre-existing outreach tables. FKs are installed NOT VALID to avoid a table
-- scan during deployment; the privacy workflow validates them online.
ALTER TABLE crm_delivery_projections
  ADD COLUMN IF NOT EXISTS privacy_tombstoned_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_plan_id uuid;

ALTER TABLE contact_genre_denials
  ADD COLUMN IF NOT EXISTS privacy_tombstoned_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_plan_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='crm_delivery_projections_privacy_plan_fk'
      AND conrelid='crm_delivery_projections'::regclass
  ) THEN
    ALTER TABLE crm_delivery_projections
      ADD CONSTRAINT crm_delivery_projections_privacy_plan_fk
      FOREIGN KEY (privacy_plan_id) REFERENCES privacy_governance_plans(id)
      ON DELETE RESTRICT NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='contact_genre_denials_privacy_plan_fk'
      AND conrelid='contact_genre_denials'::regclass
  ) THEN
    ALTER TABLE contact_genre_denials
      ADD CONSTRAINT contact_genre_denials_privacy_plan_fk
      FOREIGN KEY (privacy_plan_id) REFERENCES privacy_governance_plans(id)
      ON DELETE RESTRICT NOT VALID;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS crm_delivery_projections_privacy_candidate_idx
  ON crm_delivery_projections (created_at,send_queue_id)
  WHERE privacy_tombstoned_at IS NULL;

CREATE INDEX IF NOT EXISTS contact_genre_denials_privacy_candidate_idx
  ON contact_genre_denials (created_at,contact_id,genre)
  WHERE privacy_tombstoned_at IS NULL;

-- These review types record two deliberate fail-closed boundaries: Espo 10.0.2
-- does not prove TargetList membership for the custom MediaContact entity, and
-- an uncertain provider delivery may not be projected as a sent Email.
ALTER TABLE human_review_items
  DROP CONSTRAINT IF EXISTS human_review_items_review_type_check;

ALTER TABLE human_review_items
  ADD CONSTRAINT human_review_items_review_type_check CHECK (review_type IN (
    'ambiguous_reply',
    'outlet_suppression_proposal',
    'sender_identity_mismatch',
    'unmatched_reply',
    'target_list_projection_blocked',
    'delivery_unknown_reconciliation'
  ));
