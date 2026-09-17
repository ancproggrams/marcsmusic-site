CREATE TABLE IF NOT EXISTS workflow_leases (
  lease_name text PRIMARY KEY,
  owner_id text,
  fence_token bigint NOT NULL DEFAULT 0 CHECK (fence_token >= 0),
  locked_until timestamptz,
  workflow_name text,
  run_id uuid REFERENCES workflow_runs(id) ON DELETE SET NULL,
  scope_kind text CHECK (scope_kind IN ('incremental', 'full')),
  watermark_from timestamptz,
  watermark_to timestamptz,
  route_index integer NOT NULL DEFAULT 0 CHECK (route_index >= 0),
  cursor_modified_at timestamptz,
  cursor_id text,
  counters jsonb NOT NULL DEFAULT '{}'::jsonb,
  checkpoint_status text NOT NULL DEFAULT 'idle'
    CHECK (checkpoint_status IN ('idle', 'running', 'failed', 'succeeded')),
  checkpoint_version bigint NOT NULL DEFAULT 0 CHECK (checkpoint_version >= 0),
  last_error_code text,
  acquired_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK (
    (checkpoint_status = 'idle' AND scope_kind IS NULL AND watermark_from IS NULL AND watermark_to IS NULL)
    OR
    (checkpoint_status <> 'idle' AND scope_kind IS NOT NULL AND watermark_from IS NOT NULL AND watermark_to IS NOT NULL)
  ),
  CHECK (watermark_to IS NULL OR watermark_from IS NULL OR watermark_to >= watermark_from)
);

CREATE INDEX IF NOT EXISTS workflow_leases_expiry_idx
  ON workflow_leases (locked_until)
  WHERE owner_id IS NOT NULL;

COMMENT ON TABLE workflow_leases IS
  'Singleton reconciliation ownership with monotonically fenced, resumable (modifiedAt,id) checkpoints.';
