-- Durable, fenced recovery of provider outcomes and CRM inbound email events.
-- The upper watermark is fixed when a logical run starts. A failed/expired
-- owner resumes the same window and keyset/page token instead of advancing it.
CREATE TABLE IF NOT EXISTS outcome_reconcile_state (
  workflow_name text PRIMARY KEY,
  owner_id text,
  fence_token bigint NOT NULL DEFAULT 0 CHECK (fence_token >= 0),
  locked_until timestamptz,
  run_id uuid REFERENCES workflow_runs(id) ON DELETE SET NULL,
  watermark_from timestamptz,
  watermark_to timestamptz,
  route_index integer NOT NULL DEFAULT 0 CHECK (route_index >= 0),
  cursor_timestamp timestamptz,
  cursor_id text,
  provider_page_token text,
  counters jsonb NOT NULL DEFAULT '{}'::jsonb,
  checkpoint_status text NOT NULL DEFAULT 'idle'
    CHECK (checkpoint_status IN ('idle', 'running', 'failed', 'succeeded')),
  checkpoint_version bigint NOT NULL DEFAULT 0 CHECK (checkpoint_version >= 0),
  resume_count integer NOT NULL DEFAULT 0 CHECK (resume_count >= 0),
  last_error_code text,
  acquired_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK (
    (checkpoint_status = 'idle' AND watermark_from IS NULL AND watermark_to IS NULL)
    OR
    (checkpoint_status <> 'idle' AND watermark_from IS NOT NULL AND watermark_to IS NOT NULL)
  ),
  CHECK (watermark_to IS NULL OR watermark_from IS NULL OR watermark_to >= watermark_from),
  CHECK (provider_page_token IS NULL OR octet_length(provider_page_token) <= 2048)
);

CREATE INDEX IF NOT EXISTS outcome_reconcile_state_expiry_idx
  ON outcome_reconcile_state (locked_until)
  WHERE owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS send_queue_provider_identity_lookup_idx
  ON send_queue (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS outreach_due_match_recovery_work_idx
  ON work_items (entity_id, kind, status)
  WHERE kind = 'schedule_sequence_step';

COMMENT ON TABLE outcome_reconcile_state IS
  'Singleton provider/CRM outcome recovery lease with fixed watermarks, fencing and crash-resumable route checkpoints.';
COMMENT ON COLUMN outcome_reconcile_state.provider_page_token IS
  'Opaque bounded provider pagination token only; never a provider supplied URL.';
