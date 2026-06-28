PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS platforms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  canonical_key TEXT NOT NULL UNIQUE,
  website_url TEXT NOT NULL,
  submission_url TEXT,
  source_url TEXT,
  source_type TEXT NOT NULL DEFAULT 'seed',
  country TEXT,
  language TEXT,
  genres_json TEXT NOT NULL DEFAULT '[]',
  submission_method TEXT,
  fee_required INTEGER NOT NULL DEFAULT 0,
  fee_amount TEXT,
  login_required INTEGER NOT NULL DEFAULT 0,
  captcha_detected INTEGER NOT NULL DEFAULT 0,
  payment_required INTEGER NOT NULL DEFAULT 0,
  manual_review_required INTEGER NOT NULL DEFAULT 0,
  manual_review_reason TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  confidence_score INTEGER NOT NULL DEFAULT 0,
  last_activity_at TEXT,
  last_verified_at TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  risk_flags_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  platform_id TEXT NOT NULL,
  contact_type TEXT NOT NULL,
  value TEXT NOT NULL,
  source_url TEXT,
  verification_status TEXT NOT NULL DEFAULT 'verified',
  deliverability_score INTEGER,
  risk_score INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(platform_id) REFERENCES platforms(id) ON DELETE CASCADE,
  UNIQUE(platform_id, contact_type, value)
);

CREATE TABLE IF NOT EXISTS email_verifications (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL,
  email TEXT NOT NULL,
  syntax_valid INTEGER NOT NULL DEFAULT 0,
  mx_valid INTEGER NOT NULL DEFAULT 0,
  role_account INTEGER NOT NULL DEFAULT 0,
  disposable INTEGER NOT NULL DEFAULT 0,
  temporary INTEGER NOT NULL DEFAULT 0,
  smtp_checked INTEGER NOT NULL DEFAULT 0,
  smtp_deliverable INTEGER,
  status TEXT NOT NULL,
  reason TEXT,
  deliverability_score INTEGER NOT NULL DEFAULT 0,
  risk_score INTEGER NOT NULL DEFAULT 100,
  checked_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS submission_forms (
  id TEXT PRIMARY KEY,
  platform_id TEXT NOT NULL,
  form_url TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'form',
  requires_login INTEGER NOT NULL DEFAULT 0,
  requires_captcha INTEGER NOT NULL DEFAULT 0,
  requires_payment INTEGER NOT NULL DEFAULT 0,
  requires_manual_approval INTEGER NOT NULL DEFAULT 0,
  supports_upload INTEGER NOT NULL DEFAULT 0,
  required_fields_json TEXT NOT NULL DEFAULT '[]',
  detected_fields_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',
  last_checked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(platform_id) REFERENCES platforms(id) ON DELETE CASCADE,
  UNIQUE(platform_id, form_url)
);

CREATE TABLE IF NOT EXISTS submission_queue (
  id TEXT PRIMARY KEY,
  platform_id TEXT NOT NULL,
  submission_form_id TEXT,
  submission_url TEXT NOT NULL,
  job_type TEXT NOT NULL DEFAULT 'verify_platform',
  priority INTEGER NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'queued',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  run_after TEXT NOT NULL,
  locked_by TEXT,
  locked_at TEXT,
  completed_at TEXT,
  cancelled_at TEXT,
  archived_at TEXT,
  manual_review_reason TEXT,
  last_error TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(platform_id) REFERENCES platforms(id) ON DELETE CASCADE,
  FOREIGN KEY(submission_form_id) REFERENCES submission_forms(id) ON DELETE SET NULL,
  CHECK(status IN ('queued', 'running', 'waiting', 'retrying', 'completed', 'failed', 'cancelled', 'archived', 'needs_manual_review'))
);

CREATE TABLE IF NOT EXISTS submission_events (
  id TEXT PRIMARY KEY,
  job_id TEXT,
  platform_id TEXT,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  message TEXT,
  data_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(job_id) REFERENCES submission_queue(id) ON DELETE SET NULL,
  FOREIGN KEY(platform_id) REFERENCES platforms(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id TEXT PRIMARY KEY,
  snapshot_date TEXT NOT NULL,
  metrics_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_platforms_canonical_key ON platforms(canonical_key);
CREATE INDEX IF NOT EXISTS idx_platforms_verification_status ON platforms(verification_status);
CREATE INDEX IF NOT EXISTS idx_platforms_manual_review ON platforms(manual_review_required);
CREATE INDEX IF NOT EXISTS idx_contacts_platform ON contacts(platform_id);
CREATE INDEX IF NOT EXISTS idx_email_verifications_contact ON email_verifications(contact_id);
CREATE INDEX IF NOT EXISTS idx_forms_platform_status ON submission_forms(platform_id, status);
CREATE INDEX IF NOT EXISTS idx_queue_claim ON submission_queue(status, run_after, priority DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_queue_platform ON submission_queue(platform_id);
CREATE INDEX IF NOT EXISTS idx_queue_locked ON submission_queue(status, locked_at);
CREATE INDEX IF NOT EXISTS idx_events_job ON submission_events(job_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_platform ON submission_events(platform_id, created_at);
