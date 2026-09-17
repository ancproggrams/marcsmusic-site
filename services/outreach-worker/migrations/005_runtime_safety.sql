-- Runtime safety controls are additive and safe for an existing queue.
ALTER TABLE send_queue
  ADD COLUMN IF NOT EXISTS capacity_business_date date;

CREATE UNIQUE INDEX IF NOT EXISTS send_capacity_one_active_reservation_idx
  ON send_capacity_reservations (send_queue_id)
  WHERE status = 'reserved';

CREATE TABLE IF NOT EXISTS outlet_first_send_guards (
  outlet_hash text PRIMARY KEY,
  match_id text NOT NULL,
  send_queue_id uuid NOT NULL UNIQUE REFERENCES send_queue(id),
  status text NOT NULL CHECK (status IN ('reserved', 'consumed', 'released')),
  reserved_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz,
  released_at timestamptz,
  cooldown_until timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outlet_first_send_guards_cooldown_idx
  ON outlet_first_send_guards (status, cooldown_until);

COMMENT ON TABLE outlet_first_send_guards IS
  'Hashed, transactional fence enforcing at most one first outreach email per outlet in the approved cooldown window.';

CREATE TABLE IF NOT EXISTS human_review_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_type text NOT NULL CHECK (review_type IN (
    'ambiguous_reply',
    'outlet_suppression_proposal',
    'sender_identity_mismatch',
    'unmatched_reply'
  )),
  source text NOT NULL,
  source_event_id text NOT NULL,
  match_id text,
  contact_id text,
  outlet_id text,
  reason text NOT NULL,
  proposed_action text,
  evidence_ciphertext bytea NOT NULL,
  evidence_iv bytea NOT NULL,
  evidence_tag bytea NOT NULL,
  key_version text NOT NULL,
  created_by text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  decision text,
  decision_reason text,
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_event_id, review_type),
  CHECK (
    (status = 'pending' AND decision IS NULL AND decided_by IS NULL AND decided_at IS NULL)
    OR
    (status <> 'pending' AND decision IS NOT NULL AND decided_by IS NOT NULL AND decided_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS human_review_items_pending_idx
  ON human_review_items (created_at, review_type)
  WHERE status = 'pending';

COMMENT ON TABLE human_review_items IS
  'Durable, encrypted review work. Proposed outlet/domain actions require an attributable human decision before execution.';
